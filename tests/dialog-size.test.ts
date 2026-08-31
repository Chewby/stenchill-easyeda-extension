import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOG_HEIGHT, DIALOG_WIDTH, UPDATE_BAND_HEIGHT, UPDATE_LATEST_KEY } from '../src/dialog-size';

/**
 * The dialog's height is decided by `index.ts`, which opens the window, and
 * consumed by `iframe-app.ts`, which fills it. The two files never see each
 * other's numbers, so the constants live in one module and this test checks
 * that neither side went back to a literal.
 *
 * The failure this guards against is quiet: a scrollbar, on a rare screen,
 * that nobody connects back to a number.
 */
const ENTRY = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const IFRAME = readFileSync(new URL('../src/iframe-app.ts', import.meta.url), 'utf8');

describe('the dialog size contract', () => {
	it('opens the window through the shared constants, not literals', () => {
		expect(ENTRY).toContain('DIALOG_WIDTH');
		expect(ENTRY).toContain('DIALOG_HEIGHT');
		expect(ENTRY).toContain('UPDATE_BAND_HEIGHT');
		expect(ENTRY).not.toMatch(/openIFrame\([^)]*\b\d{3}\b/);
	});

	// One key, written on one side and read on the other. Two separate literals
	// would leave the answer stored under a name nobody reads back, so a window
	// that never grows and a band that never shows.
	it('reads and writes the answer under one key', () => {
		expect(ENTRY).toContain('UPDATE_LATEST_KEY');
		expect(IFRAME).toContain('UPDATE_LATEST_KEY');
		expect(UPDATE_LATEST_KEY).toBe('updateLatest');
	});

	/**
	 * The entry point must NOT check for a new version, and that is a
	 * measurement rather than a preference.
	 *
	 * The check was tried there first, because `openIFrame` takes the height as
	 * an argument and nothing can change it afterwards, so that is the only
	 * moment the window can be made taller for the band. It never returned
	 * anything: that execution context has no network access, while the
	 * iframe's does. Confirmed against the running client on 2026-08-31, by the
	 * only signal available from outside it, the first open scrolling and the
	 * second not.
	 *
	 * Putting the call back would cost every menu click a wait for an answer
	 * that never comes, and would not make the first open any taller.
	 */
	it('does not ask for a version before opening, only reads what the page found', () => {
		expect(ENTRY).not.toMatch(/\bfetchLatestVersion\(/);
		expect(ENTRY).toMatch(/getExtensionUserConfig\(UPDATE_LATEST_KEY\)/);
	});

	/**
	 * The page READS the stored answer before it ever asks for itself.
	 *
	 * Not an optimisation: the stored answer is what sized the window, and an
	 * answer fetched first could differ from it, leaving a band that no longer
	 * matches the space reserved for it.
	 */
	it('reads the stored answer before it ever asks for itself', () => {
		const read = IFRAME.indexOf('getExtensionUserConfig(UPDATE_LATEST_KEY)');
		const ask = IFRAME.search(/\bfetchLatestVersion\(/);
		expect(read, 'la page ne lit pas la reponse stockee').toBeGreaterThan(-1);
		expect(ask, 'la page ne sait plus demander').toBeGreaterThan(-1);
		expect(read).toBeLessThan(ask);
	});

	// La page doit ECRIRE ce qu'elle trouve : c'est la seule source qui puisse
	// dimensionner l'ouverture suivante, le point d'entree ne pouvant pas
	// demander.
	it('has the page store what it found, for the next open', () => {
		expect(IFRAME).toMatch(/setExtensionUserConfig\(UPDATE_LATEST_KEY/);
	});

	it('keeps the band height positive and the window plausible', () => {
		expect(UPDATE_BAND_HEIGHT).toBeGreaterThan(0);
		expect(DIALOG_WIDTH).toBeGreaterThan(300);
		expect(DIALOG_HEIGHT).toBeGreaterThan(400);
	});
});
