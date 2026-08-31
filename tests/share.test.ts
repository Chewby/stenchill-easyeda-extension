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
	it('accepts production', () => {
		expect(isTrustedViewUrl('https://stenchill.com/view/abc')).toBe(true);
		expect(isTrustedViewUrl('https://www.stenchill.com/view/abc')).toBe(true);
	});

	it('accepts a local link ONLY when hitting a local backend', () => {
		const local = 'http://localhost:8080/api/v1';
		expect(isTrustedViewUrl('http://localhost:4200/view/abc', local)).toBe(true);
		expect(isTrustedViewUrl('http://127.0.0.1:8080/view/abc', local)).toBe(true);
	});

	it('refuses a local link when hitting PRODUCTION', () => {
		// Otherwise a compromised server could redirect the user back to their
		// own machine, and the link would be opened without a second thought.
		expect(isTrustedViewUrl('http://localhost:4200/view/abc')).toBe(false);
		expect(isTrustedViewUrl('http://127.0.0.1:8080/view/abc')).toBe(false);
	});

	it('refuses a foreign host that CONTAINS ours', () => {
		// The trap: the string contains "stenchill.com", the parsed host does not.
		expect(isTrustedViewUrl('https://evil.com/?x=stenchill.com')).toBe(false);
		expect(isTrustedViewUrl('https://stenchill.com.evil.com/view/abc')).toBe(false);
	});

	it('refuses http in production and what is not a URL', () => {
		expect(isTrustedViewUrl('http://stenchill.com/view/abc')).toBe(false);
		expect(isTrustedViewUrl('not a url')).toBe(false);
	});
});

describe('buildParamsJson', () => {
	it('carries the schema version and the parameters', () => {
		const parsed = JSON.parse(buildParamsJson(DEFAULT_PARAMS));
		expect(parsed.v).toBe(1);
		expect(parsed.thickness).toBe(0.4);
		expect(parsed.enableSlotify).toBe(true);
	});
});

describe('injectParams', () => {
	it('adds the parameters file without losing the gerbers', async () => {
		const out = await injectParams(await makeZip(), DEFAULT_PARAMS);
		const archive = await JSZip.loadAsync(await out.arrayBuffer());
		expect(Object.keys(archive.files).sort()).toEqual(['front.gtp', 'stenchill-params.json']);
		expect(await archive.file('front.gtp')!.async('string')).toBe('G04*');
	});
});

describe('shareStencil', () => {
	it('posts the ZIP and returns the share URL', async () => {
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

	it('refuses an untrusted URL returned by the server', async () => {
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

	it('throws when the response carries no URL', async () => {
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
describe('the share deadline ceiling', () => {
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

	it('passes a signal to fetch even when the caller supplies none', async () => {
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
	it('honours the caller cancellation', async () => {
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

describe('isTrustedViewUrl and the local base', () => {
	/**
	 * `baseUrl` was read as a SUBSTRING. A `baseUrl` of
	 * `https://localhost.exemple.com/api` contains « localhost » without being
	 * local, and so reopened the door to the user's 127.0.0.1. The function is
	 * exported and documented as a generic guard: it must not depend on
	 * today's constant being well behaved.
	 */
	it('refuses a local link when the base merely CONTAINS localhost', () => {
		expect(isTrustedViewUrl('http://127.0.0.1:4200/view/x', 'https://localhost.exemple.com/api/v1')).toBe(false);
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'https://notlocalhost.com/api/v1')).toBe(false);
	});

	it('still accepts a local link on a REAL local base', () => {
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'http://localhost:8080/api/v1')).toBe(true);
		expect(isTrustedViewUrl('http://127.0.0.1:4200/view/x', 'http://127.0.0.1:8080/api/v1')).toBe(true);
	});

	it('refuses when the base is unreadable', () => {
		expect(isTrustedViewUrl('http://localhost:4200/view/x', 'not a url')).toBe(false);
	});
});
