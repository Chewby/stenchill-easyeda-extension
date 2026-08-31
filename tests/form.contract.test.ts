import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUNDS, DEFAULT_PARAMS } from '../src/params';

/**
 * The HTML form duplicates the bounds and defaults from `params.ts`.
 *
 * <p>This is the last duplication in the project, and the only one whose
 * divergence would be SILENT on the user's side: the field would display one
 * bound, and `clampParams` would apply another. The user would see their
 * input accepted by the browser and then corrected without a word.</p>
 *
 * <p>The duplication cannot be removed: the `min`, `max` and `value`
 * attributes must live in the HTML for the browser to do its job, and the
 * HTML is not a TypeScript module. This test is therefore what keeps them in
 * sync, the same way `version.contract.test.ts` keeps the three versions in
 * sync.</p>
 */
const HTML = readFileSync(new URL('../iframe/index.html', import.meta.url), 'utf8');

function attributesOf(id: string): Record<string, string> {
	const tag = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(HTML);
	expect(tag, `field ${id} missing from the form`).not.toBeNull();
	const attributes: Record<string, string> = {};
	for (const [, name, value] of tag![0].matchAll(/([a-z]+)="([^"]*)"/g)) {
		attributes[name] = value;
	}
	return attributes;
}

describe('the form and params.ts', () => {
	it.each(Object.keys(BOUNDS))('%s carries the same bounds on both sides', (id) => {
		const attributes = attributesOf(id);
		const [min, max] = BOUNDS[id];
		expect(Number(attributes.min), `min of ${id}`).toBe(min);
		expect(Number(attributes.max), `max of ${id}`).toBe(max);
	});

	it.each(Object.keys(BOUNDS))('%s displays the default value from the code', (id) => {
		const shown = Number(attributesOf(id).value);
		expect(shown).toBe(DEFAULT_PARAMS[id as keyof typeof DEFAULT_PARAMS]);
	});

	it('checks the three boxes whose default is true', () => {
		for (const id of ['enableShoulders', 'enableSlotify', 'dropUnprintableGrids']) {
			// `checked` is a BARE attribute in the HTML: extraction by
			// key="value" pairs cannot see it, it has to be looked up on the
			// raw tag.
			const tag = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(HTML)![0];
			const checked = /\schecked\b/.test(tag);
			expect(checked, `${id} devrait etre coche`).toBe(
				DEFAULT_PARAMS[id as keyof typeof DEFAULT_PARAMS],
			);
		}
	});
});
