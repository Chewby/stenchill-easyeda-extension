/**
 * Translation of the extension interface.
 *
 * The KEY IS THE ENGLISH TEXT, not a symbolic identifier. Two consequences,
 * and both are the reason for the choice: `iframe/index.html` stays readable
 * in plain English with no `data-i18n` attributes to keep in sync, and a
 * missing entry degrades to English instead of showing a bare tag. It is the
 * same convention the EasyEDA scaffold ships in `locales/`, and the same one
 * `eda.sys_I18n.text()` follows when a tag is unknown.
 *
 * The counterpart of that choice is that an edit to the HTML silently stops
 * matching its entry. `tests/i18n.contract.test.ts` is what makes that
 * impossible: it re-extracts the strings from the real `index.html` and fails
 * on any string absent from the dictionaries, and on any dictionary entry that
 * nothing displays any more.
 *
 * Leaf module: it knows nothing of `eda`, so it is testable outside the host.
 */

export type Dict = Record<string, string>;

/**
 * Substitutes `${1}`, `${2}`... the way the host's `sys_I18n.text` does.
 *
 * A missing argument leaves its placeholder ALONE rather than printing
 * `undefined`: the placeholder at least says a value was expected there.
 */
export function format(template: string, args: ReadonlyArray<string | number>): string {
	return template.replaceAll(/\$\{(\d+)\}/g, (whole, index: string) => {
		const value = args[Number(index) - 1];
		return value === undefined ? whole : String(value);
	});
}

/** Translates, falling back to the English source. */
export function translate(dict: Dict, text: string, ...args: ReadonlyArray<string | number>): string {
	return format(dict[text] ?? text, args);
}

/**
 * Chooses the dictionary for a host language.
 *
 * Matched on the PREFIX: the host answers `zh-Hans`, but `zh-Hant` and `zh-CN`
 * exist too, and serving simplified Chinese to a reader of any of them beats
 * serving English. Anything else falls back to English, which is the source
 * language and therefore never missing.
 */
export function pickDict(language: string | null | undefined, dicts: Record<string, Dict>): Dict {
	const code = (language ?? '').toLowerCase();
	if (code.startsWith('zh'))
		return dicts['zh-Hans'] ?? {};
	return dicts.en ?? {};
}

/**
 * Resolves the dictionary for the host's current language.
 *
 * The language getter is INJECTED rather than read from `eda` here, so this
 * module stays a leaf and the fallback path is testable without the host.
 *
 * Any failure falls back to English, which is the source language and
 * therefore can never be missing. The failure is silent on purpose: a broken
 * language lookup must not cost the user their stencil.
 */
export async function resolveDict(
	getLanguage: () => Promise<string> | string,
	dicts: Record<string, Dict>,
): Promise<Dict> {
	try {
		return pickDict(await getLanguage(), dicts);
	}
	catch {
		return dicts.en ?? {};
	}
}

/** Attributes that carry text a human reads. `alt` is included, empty ones are skipped. */
const TRANSLATED_ATTRIBUTES = ['data-tip', 'aria-label', 'placeholder', 'title', 'alt'] as const;

/**
 * Translates a document in place.
 *
 * Surrounding whitespace is PRESERVED around each text node. Without this,
 * `Like it? <a>Ko-fi</a>` loses the space before the link and the two words
 * run together, a defect that shows up only in the rendered page.
 */
export function localizeDocument(root: Document | HTMLElement, dict: Dict): void {
	const doc = 'ownerDocument' in root && root.ownerDocument ? root.ownerDocument : (root as Document);
	const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
	const nodes: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode())
		nodes.push(node as Text);

	for (const node of nodes) {
		const raw = node.data;
		const trimmed = raw.trim();
		if (!trimmed)
			continue;
		const translated = dict[trimmed];
		if (translated === undefined)
			continue;
		const lead = raw.slice(0, raw.indexOf(trimmed));
		const tail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
		node.data = lead + translated + tail;
	}

	const elements = Array.from((root as HTMLElement).querySelectorAll?.('*') ?? []);
	for (const element of elements) {
		for (const name of TRANSLATED_ATTRIBUTES) {
			const value = element.getAttribute(name);
			if (!value)
				continue;
			const translated = dict[value.trim()];
			if (translated !== undefined)
				element.setAttribute(name, translated);
		}
	}
}
