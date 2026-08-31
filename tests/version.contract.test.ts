import { existsSync, readFileSync } from 'node:fs';
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

describe('the version, in the FOUR places where it lives', () => {
	it('is the same in the code and in the manifest', () => {
		expect(VERSION).toBe(read('extension.json').version);
	});

	it('is the same in package.json', () => {
		// Forgotten by the first version of this test: it had stayed at
		// 1.6.19, the SDK template's version, while the other two said
		// 26.8.1. A contract that covers only two of the three places leaves
		// exactly the third one to drift.
		expect(read('package.json').version).toBe(VERSION);
	});

	/**
	 * Sonar attributes each analysis to a version. Frozen, the whole history
	 * piles up under the same label and a regression stops being datable. This
	 * fourth place is not in a JSON, so it is read line by line: exactly the
	 * kind of place one forgets to bump.
	 */
	it('is the same in sonar-project.properties', () => {
		// This file exists ONLY in the monorepo: it carries the URL of an
		// internal server, so it is excluded from the public repository the
		// releases ship from. Its absence is not an oversight, it is the file's
		// scope, and this case therefore does not apply over there.
		//
		// This is a conditional skip, which this project normally refuses: the
		// same reflex applied to `iframe/app.js` would have let through a
		// package shipped without its interface. The difference lies in the
		// CAUSE of the absence. `iframe/app.js` is missing transiently, before
		// a build, and we know how to trigger it; this one is missing by
		// construction, permanently, in a repository where Sonar does not run.
		const url = new URL('../sonar-project.properties', import.meta.url);
		if (!existsSync(url))
			return;
		const text = readFileSync(url, 'utf8');
		const line = /^sonar\.projectVersion=(.+)$/m.exec(text);
		expect(line, 'sonar.projectVersion absent').not.toBeNull();
		expect(line![1].trim()).toBe(VERSION);
	});

	it('carries the same licence everywhere', () => {
		// The project once announced three at once: MIT in package.json,
		// Apache-2.0 in extension.json, and an Apache-2.0 LICENSE file.
		expect(read('package.json').license).toBe('MIT');
		expect(read('extension.json').license).toBe('MIT');
		expect(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'))
			.toContain('MIT License');
	});
});
