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
