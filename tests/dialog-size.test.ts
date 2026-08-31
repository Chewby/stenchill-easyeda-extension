import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOG_HEIGHT, DIALOG_WIDTH, UPDATE_BAND_HEIGHT, UPDATE_PENDING_KEY } from '../src/dialog-size';

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

	// Les deux cotes lisent la meme clef de stockage : ecrite d'un cote, relue
	// de l'autre. Deux litteraux distincts laisseraient le drapeau ecrit sous
	// un nom que personne ne relit, donc une fenetre qui ne grandit jamais.
	it('reads and writes the flag under one key', () => {
		expect(ENTRY).toContain('UPDATE_PENDING_KEY');
		expect(IFRAME).toContain('UPDATE_PENDING_KEY');
		expect(UPDATE_PENDING_KEY).toBe('updatePending');
	});

	it('keeps the band height positive and the window plausible', () => {
		expect(UPDATE_BAND_HEIGHT).toBeGreaterThan(0);
		expect(DIALOG_WIDTH).toBeGreaterThan(300);
		expect(DIALOG_HEIGHT).toBeGreaterThan(400);
	});
});
