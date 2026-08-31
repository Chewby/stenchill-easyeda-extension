import { describe, expect, it } from 'vitest';
import { API_KEY, DEFAULT_BASE_URL } from '../src/api-client';

/**
 * These two constants are a CONTRACT with the server, and no other test
 * touches them: they all inject their own value as a parameter, which is
 * good for their isolation but leaves the real value without any guard at all.
 *
 * Measured on 2026-08-30: a MADE-UP key produced an HTTP 401 in production
 * while all 28 tests were green. A test that pins the exact string is the
 * only possible safety net here.
 *
 * The key is NOT a secret, it is a priority marker shared with the KiCad
 * plugin (see `plugin-kicad/api_client.py`).
 */
describe('contract with the server', () => {
	it('carries the priority key the server accepts', () => {
		expect(API_KEY).toBe('stenchill-kicad-2026-xK9mP4wQ7rT2');
	});

	it('targets production on the plugin path', () => {
		expect(DEFAULT_BASE_URL).toBe('https://www.stenchill.com/api/v1');
	});
});
