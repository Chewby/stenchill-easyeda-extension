// Values from EPCB_LayerId. The SDK's enum is an ambient declaration,
// so nothing guarantees the global at runtime: we pin the values.
export const LAYER_TOP_PASTE = 7;
export const LAYER_BOTTOM_PASTE = 8;
export const LAYER_BOARD_OUTLINE = 11;

interface EdaLike {
	pcb_ManufactureData: {
		getGerberFile: (
			fileName?: string,
			colorSilkscreen?: boolean,
			unit?: ESYS_Unit.MILLIMETER | ESYS_Unit.INCH,
			digitalFormat?: { integerNumber: number; decimalNumber: number },
			other?: {
				metallicDrillingInformation: boolean;
				nonMetallicDrillingInformation: boolean;
				drillTable: boolean;
				flyingProbeTestingFile: boolean;
			},
			layers?: Array<{ layerId: number; isMirror: boolean }>,
			// The SDK's exact list, and not string[]: it's what makes the
			// type compatible with the real `eda` object. We never PASS this
			// argument, but its type must match.
			objects?: ('Pad' | 'Via' | 'Track' | 'Text' | 'Image' | 'Dimension'
				| 'BoardOutline' | 'BoardCutout' | 'CopperFilled' | 'SolidRegion'
				| 'FPCStiffener' | 'Line' | 'PlaneZone' | 'ComponentProperty'
				| 'ComponentSilkscreen' | 'TearDrop')[],
		) => Promise<File | undefined>;
	};
}

/**
 * Returns the ZIP of the paste layers and the outline.
 *
 * We restrict the LAYERS to avoid sending a full export, but we
 * deliberately pass no OBJECT list: paste hand-drawn as a filled zone is
 * not a `Pad`, and filtering it out would produce an incomplete stencil
 * with no message at all. Sorting that out is the engine's job.
 */
export async function exportPasteGerbers(eda: EdaLike): Promise<File> {
	const file = await eda.pcb_ManufactureData.getGerberFile(
		'stenchill',
		false,
		'mm' as ESYS_Unit.MILLIMETER,
		{ integerNumber: 4, decimalNumber: 6 },
		{
			metallicDrillingInformation: false,
			nonMetallicDrillingInformation: false,
			drillTable: false,
			flyingProbeTestingFile: false,
		},
		[
			{ layerId: LAYER_TOP_PASTE, isMirror: false },
			{ layerId: LAYER_BOTTOM_PASTE, isMirror: false },
			{ layerId: LAYER_BOARD_OUTLINE, isMirror: false },
		],
	);
	if (!file) {
		throw new Error('EasyEDA returned no gerber file for this board');
	}
	return file;
}
