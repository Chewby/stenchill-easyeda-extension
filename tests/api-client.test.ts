import { describe, expect, it, vi } from 'vitest';
import { ApiError, generateStencil } from '../src/api-client';
import { DEFAULT_PARAMS } from '../src/params';

function streamOf(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});
}

function fakeFetch(sse: string, stl = new Uint8Array([1, 2, 3])) {
	return vi.fn(async (url: string) => {
		if (String(url).includes('/generate/stream')) {
			return new Response(streamOf(sse), { status: 200 });
		}
		return new Response(stl, { status: 200 });
	}) as unknown as typeof fetch;
}

const zip = new File([new Uint8Array([80, 75])], 'gerbers.zip', { type: 'application/zip' });

const base = {
	zip,
	params: DEFAULT_PARAMS,
	baseUrl: 'https://example.test/api/v1',
	apiKey: 'k',
	userAgent: 'UA',
};

describe('generateStencil', () => {
	it('envoie le ZIP sous le champ file et les dix parametres', async () => {
		const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n');
		await generateStencil({ ...base, fetchImpl: doFetch });
		const [url, init] = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('https://example.test/api/v1/generate/stream');
		const body = init.body as FormData;
		expect((body.get('file') as File).name).toBe('gerbers.zip');
		expect(body.get('thickness')).toBe('0.4');
		expect(body.get('enableSlotify')).toBe('true');
		expect(init.headers['X-API-Key']).toBe('k');
		expect(init.headers['User-Agent']).toBe('UA');
	});

	it('remonte la progression et la file d attente', async () => {
		const onProgress = vi.fn();
		const onQueued = vi.fn();
		await generateStencil({
			...base,
			fetchImpl: fakeFetch(
				'event: queued\ndata: {"position":3,"queueDepth":4,"etaSeconds":12}\n\n'
				+ 'event: progress\ndata: {"step":2,"total":5,"labelText":"Compensation"}\n\n'
				+ 'event: complete\ndata: {"stlPath":"abc.zip"}\n\n',
			),
			onProgress,
			onQueued,
		});
		expect(onQueued).toHaveBeenCalledWith({ position: 3, queueDepth: 4, etaSeconds: 12 });
		expect(onProgress).toHaveBeenCalledWith({ step: 2, total: 5, labelText: 'Compensation' });
	});

	it('rend le contenu telecharge du STL', async () => {
		const result = await generateStencil({
			...base,
			fetchImpl: fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n'),
		});
		expect(result.stlPath).toBe('abc.zip');
		expect(new Uint8Array(result.bytes)).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('leve ApiError sur un evenement error', async () => {
		await expect(generateStencil({
			...base,
			fetchImpl: fakeFetch('event: error\ndata: {"error":"NO_PASTE_LAYER"}\n\n'),
		})).rejects.toThrow(ApiError);
	});

	it('leve ApiError quand le flux se termine sans complete', async () => {
		await expect(generateStencil({
			...base,
			fetchImpl: fakeFetch('event: progress\ndata: {"step":1}\n\n'),
		})).rejects.toThrow(ApiError);
	});

	it('transmet un signal ANNULABLE aux deux appels reseau', () => {
		// We no longer check the signal's identity: it is COMPOSED with the
		// timeout ceiling, so it is no longer the caller's own. What matters is
		// that it still aborts when the user cancels.
		return (async () => {
			const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n');
			const controller = new AbortController();
			await generateStencil({ ...base, fetchImpl: doFetch, signal: controller.signal });
			const calls = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
			expect(calls).toHaveLength(2);
			const passed = calls[0][1].signal as AbortSignal;
			expect(passed).toBeInstanceOf(AbortSignal);
			expect(calls[1][1].signal).toBe(passed);
			expect(passed.aborted).toBe(false);
			controller.abort();
			expect(passed.aborted).toBe(true);
		})();
	});

	it('passe un signal meme quand l appelant n en donne aucun', () => {
		// The timeout ceiling must also apply without any manual cancellation:
		// that is its whole point, getting out of a stream swallowed by some
		// intermediary.
		return (async () => {
			const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n');
			await generateStencil({ ...base, fetchImpl: doFetch });
			const calls = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
			expect(calls[0][1].signal).toBeInstanceOf(AbortSignal);
		})();
	});

	it('laisse remonter l abandon quand fetch est interrompu', async () => {
		const doFetch = vi.fn(async () => {
			throw new DOMException('aborted', 'AbortError');
		}) as unknown as typeof fetch;
		await expect(generateStencil({ ...base, fetchImpl: doFetch })).rejects.toThrow(/abort/i);
	});

	it('leve quand le serveur refuse la requete de generation', async () => {
		const doFetch = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
		await expect(generateStencil({ ...base, fetchImpl: doFetch }))
			.rejects
			.toThrow(/HTTP 503/);
	});

	it('leve quand le telechargement du resultat echoue', async () => {
		// The stream succeeded, the user has paid for their generation, and it
		// is the SECOND request that fails: the message must say download.
		const doFetch = vi.fn(async (url: string) => {
			if (String(url).includes('/generate/stream')) {
				return new Response(streamOf('event: complete\ndata: {"stlPath":"abc.zip"}\n\n'), { status: 200 });
			}
			return new Response('', { status: 404 });
		}) as unknown as typeof fetch;
		await expect(generateStencil({ ...base, fetchImpl: doFetch }))
			.rejects
			.toThrow(/Download failed: HTTP 404/);
	});

	it('reste utilisable si AbortSignal.any manque', async () => {
		// Composition requires Chromium >= 116 and we do not know the EasyEDA
		// client's floor version. Without a fallback, an older client would
		// throw on the very first line and generation would NOT START AT ALL:
		// the timeout ceiling would be worse than the default it fixes.
		const real = AbortSignal.any;

		(AbortSignal as unknown as { any?: unknown }).any = undefined;
		try {
			const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n');
			const controller = new AbortController();
			const result = await generateStencil({
				...base,
				fetchImpl: doFetch,
				signal: controller.signal,
			});
			expect(result.stlPath).toBe('abc.zip');
			// We fall back to the caller's own signal: manual cancellation still
			// works, only the timeout ceiling is lost.
			const calls = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
			expect(calls[0][1].signal).toBe(controller.signal);
		}
		finally {
			(AbortSignal as unknown as { any?: unknown }).any = real;
		}
	});

	it('refuse un chemin de telechargement suspect', async () => {
		// The server only accepts a SEGMENT (^[a-zA-Z0-9._-]+\.zip$). A path
		// would be encoded as %2F and would fail with a 404 AFTER a successful
		// generation, at the most expensive moment. We reject early, and say why.
		const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"jobs/123/out.zip"}\n\n');
		await expect(generateStencil({ ...base, fetchImpl: doFetch }))
			.rejects
			.toThrow(/suspicious download path/i);
	});

	it('accepte le nom de fichier que le serveur produit', async () => {
		const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"a_b-1.2.zip"}\n\n');
		const result = await generateStencil({ ...base, fetchImpl: doFetch });
		expect(result.stlPath).toBe('a_b-1.2.zip');
	});

	it('ne casse pas sur une charge JSON malformee', async () => {
		const result = await generateStencil({
			...base,
			fetchImpl: fakeFetch('event: progress\ndata: pas du json\n\nevent: complete\ndata: {"stlPath":"abc.zip"}\n\n'),
		});
		expect(result.stlPath).toBe('abc.zip');
	});
});
