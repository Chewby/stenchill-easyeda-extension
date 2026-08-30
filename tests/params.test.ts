import { describe, expect, it } from 'vitest';
import { clampParams, DEFAULT_PARAMS, toFormFields } from '../src/params';

describe('clampParams', () => {
	it('rend les defauts quand on ne lui donne rien', () => {
		expect(clampParams({})).toEqual(DEFAULT_PARAMS);
	});

	it('ramene une valeur hors bornes dans les bornes', () => {
		expect(clampParams({ thickness: 99 }).thickness).toBe(0.6);
		expect(clampParams({ thickness: 0 }).thickness).toBe(0.1);
	});

	it('remplace une valeur non finie par le defaut', () => {
		expect(clampParams({ nozzleDiameter: Number.NaN }).nozzleDiameter).toBe(0.4);
	});

	it('rend le defaut pour un champ numerique SANS borne declaree', () => {
		// A field added to DEFAULT_PARAMS without its entry in BOUNDS made
		// `bounds[0]` throw, and the iframe died while loading the form.
		const withNewField = { ...DEFAULT_PARAMS, futureField: 3 } as never;
		expect(() => clampParams(withNewField)).not.toThrow();
	});

	it('rend le defaut sur NaN, et ne le borne PAS au minimum', () => {
		// The trap this test pins down: Number('') is 0, which is finite. If
		// the empty field arrived here as 0, it would be clamped to 0.1 mm
		// instead of falling back to 0.4. It is readNumber that returns NaN,
		// and it is that NaN that must trigger the default.
		expect(clampParams({ thickness: Number.NaN }).thickness).toBe(0.4);
		expect(clampParams({ thickness: 0 }).thickness).toBe(0.1);
	});

	it('garde un booleen et ignore ce qui n en est pas un', () => {
		expect(clampParams({ enableShoulders: false }).enableShoulders).toBe(false);
		expect(clampParams({ enableShoulders: 'oui' as never }).enableShoulders).toBe(true);
	});
});

describe('toFormFields', () => {
	it('ecrit les booleens en minuscules', () => {
		const fields = toFormFields(clampParams({ enableSlotify: false }));
		expect(fields.enableSlotify).toBe('false');
		expect(fields.enableShoulders).toBe('true');
	});

	it('emet exactement les dix champs que l API attend', () => {
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
