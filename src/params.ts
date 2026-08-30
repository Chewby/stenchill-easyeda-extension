export interface GenerationParams {
	thickness: number;
	shrink: number;
	nozzleDiameter: number;
	pcbThickness: number;
	shoulderLength: number;
	shoulderWidth: number;
	shoulderClearance: number;
	enableShoulders: boolean;
	enableSlotify: boolean;
	dropUnprintableGrids: boolean;
}

export const DEFAULT_PARAMS: GenerationParams = {
	thickness: 0.4,
	shrink: 0,
	nozzleDiameter: 0.4,
	pcbThickness: 1.6,
	shoulderLength: 15,
	shoulderWidth: 3,
	shoulderClearance: 0.3,
	enableShoulders: true,
	enableSlotify: true,
	// true like on both of the server's entry points: a fine-pitch grid
	// whose walls fall below the nozzle comes out as a puddle if left open.
	dropUnprintableGrids: true,
};

/**
 * Interface bounds, stricter than the server's.
 *
 * Exported so that `tests/form.contract.test.ts` compares the HTML to
 * THIS constant and not to a copy: a copy has no source of truth, it
 * creates a second one, and the test then compares itself to itself.
 */
export const BOUNDS: Record<string, [number, number]> = {
	thickness: [0.1, 0.6],
	shrink: [-0.2, 0.3],
	nozzleDiameter: [0.1, 0.8],
	pcbThickness: [0.4, 3.2],
	shoulderLength: [1, 200],
	shoulderWidth: [0.5, 8],
	shoulderClearance: [0, 1],
};

export function clampParams(input: Partial<GenerationParams>): GenerationParams {
	const out = { ...DEFAULT_PARAMS };
	for (const key of Object.keys(DEFAULT_PARAMS) as (keyof GenerationParams)[]) {
		const fallback = DEFAULT_PARAMS[key];
		const value = input[key];
		if (typeof fallback === 'boolean') {
			(out[key] as boolean) = typeof value === 'boolean' ? value : fallback;
			continue;
		}
		const bounds = BOUNDS[key];
		if (!bounds) {
			// A numeric field added to DEFAULT_PARAMS without its entry in
			// BOUNDS would make `bounds[0]` throw, and the iframe would die
			// while loading the form. We take the default rather than crash
			// on a configuration oversight.
			(out[key] as number) = fallback;
			continue;
		}
		const num = typeof value === 'number' ? value : Number.NaN;
		if (!Number.isFinite(num)) {
			(out[key] as number) = fallback;
			continue;
		}
		(out[key] as number) = Math.min(Math.max(num, bounds[0]), bounds[1]);
	}
	return out;
}

/** Field names are the API's, in camelCase. */
export function toFormFields(params: GenerationParams): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(params)) {
		// String(true) already renders "true" in lowercase, which is what the API expects.
		fields[key] = String(value);
	}
	return fields;
}
