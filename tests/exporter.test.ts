import { describe, expect, it, vi } from 'vitest';
import { exportPasteGerbers, LAYER_BOARD_OUTLINE, LAYER_BOTTOM_PASTE, LAYER_TOP_PASTE } from '../src/exporter';

function fakeEda(file: File | undefined) {
	return {
		pcb_ManufactureData: { getGerberFile: vi.fn(async () => file) },
	};
}

const zip = new File([new Uint8Array([80, 75])], 'x.zip', { type: 'application/zip' });

describe('exportPasteGerbers', () => {
	it('demande les trois calques de pate et de contour', async () => {
		const eda = fakeEda(zip);
		await exportPasteGerbers(eda);
		const args = eda.pcb_ManufactureData.getGerberFile.mock.calls[0];
		expect(args[5]).toEqual([
			{ layerId: LAYER_TOP_PASTE, isMirror: false },
			{ layerId: LAYER_BOTTOM_PASTE, isMirror: false },
			{ layerId: LAYER_BOARD_OUTLINE, isMirror: false },
		]);
	});

	it('ne filtre AUCUN type d objet', async () => {
		// Filtering on Pad would silently drop paste drawn as a filled zone:
		// the generation would succeed with an incomplete stencil.
		const eda = fakeEda(zip);
		await exportPasteGerbers(eda);
		expect(eda.pcb_ManufactureData.getGerberFile.mock.calls[0][6]).toBeUndefined();
	});

	it('exporte en millimetres', async () => {
		const eda = fakeEda(zip);
		await exportPasteGerbers(eda);
		expect(eda.pcb_ManufactureData.getGerberFile.mock.calls[0][2]).toBe('mm');
	});

	it('leve quand EasyEDA ne rend aucun fichier', async () => {
		await expect(exportPasteGerbers(fakeEda(undefined))).rejects.toThrow(/no gerber/i);
	});
});
