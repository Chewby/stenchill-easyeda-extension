import { describe, expect, it, vi } from 'vitest';
import { fetchLatestVersion, isNewer } from '../src/api-client';

describe('fetchLatestVersion', () => {
	it('lit la cle latest', async () => {
		const doFetch = vi.fn(async () => new Response('{"latest":"1.2.0"}', { status: 200 }));
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA', 'k'),
		).toBe('1.2.0');
	});

	it('rend null sur un 404, sans lever', async () => {
		const doFetch = vi.fn(async () => new Response('', { status: 404 }));
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA', 'k'),
		).toBeNull();
	});

	it('rend null quand le reseau echoue, sans lever', async () => {
		const doFetch = vi.fn(async () => {
			throw new Error('offline');
		});
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA', 'k'),
		).toBeNull();
	});
});

describe('isNewer', () => {
	it('compare champ par champ et pas en texte', () => {
		expect(isNewer('1.10.0', '1.9.0')).toBe(true);
		expect(isNewer('1.0.0', '1.0.0')).toBe(false);
		expect(isNewer('0.9.0', '1.0.0')).toBe(false);
	});

	it('rend false sur une version illisible', () => {
		expect(isNewer('pas-une-version', '1.0.0')).toBe(false);
	});
});

/**
 * The version check spent its first day silently doing nothing because it did
 * not send the API key: `/api/v1/**` is behind that key, so the route answered
 * 401, `response.ok` was false, and the function returned null. No error, no
 * log, no toast, and every install would have stayed on its version for ever.
 *
 * The failure mode is the point: this call is DESIGNED to fail silently, so
 * nothing on screen could ever have revealed the mistake. Only a test that
 * looks at what is actually sent can.
 */
describe('the version check sends what the route requires', () => {
	it('carries the API key', async () => {
		let seen: RequestInit | undefined;
		const doFetch = (async (_url: string, init: RequestInit) => {
			seen = init;
			return new Response('{"latest":"26.8.2"}', { status: 200 });
		}) as unknown as typeof fetch;
		await fetchLatestVersion(doFetch, 'https://x.test/api/v1', 'UA', 'the-key');
		expect((seen?.headers as Record<string, string>)['X-API-Key']).toBe('the-key');
	});

	it('asks the route dedicated to this extension, not the frozen legacy one', async () => {
		let url = '';
		const doFetch = (async (u: string) => {
			url = u;
			return new Response('{"latest":"26.8.2"}', { status: 200 });
		}) as unknown as typeof fetch;
		await fetchLatestVersion(doFetch, 'https://x.test/api/v1', 'UA', 'k');
		expect(url).toBe('https://x.test/api/v1/plugin/easyeda/version');
	});
});
