/**
 * The contract between the interface and its dictionaries.
 *
 * `src/i18n.ts` keys translations by their ENGLISH TEXT, which keeps the
 * markup readable and degrades to English when an entry is missing. The price
 * of that choice is that an edit to `index.html` silently stops matching its
 * entry, and nothing on screen says so: the label simply stays English.
 *
 * These tests are what makes that impossible. They re-extract the strings from
 * the REAL `iframe/index.html` rather than from a copy, so a reworded label
 * fails here on the next run.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zhHans from '../locales/zh-Hans.json';
import { DICTS } from '../src/dicts';

const HTML = readFileSync(new URL('../iframe/index.html', import.meta.url), 'utf8');
const BODY = HTML.slice(HTML.indexOf('<body'));

/**
 * Strings the interface shows that are NOT language: brand names, a separator,
 * the badge's single letter. Translating them would be noise.
 */
const NOT_LANGUAGE = new Set(['stenchill.com', '☕ Ko-fi', 'PayPal', '·', 'i']);

function markupStrings(): string[] {
	const found: string[] = [];
	for (const m of BODY.matchAll(/>([^<>]{2,})</g)) {
		const text = m[1].trim().replaceAll(/\s+/g, ' ');
		if (text && !NOT_LANGUAGE.has(text) && !/^[\s\d.,:;/|()[\]{}=+*-]+$/.test(text))
			found.push(text);
	}
	for (const m of BODY.matchAll(/(?:data-tip|aria-label|placeholder|title|alt)="([^"]{2,})"/g))
		found.push(m[1]);
	return [...new Set(found)];
}

/** The literals handed to `t(...)` in the two files that call it. */
function codeStrings(): string[] {
	const found: string[] = [];
	for (const file of ['../src/iframe-app.ts', '../src/index.ts']) {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');
		for (const m of source.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g))
			found.push(m[1]);
		for (const m of source.matchAll(/\btranslate\(dict, '((?:[^'\\]|\\.)*)'/g))
			found.push(m[1]);
		// The file's only indirection: `setDismiss` receives the KEY and
		// translates it itself, so that the type union locks the two possible
		// values. Its argument is therefore not a `t(...)` literal and the sweep
		// does not see it. We name it here rather than pretend it does not
		// exist: without this line, 'Cancel' looked like a dead entry, which it
		// is not.
		for (const m of source.matchAll(/\bsetDismiss\('((?:[^'\\]|\\.)*)'/g))
			found.push(m[1]);
	}
	return [...new Set(found)];
}

describe('the dictionaries cover the interface', () => {
	it('has an English entry for every string in the markup', () => {
		const missing = markupStrings().filter(s => !(s in en));
		expect(missing, 'absentes de locales/en.json').toEqual([]);
	});

	it('has an English entry for every string the code translates', () => {
		const missing = codeStrings().filter(s => !(s in en));
		expect(missing, 'absentes de locales/en.json').toEqual([]);
	});

	// The converse matters as much: an entry nothing displays any more still
	// gets translated, still gets read in review, and lies about what the
	// interface contains.
	it('has no entry that nothing displays any more', () => {
		const shown = new Set([...markupStrings(), ...codeStrings()]);
		const orphans = Object.keys(en).filter(k => !shown.has(k));
		expect(orphans, 'entrees mortes de locales/en.json').toEqual([]);
	});

	it('translates every English entry into Chinese, and nothing else', () => {
		expect(Object.keys(zhHans)).toEqual(Object.keys(en));
	});

	// English is the SOURCE language: its value is its key. A drift there would
	// be a typo, and it would show on screen exactly as typed.
	it('keeps the English file an identity', () => {
		const drifted = Object.entries(en).filter(([k, v]) => k !== v);
		expect(drifted).toEqual([]);
	});

	/**
	 * `${1}` is a slot for a value. A translation that drops one prints a
	 * sentence with a hole in it, and one that invents another prints a raw
	 * `${2}` on screen. Neither throws.
	 */
	it('keeps the same placeholders in Chinese as in English', () => {
		const slots = (s: string) => [...s.matchAll(/\$\{\d+\}/g)].map(m => m[0]).sort();
		const broken = Object.keys(en)
			.filter(k => slots(k).join() !== slots((zhHans as Record<string, string>)[k]).join());
		expect(broken).toEqual([]);
	});

	it('exposes both dictionaries under the codes pickDict looks up', () => {
		expect(Object.keys(DICTS).sort()).toEqual(['en', 'zh-Hans']);
	});
});
