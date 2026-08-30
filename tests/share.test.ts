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
