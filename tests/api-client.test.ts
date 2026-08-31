import { describe, expect, it, vi } from 'vitest';
import { ApiError, generateStencil, withDeadline } from '../src/api-client';
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
	it('sends the ZIP under the file field and the ten parameters', async () => {
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

	it('reports progress and the queue', async () => {
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

	it('returns the downloaded STL content', async () => {
		const result = await generateStencil({
			...base,
			fetchImpl: fakeFetch('event: complete\ndata: {"stlPath":"abc.zip"}\n\n'),
		});
		expect(result.stlPath).toBe('abc.zip');
		expect(new Uint8Array(result.bytes)).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('throws ApiError on an error event', async () => {
		await expect(generateStencil({
			...base,
			fetchImpl: fakeFetch('event: error\ndata: {"error":"NO_PASTE_LAYER"}\n\n'),
		})).rejects.toThrow(ApiError);
	});

	it('throws ApiError when the stream ends without complete', async () => {
		await expect(generateStencil({
			...base,
			fetchImpl: fakeFetch('event: progress\ndata: {"step":1}\n\n'),
		})).rejects.toThrow(ApiError);
	});

	it('passes a CANCELLABLE signal to both network calls', () => {
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

	it('passes a signal even when the caller gives none', () => {
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

	it('lets the abort surface when fetch is interrupted', async () => {
		const doFetch = vi.fn(async () => {
			throw new DOMException('aborted', 'AbortError');
		}) as unknown as typeof fetch;
		await expect(generateStencil({ ...base, fetchImpl: doFetch })).rejects.toThrow(/abort/i);
	});

	it('throws when the server refuses the generation request', async () => {
		const doFetch = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
		await expect(generateStencil({ ...base, fetchImpl: doFetch }))
			.rejects
			.toThrow(/HTTP 503/);
	});

	it('throws when the result download fails', async () => {
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

	it('stays usable when AbortSignal.any is missing', async () => {
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
			// The fallback keeps BOTH properties. The first writing of this
			// test rubber-stamped the defect: it asserted that the signal
			// passed to fetch IS the caller's own, which amounts to saying the
			// timeout ceiling is gone. Yet that is precisely the case it exists
			// to cover, an intermediary swallowing the connection on an older
			// client.
			const calls = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
			const passe = calls[0][1].signal as AbortSignal;
			expect(passe).not.toBe(controller.signal);
			expect(passe.aborted).toBe(false);
			// and the caller's cancellation still travels through the relay.
			controller.abort(new Error('stop'));
			expect(passe.aborted).toBe(true);
		}
		finally {
			(AbortSignal as unknown as { any?: unknown }).any = real;
		}
	});

	it('refuses a suspicious download path', async () => {
		// The server only accepts a SEGMENT (^[a-zA-Z0-9._-]+\.zip$). A path
		// would be encoded as %2F and would fail with a 404 AFTER a successful
		// generation, at the most expensive moment. We reject early, and say why.
		const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"jobs/123/out.zip"}\n\n');
		await expect(generateStencil({ ...base, fetchImpl: doFetch }))
			.rejects
			.toThrow(/suspicious download path/i);
	});

	it('accepts the filename the server produces', async () => {
		const doFetch = fakeFetch('event: complete\ndata: {"stlPath":"a_b-1.2.zip"}\n\n');
		const result = await generateStencil({ ...base, fetchImpl: doFetch });
		expect(result.stlPath).toBe('a_b-1.2.zip');
	});

	it('does not break on a malformed JSON payload', async () => {
		const result = await generateStencil({
			...base,
			fetchImpl: fakeFetch('event: progress\ndata: pas du json\n\nevent: complete\ndata: {"stlPath":"abc.zip"}\n\n'),
		});
		expect(result.stlPath).toBe('abc.zip');
	});
});

/**
 * `withDeadline` is now the primitive SHARED by both of the plugin's network
 * calls. Its interesting branch is the one a modern runtime never takes, so it
 * would rot silently: `AbortSignal.any` has to be removed to reach it.
 */
describe('withDeadline', () => {
	it('returns the ceiling alone when the caller supplies no signal', () => {
		const s = withDeadline(undefined, 50);
		expect(s).toBeInstanceOf(AbortSignal);
		expect(s.aborted).toBe(false);
	});

	it('composes both when AbortSignal.any exists', () => {
		const ctl = new AbortController();
		const s = withDeadline(ctl.signal, 50_000);
		expect(s).not.toBe(ctl.signal);
		ctl.abort(new Error('stop'));
		expect(s.aborted).toBe(true);
	});

	// WITHOUT `AbortSignal.any`, BOTH sources must still fire. The first
	// writing of the fallback returned `signal ?? deadline`, so it THREW AWAY
	// the ceiling as soon as a signal was supplied: the very case the ceiling
	// exists to cover became an infinite wait again.
	it('without AbortSignal.any, the caller cancellation travels through the relay', () => {
		const vrai = AbortSignal.any;
		(AbortSignal as unknown as { any?: unknown }).any = undefined;
		try {
			const ctl = new AbortController();
			const s = withDeadline(ctl.signal, 50_000);
			expect(s.aborted).toBe(false);
			ctl.abort(new Error('stop'));
			expect(s.aborted).toBe(true);
		}
		finally {
			(AbortSignal as unknown as { any?: unknown }).any = vrai;
		}
	});

	it('without AbortSignal.any, the CEILING fires too', async () => {
		const vrai = AbortSignal.any;
		(AbortSignal as unknown as { any?: unknown }).any = undefined;
		try {
			const ctl = new AbortController();
			const s = withDeadline(ctl.signal, 1);
			expect(s.aborted).toBe(false);
			await new Promise(resolve => setTimeout(resolve, 30));
			expect(s.aborted).toBe(true);
		}
		finally {
			(AbortSignal as unknown as { any?: unknown }).any = vrai;
		}
	});
});
