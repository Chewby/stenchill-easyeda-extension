import { describe, expect, it } from 'vitest';
import { clampParams, DEFAULT_PARAMS, toFormFields } from '../src/params';

describe('clampParams', () => {
	it('returns the defaults when given nothing', () => {
		expect(clampParams({})).toEqual(DEFAULT_PARAMS);
	});

	it('brings an out-of-bounds value back within the bounds', () => {
		expect(clampParams({ thickness: 99 }).thickness).toBe(0.6);
		expect(clampParams({ thickness: 0 }).thickness).toBe(0.1);
	});

	it('replaces a non-finite value with the default', () => {
		expect(clampParams({ nozzleDiameter: Number.NaN }).nozzleDiameter).toBe(0.4);
	});

	it('returns the default for a numeric field WITHOUT declared bounds', () => {
		// A field added to DEFAULT_PARAMS without its entry in BOUNDS made
		// `bounds[0]` throw, and the iframe died while loading the form.
		const withNewField = { ...DEFAULT_PARAMS, futureField: 3 } as never;
		expect(() => clampParams(withNewField)).not.toThrow();
	});

	it('returns the default on NaN, and does NOT clamp it to the minimum', () => {
		// The trap this test pins down: Number('') is 0, which is finite. If
		// the empty field arrived here as 0, it would be clamped to 0.1 mm
		// instead of falling back to 0.4. It is readNumber that returns NaN,
		// and it is that NaN that must trigger the default.
		expect(clampParams({ thickness: Number.NaN }).thickness).toBe(0.4);
		expect(clampParams({ thickness: 0 }).thickness).toBe(0.1);
	});

	it('keeps a boolean and ignores what is not one', () => {
		expect(clampParams({ enableShoulders: false }).enableShoulders).toBe(false);
		expect(clampParams({ enableShoulders: 'oui' as never }).enableShoulders).toBe(true);
	});
});

describe('toFormFields', () => {
	it('writes the booleans in lowercase', () => {
		const fields = toFormFields(clampParams({ enableSlotify: false }));
		expect(fields.enableSlotify).toBe('false');
		expect(fields.enableShoulders).toBe('true');
	});

	it('emits exactly the ten fields the API expects', () => {
		expect(Object.keys(toFormFields(DEFAULT_PARAMS)).sort()).toEqual([
			'dropUnprintableGrids',
			'enableShoulders',
			'enableSlotify',
			'nozzleDiameter',
			'pcbThickness',
			'shoulderClearance',
			'shoulderLength',
			'shoulderWidth',
			'shrink',
			'thickness',
		]);
	});
});
