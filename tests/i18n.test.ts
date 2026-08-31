// @vitest-environment happy-dom
import type { Dict } from '../src/i18n';
import { describe, expect, it } from 'vitest';
import { format, localizeDocument, pickDict, resolveDict, siteLocale, translate } from '../src/i18n';

const ZH: Dict = {
	'Quit': '退出',
	'Saved as ${1}': '已保存为 ${1}',
	'Step ${1} of ${2}': '第 ${1} 步，共 ${2} 步',
	'Like it?': '喜欢吗？',
	'Share link': '分享链接',
};
const DICTS = { 'en': {}, 'zh-Hans': ZH };

describe('format', () => {
	it('substitutes in the order of the placeholders, not of the arguments', () => {
		expect(format('${2} then ${1}', ['a', 'b'])).toBe('b then a');
	});

	it('leaves a placeholder alone when its argument is missing', () => {
		// An `undefined` printed on screen says nothing; the placeholder, on the
		// other hand, says a value was expected there.
		expect(format('Step ${1} of ${2}', [3])).toBe('Step 3 of ${2}');
	});

	it('accepts numbers as well as strings', () => {
		expect(format('${1}/${2}', [2, 5])).toBe('2/5');
	});
});

describe('translate', () => {
	it('falls back to the English source when the entry is missing', () => {
		expect(translate(ZH, 'Generate Stencil')).toBe('Generate Stencil');
	});

	it('substitutes into the TRANSLATED text and not into the source', () => {
		expect(translate(ZH, 'Saved as ${1}', 'board.zip')).toBe('已保存为 board.zip');
	});
});

describe('pickDict', () => {
	it('matches Chinese on its prefix, so zh-Hant and zh-CN are served too', () => {
		// Serving simplified Chinese to a zh-Hant reader beats serving them
		// English.
		for (const code of ['zh-Hans', 'zh-Hant', 'zh-CN', 'ZH'])
			expect(pickDict(code, DICTS), code).toBe(ZH);
	});

	it('falls back to English on any other language, and on none at all', () => {
		for (const code of ['en', 'en-GB', 'fr', '', null, undefined])
			expect(pickDict(code, DICTS)).toBe(DICTS.en);
	});
});

describe('resolveDict', () => {
	it('reads the host language', async () => {
		expect(await resolveDict(() => 'zh-Hans', DICTS)).toBe(ZH);
	});

	it('awaits a promise, the host answering asynchronously', async () => {
		expect(await resolveDict(async () => 'zh-Hans', DICTS)).toBe(ZH);
	});

	// A failure must return English and NOT throw: a broken language lookup
	// must not cost the user their stencil.
	it('falls back to English when the host throws', async () => {
		const throwing = (): string => {
			throw new Error('no host');
		};
		expect(await resolveDict(throwing, DICTS)).toBe(DICTS.en);
	});

	it('falls back to English when the host rejects', async () => {
		const rejecting = async (): Promise<string> => {
			throw new Error('no host');
		};
		expect(await resolveDict(rejecting, DICTS)).toBe(DICTS.en);
	});
});

describe('localizeDocument', () => {
	function page(body: string): HTMLElement {
		const root = document.createElement('div');
		root.innerHTML = body;
		return root;
	}

	it('translates a plain text node', () => {
		const root = page('<button>Quit</button>');
		localizeDocument(root, ZH);
		expect(root.querySelector('button')!.textContent).toBe('退出');
	});

	/**
	 * This job's trap: `Like it? <a>Ko-fi</a>` carries a text node whose FINAL
	 * space separates the sentence from the link. An implementation that
	 * replaces `node.data` with the bare translation runs the two words
	 * together, and the defect shows up only on screen.
	 */
	it('preserves the whitespace around a text node', () => {
		const root = page('<span>Like it? <a href="#">Ko-fi</a></span>');
		localizeDocument(root, ZH);
		expect(root.querySelector('span')!.innerHTML).toBe('喜欢吗？ <a href="#">Ko-fi</a>');
	});

	it('translates the attributes a human reads', () => {
		const root = page('<a aria-label="Share link">x</a>');
		localizeDocument(root, ZH);
		expect(root.querySelector('a')!.getAttribute('aria-label')).toBe('分享链接');
	});

	it('leaves untranslated text exactly as it was', () => {
		const root = page('<h1>Generate Stencil</h1>');
		localizeDocument(root, ZH);
		expect(root.querySelector('h1')!.textContent).toBe('Generate Stencil');
	});

	it('does not touch an attribute it has no entry for', () => {
		const root = page('<img alt="Stenchill" />');
		localizeDocument(root, ZH);
		expect(root.querySelector('img')!.getAttribute('alt')).toBe('Stenchill');
	});

	/**
	 * The content of a <style> or a <script> is CODE, never language.
	 *
	 * The body of these elements is deliberately REDUCED to a dictionary key,
	 * and that is what makes the test valid: the substitution compares the
	 * WHOLE text node, so a realistic CSS such as `.a::after{content:"Quit"}`
	 * matches nothing and would stay intact even without the guard. An early
	 * version of the test used that CSS: it stayed green once the guard was
	 * removed, so it proved nothing.
	 *
	 * The guard is therefore DEFENSIVE, a real stylesheet being one single big
	 * text node. It costs two lines and closes the door.
	 */
	it('never rewrites the inside of a style or a script', () => {
		const root = page('<style>Quit</style><script>Quit</script>');
		localizeDocument(root, ZH);
		expect(root.querySelector('style')!.textContent).toBe('Quit');
		expect(root.querySelector('script')!.textContent).toBe('Quit');
	});

	it('is a no-op with an empty dictionary', () => {
		const before = '<button>Quit</button>';
		const root = page(before);
		localizeDocument(root, {});
		expect(root.innerHTML).toBe(before);
	});
});

describe('siteLocale', () => {
	/**
	 * The site speaks eighteen languages, this extension speaks two. The link
	 * can therefore be more precise than the dialog around it: a German reader
	 * sees an English interface, but there is no reason to hand them an English
	 * page when a German one exists.
	 */
	it('sends a reader to their own page when the site has one', () => {
		expect(siteLocale('de')).toBe('de');
		expect(siteLocale('fr')).toBe('fr');
		expect(siteLocale('ja')).toBe('ja');
	});

	// The host answers `zh-Hans`, the site serves `zh`. Matching the whole
	// string would silently send every Chinese reader to the English page.
	it('matches on the prefix, the host answering regional codes', () => {
		expect(siteLocale('zh-Hans')).toBe('zh');
		expect(siteLocale('pt-BR')).toBe('pt');
		expect(siteLocale('EN-GB')).toBe('en');
	});

	it('falls back to English for a language the site does not serve', () => {
		for (const code of ['vi', 'th', 'ar', '', null, undefined])
			expect(siteLocale(code)).toBe('en');
	});
});
