// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BOOL_FIELDS, el, input, NUMBER_FIELDS, readForm, readNumber, writeForm } from '../src/form';
import { DEFAULT_PARAMS } from '../src/params';

/** Builds the fields the form reads, and nothing else. */
function mountForm(): void {
	document.body.innerHTML = [
		...NUMBER_FIELDS.map(id => `<input id="${id}" type="number">`),
		...BOOL_FIELDS.map(id => `<input id="${id}" type="checkbox">`),
	].join('');
}

describe('el', () => {
	it('throws on a missing element rather than returning null', () => {
		// The caller would otherwise fail later, on a property of `null`, far
		// from the id that is actually wrong.
		document.body.innerHTML = '';
		expect(() => el('absent')).toThrow(/absent/);
	});
});

describe('readNumber, the empty-versus-zero trap', () => {
	it('reads an empty field as NaN and NOT as zero', () => {
		// This is the whole point of the module. `Number('')` is 0, which is
		// finite, so `clampParams` would clamp it to the minimum instead of
		// falling back to the default.
		mountForm();
		input('thickness').value = '';
		expect(readNumber('thickness')).toBeNaN();
	});

	it('still reads a typed zero as zero', () => {
		// The other side of the same rule: refusing the empty field must not
		// refuse a deliberate 0, which is a legal value for `shrink`.
		mountForm();
		input('shrink').value = '0';
		expect(readNumber('shrink')).toBe(0);
	});

	it('reads a comma as a decimal separator', () => {
		mountForm();
		input('thickness').value = '0,3';
		expect(readNumber('thickness')).toBe(0.3);
	});
});

describe('readForm', () => {
	it('falls back to the default on an empty field instead of clamping to the minimum', () => {
		// The user-visible defect this module exists for: an emptied
		// thickness field used to hand back 0.1 mm, the lower bound.
		mountForm();
		writeForm(DEFAULT_PARAMS);
		input('thickness').value = '';
		expect(readForm().thickness).toBe(DEFAULT_PARAMS.thickness);
	});

	it('clamps a value that is out of bounds', () => {
		mountForm();
		writeForm(DEFAULT_PARAMS);
		input('thickness').value = '99';
		expect(readForm().thickness).toBe(0.6);
	});

	it('reads the checkboxes as booleans', () => {
		mountForm();
		writeForm(DEFAULT_PARAMS);
		input('enableShoulders').checked = false;
		input('enableSlotify').checked = true;
		const params = readForm();
		expect(params.enableShoulders).toBe(false);
		expect(params.enableSlotify).toBe(true);
	});
});

describe('writeForm', () => {
	it('round-trips every field the form carries', () => {
		// The guard against a field added to one loop and forgotten in the
		// other: a missing id would leave its input empty, and `readForm`
		// would hand back the default instead of what was written.
		mountForm();
		const params = { ...DEFAULT_PARAMS, thickness: 0.5, shrink: 0.1, enableSlotify: false };
		writeForm(params);
		expect(readForm()).toEqual(params);
	});
});
