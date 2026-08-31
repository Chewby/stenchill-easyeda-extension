import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIALOG_HEIGHT, DIALOG_WIDTH } from '../src/dialog-size';

/**
 * One height has to fit every state the page can be in, because `openIFrame`
 * takes it as an argument and the SDK cannot resize afterwards.
 *
 * An earlier design sized the window per open, from an answer the page had
 * stored on a previous run. It worked from the second open onwards and never
 * on the first, the context that opens the window having no network access of
 * its own. Headroom in the constant buys the same result with no storage, no
 * stale answer, and no first open behaving differently from the rest.
 */
const ENTRY = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const IFRAME = readFileSync(new URL('../src/iframe-app.ts', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('../iframe/index.html', import.meta.url), 'utf8');

describe('the dialog size contract', () => {
	it('opens the window through the shared constants, not literals', () => {
		expect(ENTRY).toMatch(/openIFrame\([^)]*DIALOG_WIDTH[^)]*DIALOG_HEIGHT/);
	});

	// 724 n'est pas un arrondi : c'est la hauteur que la version dynamique
	// calculait pour sa seconde ouverture, celle qui a ete regardee et jugee
	// bonne. Valeur EXACTE et non plancher, pour qu'un elargissement au juge
	// se defende en revue.
	it('keeps headroom for the update band', () => {
		expect(DIALOG_WIDTH).toBe(555);
		expect(DIALOG_HEIGHT).toBe(724);
	});

	/**
	 * The footer must stay reachable whatever the page ends up containing.
	 *
	 * It is the last line of defence: if some future state overflows anyway,
	 * the Generate button must not scroll out of reach, and the user must not
	 * have to discover that the window scrolls at all.
	 */
	it('pins the footer to the bottom', () => {
		expect(PAGE).toMatch(/footer \{[^}]*position: sticky/);
		expect(PAGE).toMatch(/footer \{[^}]*bottom: 0/);
	});

	// Le point d'entree n'a PAS d'acces reseau, mesure le 2026-08-31 contre le
	// client : la premiere ouverture apres une nouvelle version defilait, la
	// seconde non, ce qui ne peut arriver que si c'est la page qui demande. Y
	// remettre un appel couterait une attente a chaque clic de menu pour une
	// reponse qui n'arrive jamais.
	it('leaves the asking to the page, which is the only side with a network', () => {
		expect(ENTRY).not.toMatch(/\bfetchLatestVersion\(/);
		expect(IFRAME).toMatch(/\bfetchLatestVersion\(/);
	});
});
