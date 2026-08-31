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

	// 724 is not a rounded figure: it is the height the dynamic version
	// computed for its second open, the one that was looked at and judged
	// good. An EXACT value and not a floor, so that widening it on a hunch
	// has to be defended in review.
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

	/**
	 * And PUSHES it there, which is a different thing.
	 *
	 * `position: sticky` only engages once the content overflows. On a window
	 * taller than its content, which is the normal case now that the height
	 * has room for the update band, the footer stayed glued to the last field
	 * with empty space underneath. The full-height flex column plus
	 * `margin-top: auto` is what puts it at the very bottom.
	 *
	 * `border-box` is not decoration either: without it the body's padding
	 * adds to the 100vh and creates the very overflow this avoids.
	 */
	it('pushes the footer down on a window taller than its content', () => {
		expect(PAGE).toMatch(/body \{[^}]*min-height: 100vh/);
		expect(PAGE).toMatch(/body \{[^}]*box-sizing: border-box/);
		expect(PAGE).toMatch(/body \{[^}]*flex-direction: column/);
		expect(PAGE).toMatch(/#form \{[^}]*flex: 1/);
		expect(PAGE).toMatch(/footer \{[^}]*margin-top: auto/);
	});

	/**
	 * The help badge must stay ROUND.
	 *
	 * It sets 15 x 15 and `border-radius: 50%`, but the `button` rule in the
	 * same document imposes `padding: 6px 13px`. In border-box, 13px on each
	 * side make a 28px width floor for a 15px height, and the badge came out
	 * as an ellipse. A purely visual defect no logic test could see, hence
	 * this guard on the stylesheet.
	 */
	it('keeps the help badge round', () => {
		const brut = /\.info \{[^}]*\}/.exec(PAGE)?.[0] ?? '';
		expect(brut, '.info introuvable').not.toBe('');
		// The COMMENTS are stripped before the assertion. Without that the
		// guard guarded nothing: the rule's comment spells out « padding: 0 »
		// in full to explain why it is there, so the assertion matched the
		// prose and stayed green after the real declaration was deleted. Seen
		// NOT to go red under mutation, which is the only way to notice.
		const regle = brut.replaceAll(/\/\*[\s\S]*?\*\//g, '');
		expect(regle).toMatch(/padding:\s*0\s*;/);
		expect(regle).toMatch(/width:\s*15px\s*;/);
		expect(regle).toMatch(/height:\s*15px\s*;/);
	});

	/**
	 * The Generate button must come back NO MATTER WHAT at startup.
	 *
	 * It is disabled at parse time so that slow storage does not overwrite
	 * user input. Re-enabling it from a `finally` and not after the `await`s
	 * is what stops a rejection from `applyLanguage` condemning it forever:
	 * the red panel would show, and the window's only useful action would be
	 * dead.
	 *
	 * A TEXTUAL guard, and that is an accepted weakness: `iframe-app.ts` calls
	 * `eda`, so it is not runnable outside the client. This is exactly what
	 * extracting a pure-DOM `src/form.ts` would make properly testable. In the
	 * meantime this guard beats nothing: the mutation that removes the
	 * `finally` makes no other test go red.
	 */
	it('re-enables the Generate button from a finally, never from a straight line', () => {
		const sansCommentaires = IFRAME.replaceAll(/\/\/[^\n]*/g, '').replaceAll(/\/\*[\s\S]*?\*\//g, '');
		// ANCHORED on the startup block, between the button being disabled and
		// the version check. Without that anchor, the assertion matched the
		// `finally` of `run()`, which also re-enables the button: it therefore
		// stayed green after the startup one was deleted. Seen NOT to go red
		// under mutation.
		// `lastIndexOf` and NOT `indexOf`: `input('go').disabled = true` first
		// appears in `run()`, well before the startup block, and the anchor
		// picked up that occurrence. The slice then covered half the file and
		// caught any `finally` at all, so it stayed green after the startup one
		// was deleted. Second writing of this guard, and the second time it
		// took a mutation to notice.
		const debut = sansCommentaires.lastIndexOf('input(\'go\').disabled = true');
		const fin = sansCommentaires.indexOf('checkForUpdate()', debut);
		expect(debut, 'startup block not found').toBeGreaterThan(-1);
		expect(fin, 'end of the startup block not found').toBeGreaterThan(debut);
		expect(sansCommentaires.slice(debut, fin)).toMatch(/finally\s*\{/);
	});

	// The entry point has NO network access, measured on 2026-08-31 against the
	// client: the first open after a new version scrolled, the second did not,
	// which can only happen if it is the page doing the asking. Putting a call
	// back there would cost a wait on every menu click for an answer that never
	// arrives.
	it('leaves the asking to the page, which is the only side with a network', () => {
		expect(ENTRY).not.toMatch(/\bfetchLatestVersion\(/);
		expect(IFRAME).toMatch(/\bfetchLatestVersion\(/);
	});
});
