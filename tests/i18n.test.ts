import type { Dict } from '../src/i18n';
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { format, localizeDocument, pickDict, resolveDict, translate } from '../src/i18n';

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
		// Un `undefined` imprime a l'ecran ne dit rien ; l'emplacement, lui, dit
		// qu'une valeur etait attendue la.
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
		// Servir du chinois simplifie a un lecteur de zh-Hant vaut mieux que de
		// lui servir de l'anglais.
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

	// L'echec doit rendre l'anglais et NON lever : une recherche de langue
	// cassee ne doit pas couter son pochoir a l'utilisateur.
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
	 * Le piege du chantier : `Like it? <a>Ko-fi</a>` porte un noeud de texte
	 * dont l'espace FINAL separe la phrase du lien. Une implementation qui
	 * remplace `node.data` par la traduction nue colle les deux mots, et le
	 * defaut ne se voit qu'a l'ecran.
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

	it('is a no-op with an empty dictionary', () => {
		const before = '<button>Quit</button>';
		const root = page(before);
		localizeDocument(root, {});
		expect(root.innerHTML).toBe(before);
	});
});
