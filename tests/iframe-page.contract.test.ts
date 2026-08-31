/**
 * The contracts of `iframe/index.html` that only the real client can judge.
 *
 * This file exists for one reason: the test suite READS the page, it never
 * SERVES it. Anything about how the client resolves a URL inside it is
 * therefore invisible here, and a broken page ships with every test green.
 *
 * Same shape as `api-key.test.ts`, and for the same reason: pinning the exact
 * string is the only net available when the contract itself cannot be
 * reproduced from the repository.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(new URL('../iframe/index.html', import.meta.url), 'utf8');

describe('the page and the real client', () => {
	/**
	 * The script path is ABSOLUTE, and nothing in the repository can prove it.
	 *
	 * Made relative on 2026-08-31 for consistency with the neighbouring
	 * `<img src="../images/...">`, on the reasoning that since the image
	 * resolves, the base must be `/iframe/`. The client serves the page from
	 * another base: `app.js` 404ed, no script ran at all, and EVERY button in
	 * the dialog was dead. The suite stayed green throughout, all 138 of them.
	 *
	 * The image and the script are NOT resolved against the same base. Do not
	 * "harmonise" them.
	 */
	it('loads its bundle through an ABSOLUTE path', () => {
		expect(HTML).toContain('<script src="/iframe/app.js">');
	});

	/**
	 * The other half of the same rule, and it needs its own case: a guard that
	 * only checked for the absolute string would still pass if a second,
	 * relative script tag were added beside it.
	 */
	it('carries no relative script tag at all', () => {
		const relatives = [...HTML.matchAll(/<script\s+src="(?!\/)([^"]+)"/g)].map(m => m[1]);
		expect(relatives).toEqual([]);
	});
});
