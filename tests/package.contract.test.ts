import { describe, expect, it } from 'vitest';
import { getPackageFileList } from '../build/utils';

/**
 * What the published `.eext` contains, pinned.
 *
 * `.edaignore` is a DENYLIST, so anything added at the repo root ships by
 * default and nothing says so. Measured on 2026-08-31, that had already
 * happened twice in one evening: the previous release's own `.eext` (196 KB
 * of dead weight, and a read/write race on the same path in dev mode), then
 * `.github/workflows/ci.yml` and Sonar's `.scannerwork/` working directory.
 * The latter carries no credential, contrary to what this comment first
 * claimed: `report-task.txt` holds a project key, a task id and the URL of
 * an INTERNAL server. Internal information leaking out of a published
 * package is reason enough; saying "token" was reason and a half, and this
 * file's own neighbour already warns that a wrong comment gets paid for
 * later.
 *
 * A denylist cannot be made complete, so the guard is on the OUTPUT: this
 * list is the inventory, and adding to it is a gesture that has to be
 * defended in review.
 */
const SHIPPED = [
	'CHANGELOG.md',
	'LICENSE',
	'README.md',
	'dist/index.js',
	'extension.json',
	'iframe/app.js',
	'iframe/index.html',
	'images/logo.png',
	'images/stenchill.png',
	'locales/en.json',
	'locales/extensionJson/en.json',
	'locales/extensionJson/zh-Hans.json',
	'locales/zh-Hans.json',
];

const ROOT = new URL('..', import.meta.url).pathname;

describe('the packaged file list', () => {
	function built(): string[] {
		return getPackageFileList(ROOT).map(f => f.replaceAll('\\', '/')).sort();
	}

	/**
	 * `dist/index.js` and `iframe/app.js` are GENERATED and gitignored, so they
	 * are absent from a fresh clone. The first version of this test tolerated
	 * that for one of them and not for the other, which turned CI red on its
	 * very first run and made `npm test` fail for every new contributor.
	 *
	 * The answer is NOT to make them optional: a package shipped without its
	 * interface would then pass green. `pretest` is what builds them, so this
	 * test always runs against a complete package, locally as in CI.
	 */
	it('ships exactly what it should, and nothing else', () => {
		expect(built()).toEqual([...SHIPPED].sort());
	});

	/**
	 * The costliest trap: a release archive left at the root ended up INSIDE
	 * the next one. There was no symptom at all, the package installs and works
	 * with that dead weight inside, only its size changed.
	 */
	it('never ships an archive inside the archive', () => {
		expect(built().filter(f => f.endsWith('.eext'))).toEqual([]);
	});

	// Sonar's working directory carries an analysis report. It has no business
	// in a published package, and nothing excluded it.
	it('never ships the Sonar working directory or the CI definition', () => {
		expect(built().filter(f => f.startsWith('.scannerwork') || f.startsWith('.github'))).toEqual([]);
	});
});
