import { describe, expect, it, vi } from 'vitest';
import { fetchLatestVersion, isNewer } from '../src/api-client';

describe('fetchLatestVersion', () => {
	it('lit la cle latest', async () => {
		const doFetch = vi.fn(async () => new Response('{"latest":"1.2.0"}', { status: 200 }));
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA'),
		).toBe('1.2.0');
	});

	it('rend null sur un 404, sans lever', async () => {
		const doFetch = vi.fn(async () => new Response('', { status: 404 }));
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA'),
		).toBeNull();
	});

	it('rend null quand le reseau echoue, sans lever', async () => {
		const doFetch = vi.fn(async () => {
			throw new Error('offline');
		});
		expect(
			await fetchLatestVersion(doFetch as unknown as typeof fetch, 'https://x.test/api/v1', 'UA'),
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
