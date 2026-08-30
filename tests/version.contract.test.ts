import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';

/**
 * The version lives in TWO places: `extension.json`, which EasyEDA reads for
 * the package, and `src/version.ts`, which the code reads for the user agent
 * and the update check.
 *
 * They cannot be merged: the iframe bundle cannot import the manifest, which
 * lives outside `src/`. This test is therefore the only thing keeping them in
 * sync. Without it, a version bump in the manifest would leave the code
 * announcing the old one, and the generation history, which is our adoption
 * measurement channel, would lie.
 */
function read(name: string): { version: string; license: string } {
	return JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
}

describe('la version, aux TROIS endroits ou elle vit', () => {
	it('est la meme dans le code et dans le manifeste', () => {
		expect(VERSION).toBe(read('extension.json').version);
	});

	it('est la meme dans package.json', () => {
		// Forgotten by the first version of this test: it had stayed at
		// 1.6.19, the SDK template's version, while the other two said
		// 26.8.1. A contract that covers only two of the three places leaves
		// exactly the third one to drift.
		expect(read('package.json').version).toBe(VERSION);
	});

	it('porte la meme licence partout', () => {
		// The project once announced three at once: MIT in package.json,
		// Apache-2.0 in extension.json, and an Apache-2.0 LICENSE file.
		expect(read('package.json').license).toBe('MIT');
		expect(read('extension.json').license).toBe('MIT');
		expect(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'))
			.toContain('MIT License');
	});
});
