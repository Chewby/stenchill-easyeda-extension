import type { ShareOptions } from '../src/share';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../src/params';
import { buildParamsJson, injectParams, isTrustedViewUrl, shareStencil } from '../src/share';

async function makeZip(): Promise<Blob> {
	const archive = new JSZip();
	archive.file('front.gtp', 'G04*');
	return archive.generateAsync({ type: 'blob' });
}

describe('isTrustedViewUrl', () => {
	it('accepte la production', () => {
		expect(isTrustedViewUrl('https://stenchill.com/view/abc')).toBe(true);
		expect(isTrustedViewUrl('https://www.stenchill.com/view/abc')).toBe(true);
	});

	it('accepte un lien local SEULEMENT si l on tape un backend local', () => {
		const local = 'http://localhost:8080/api/v1';
		expect(isTrustedViewUrl('http://localhost:4200/view/abc', local)).toBe(true);
		expect(isTrustedViewUrl('http://127.0.0.1:8080/view/abc', local)).toBe(true);
	});

	it('refuse un lien local quand on tape la PRODUCTION', () => {
		// Otherwise a compromised server could redirect the user back to their
		// own machine, and the link would be opened without a second thought.
		expect(isTrustedViewUrl('http://localhost:4200/view/abc')).toBe(false);
		expect(isTrustedViewUrl('http://127.0.0.1:8080/view/abc')).toBe(false);
	});

	it('refuse un hote etranger qui CONTIENT le notre', () => {
		// The trap: the string contains "stenchill.com", the parsed host does not.
		expect(isTrustedViewUrl('https://evil.com/?x=stenchill.com')).toBe(false);
		expect(isTrustedViewUrl('https://stenchill.com.evil.com/view/abc')).toBe(false);
	});

	it('refuse le http en production et ce qui n est pas une URL', () => {
		expect(isTrustedViewUrl('http://stenchill.com/view/abc')).toBe(false);
		expect(isTrustedViewUrl('pas une url')).toBe(false);
	});
});

describe('buildParamsJson', () => {
	it('porte la version de schema et les parametres', () => {
		const parsed = JSON.parse(buildParamsJson(DEFAULT_PARAMS));
		expect(parsed.v).toBe(1);
		expect(parsed.thickness).toBe(0.4);
		expect(parsed.enableSlotify).toBe(true);
	});
});

describe('injectParams', () => {
	it('ajoute le fichier de parametres sans perdre les gerbers', async () => {
		const out = await injectParams(await makeZip(), DEFAULT_PARAMS);
		const archive = await JSZip.loadAsync(await out.arrayBuffer());
		expect(Object.keys(archive.files).sort()).toEqual(['front.gtp', 'stenchill-params.json']);
		expect(await archive.file('front.gtp')!.async('string')).toBe('G04*');
	});
});

describe('shareStencil', () => {
	it('poste le ZIP et rend l URL de partage', async () => {
		const doFetch = vi.fn(async () =>
			new Response('{"url":"https://stenchill.com/view/abc"}', { status: 200 }));
		const url = await shareStencil({
			zip: await makeZip(),
			params: DEFAULT_PARAMS,
			fetchImpl: doFetch as unknown as typeof fetch,
			baseUrl: 'https://example.test/api/v1',
			apiKey: 'k',
			userAgent: 'UA',
		});
		expect(url).toBe('https://stenchill.com/view/abc');
		const [target, init] = (doFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(target).toBe('https://example.test/api/v1/plugin/share');
		expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
	});

	it('refuse une URL de confiance douteuse rendue par le serveur', async () => {
		const doFetch = vi.fn(async () =>
			new Response('{"url":"https://evil.com/view/abc"}', { status: 200 }));
		await expect(shareStencil({
			zip: await makeZip(),
			params: DEFAULT_PARAMS,
			fetchImpl: doFetch as unknown as typeof fetch,
			baseUrl: 'https://example.test/api/v1',
			apiKey: 'k',
			userAgent: 'UA',
		})).rejects.toThrow(/untrusted/i);
	});

	it('leve quand la reponse ne porte pas d URL', async () => {
		const doFetch = vi.fn(async () => new Response('{}', { status: 200 }));
		await expect(shareStencil({
			zip: await makeZip(),
			params: DEFAULT_PARAMS,
			fetchImpl: doFetch as unknown as typeof fetch,
			baseUrl: 'https://example.test/api/v1',
			apiKey: 'k',
			userAgent: 'UA',
		})).rejects.toThrow(/did not include a URL/i);
	});
});

/**
 * Sharing was the only network call without a deadline. A silent
 * `/plugin/share` left the "View in 3D" button disabled until the window was
 * closed, without a word: the `.finally()` that re-enables it only runs once
 * the promise settles.
 */
describe('le plafond de delai du partage', () => {
	async function options(extra: Partial<ShareOptions> = {}): Promise<ShareOptions> {
		return {
			// A REAL archive: `injectParams` reopens it before sending, and any
			// old blob makes it fail before reaching the fetch we want to
			// observe.
			zip: await makeZip(),
			params: DEFAULT_PARAMS,
			fetchImpl: (async () => new Response('{"url":"https://www.stenchill.com/view/x"}', { status: 200 })) as unknown as typeof fetch,
			baseUrl: 'https://www.stenchill.com/api/v1',
			apiKey: 'k',
			userAgent: 'UA',
			...extra,
		};
	}

	it('passe un signal a fetch meme quand l appelant n en fournit aucun', async () => {
		let seen: RequestInit | undefined;
		await shareStencil(await options({
			fetchImpl: (async (_url: string, init: RequestInit) => {
				seen = init;
				return new Response('{"url":"https://www.stenchill.com/view/x"}', { status: 200 });
			}) as unknown as typeof fetch,
		}));
		expect(seen?.signal).toBeInstanceOf(AbortSignal);
	});

	// The caller's signal must stay ARMED: composing it with the deadline must
	// not replace it, otherwise cancelling a share stops working.
	it('honore l annulation de l appelant', async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(shareStencil(await options({
			signal: controller.signal,
			fetchImpl: (async (_url: string, init: RequestInit) => {
				if (init.signal?.aborted)
					throw new DOMException('aborted', 'AbortError');
				return new Response('{}', { status: 200 });
			}) as unknown as typeof fetch,
		}))).rejects.toThrow();
	});
});

describe('isTrustedViewUrl et la base locale', () => {
	/**
	 * `baseUrl` etait lu en SOUS-CHAINE. Un `baseUrl` valant
	 * `https://localhost.exemple.com/api` contient « localhost » sans etre
	 * local, et rouvrait donc la porte au 127.0.0.1 de l'utilisateur. La
	 * fonction est exportee et documentee comme une garde generique : elle ne
	 * doit pas dependre du fait que la constante d'aujourd'hui soit sage.
	 */
	it('refuse un lien local quand la base seulement CONTIENT localhost', () => {
		expect(isTrustedViewUrl('http://127.0.0.1:4200/view/x', 'https://localhost.exemple.com/api/v1')).toBe(false);
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'https://notlocalhost.com/api/v1')).toBe(false);
	});

	it('accepte encore un lien local sur une VRAIE base locale', () => {
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'http://localhost:8080/api/v1')).toBe(true);
		expect(isTrustedViewUrl('http://127.0.0.1:4200/view/x', 'http://127.0.0.1:8080/api/v1')).toBe(true);
	});

	it('refuse quand la base est illisible', () => {
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'pas une url')).toBe(false);
	});
});
