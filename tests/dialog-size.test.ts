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
	 * The check must run in the ENTRY POINT, and that is not a preference:
	 * `openIFrame` takes the height as an argument and nothing can change it
	 * afterwards, so a check made inside the page always arrives after the
	 * height is settled. An earlier version did exactly that, and the first
	 * open after a new version appeared still scrolled.
	 */
	it('asks before opening, on a deadline short enough for a menu click', () => {
		// On asserte sur l'APPEL et sur son argument, pas sur les mots : les deux
		// noms figurent aussi dans le commentaire au-dessus, et une assertion sur
		// le mot nu restait verte alors que l'appel employait le plafond long.
		// Vu ne PAS rougir a la mutation, ce qui est la seule facon de s'en
		// apercevoir.
		expect(ENTRY).toMatch(/fetchLatestVersion\([\s\S]*?PREOPEN_VERSION_TIMEOUT_MS[\s\S]*?\)/);
	});

	/**
	 * The page READS first and only asks when the entry point could not.
	 *
	 * The fallback exists because the two files run in different execution
	 * contexts, and the extension one has never been shown to reach the
	 * network while the iframe's has. But it must stay a fallback: if the page
	 * asked first, the answer could differ from the one that sized the window,
	 * and the band would no longer match the space reserved for it.
	 */
	it('reads the stored answer before it ever asks for itself', () => {
		const read = IFRAME.indexOf('getExtensionUserConfig(UPDATE_LATEST_KEY)');
		const ask = IFRAME.search(/\bfetchLatestVersion\(/);
		expect(read, 'la page ne lit pas la reponse stockee').toBeGreaterThan(-1);
		expect(ask, 'la page ne sait plus demander').toBeGreaterThan(-1);
		expect(read).toBeLessThan(ask);
	});

	it('keeps the band height positive and the window plausible', () => {
		expect(UPDATE_BAND_HEIGHT).toBeGreaterThan(0);
		expect(DIALOG_WIDTH).toBeGreaterThan(300);
		expect(DIALOG_HEIGHT).toBeGreaterThan(400);
	});
});
