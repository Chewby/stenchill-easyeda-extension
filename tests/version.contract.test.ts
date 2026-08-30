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

describe('la version, aux QUATRE endroits ou elle vit', () => {
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

	/**
	 * Sonar attributes each analysis to a version. Frozen, the whole history
	 * piles up under the same label and a regression stops being datable. This
	 * fourth place is not in a JSON, so it is read line by line: exactly the
	 * kind of place one forgets to bump.
	 */
	it('est la meme dans sonar-project.properties', () => {
		// Ce fichier n'existe QUE dans le monorepo : il porte l'URL d'un serveur
		// interne, donc il est exclu du depot public d'ou partent les releases.
		// Son absence n'est pas un oubli, c'est le perimetre du fichier, et ce
		// cas ne s'applique donc pas la-bas.
		//
		// C'est un saut conditionnel, ce que ce projet refuse d'habitude : le
		// meme reflexe applique a `iframe/app.js` aurait laisse passer un paquet
		// livre sans son interface. La difference tient a la CAUSE de l'absence.
		// `iframe/app.js` manque transitoirement, avant une compilation, et on
		// sait la declencher ; celui-ci manque par construction, definitivement,
		// dans un depot ou Sonar ne tourne pas.
		const url = new URL('../sonar-project.properties', import.meta.url);
		if (!existsSync(url))
			return;
		const text = readFileSync(url, 'utf8');
		const line = /^sonar\.projectVersion=(.+)$/m.exec(text);
		expect(line, 'sonar.projectVersion absent').not.toBeNull();
		expect(line![1].trim()).toBe(VERSION);
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
