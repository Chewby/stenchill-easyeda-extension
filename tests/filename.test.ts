import { describe, expect, it } from 'vitest';
import { stencilFileName } from '../src/filename';

const at = new Date(2026, 7, 30, 20, 19, 22); // August 30, 2026, 20:19:22 local

describe('stencilFileName', () => {
	it('joint le nom du projet et l horodatage', () => {
		expect(stencilFileName('torture-test', at)).toBe('torture-test_20260830_201922.zip');
	});

	it('remplit les champs a deux chiffres', () => {
		expect(stencilFileName('x', new Date(2026, 0, 5, 4, 3, 2))).toBe('x_20260105_040302.zip');
	});

	it('remplace ce qu un systeme de fichiers refuse', () => {
		expect(stencilFileName('mon projet/v2', at)).toBe('mon_projet_v2_20260830_201922.zip');
	});

	it('retombe sur stencil quand le nom ne laisse rien', () => {
		// Without this fallback, we would produce " _20260830_201922.zip".
		expect(stencilFileName('///', at)).toBe('stencil_20260830_201922.zip');
		expect(stencilFileName(null, at)).toBe('stencil_20260830_201922.zip');
		expect(stencilFileName(undefined, at)).toBe('stencil_20260830_201922.zip');
	});

	it('borne la longueur du nom de projet', () => {
		const name = stencilFileName('a'.repeat(200), at);
		expect(name).toBe(`${'a'.repeat(60)}_20260830_201922.zip`);
	});
});

/**
 * Non-ASCII project names, measured on 2026-08-31 and NOT deduced.
 *
 * The three defects the previous cleanup had, all reproduced before being
 * fixed. They mattered here more than anywhere: an EasyEDA project name is
 * Chinese far more often than not.
 *
 *   'Carte Émetteur' -> Carte_E_metteur   (NFKD splits É into E + a combining
 *                                          accent, and the accent is not \w,
 *                                          so it became an underscore INSIDE
 *                                          the word)
 *   '电路板设计'      -> stencil           (the whole name vanished)
 *   'ПЛАТА-2'        -> -2                (and it starts with a dash, which
 *                                          the leading trim did not remove)
 */
describe('non-ASCII project names', () => {
	const AT = new Date(2026, 7, 30, 20, 19, 22);

	it('strips the accent instead of cutting the word in half', () => {
		expect(stencilFileName('Carte Émetteur', AT)).toBe('Carte_Emetteur_20260830_201922.zip');
	});

	// Latin transcription is NOT the goal: we do not transliterate, we keep the
	// letters as they are. It is the name the user chose, and every common
	// filesystem accepts it.
	it('keeps a Chinese name whole rather than falling back to "stencil"', () => {
		expect(stencilFileName('电路板设计', AT)).toBe('电路板设计_20260830_201922.zip');
	});

	it('keeps a Cyrillic name whole', () => {
		expect(stencilFileName('плата', AT)).toBe('плата_20260830_201922.zip');
	});

	it('never returns a name that starts with a dash', () => {
		expect(stencilFileName('ПЛАТА-2', AT)).toBe('ПЛАТА-2_20260830_201922.zip');
		expect(stencilFileName('---nom', AT)).toBe('nom_20260830_201922.zip');
	});

	it('still falls back when nothing at all survives', () => {
		expect(stencilFileName('///', AT)).toBe('stencil_20260830_201922.zip');
	});

	// The separator dot stays forbidden at the head as at the tail, and the
	// characters a filesystem refuses stay replaced.
	it('still replaces what a filesystem refuses', () => {
		expect(stencilFileName('a/b:c*d', AT)).toBe('a_b_c_d_20260830_201922.zip');
	});
});
