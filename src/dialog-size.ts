/**
 * The dialog's size, and the one thing that changes it.
 *
 * `eda.sys_IFrame.openIFrame` takes the height as an argument and the SDK
 * exposes NO way to resize afterwards (checked on 2026-08-31 against
 * `SYS_IFrame`, which offers open, close, hide, show and nothing else). The
 * height is therefore decided before the page that knows whether the update
 * band will show even exists.
 *
 * So the check runs BEFORE the window opens, in the entry point, and its
 * answer is handed to the iframe through storage. An earlier version had the
 * iframe check for itself and remember the verdict for NEXT time, which meant
 * the first open after a new version appeared still scrolled. Asking first
 * costs a short wait on the menu click and removes that case entirely.
 *
 * Both values live here rather than in the two files that use them: they are a
 * contract between the extension entry point, which sizes the window, and the
 * iframe, which fills it. Apart they would drift, and the symptom would be a
 * scrollbar nobody connects back to a number.
 */

/**
 * Key under which the version check leaves its answer for the iframe.
 *
 * The value is `{ checked, latest }`, and the first field is what makes the
 * whole thing robust. `checked` says the entry point actually got an answer,
 * `latest` carries it, null meaning nothing newer.
 *
 * Why the distinction matters: the entry point and the iframe are two
 * DIFFERENT execution contexts, and the extension one has never been shown to
 * reach the network. The iframe's has, repeatedly. So the entry point tries,
 * and says whether it succeeded; when it did not, the page falls back to
 * asking for itself rather than showing nothing. A single `latest: null` could
 * not tell "nothing newer" from "could not ask", and the second silently
 * became the first.
 */
export const UPDATE_LATEST_KEY = 'updateLatest';

/** What the entry point leaves behind for the page. */
export interface UpdateAnswer {
	/** True when the check ran and returned something, right or wrong. */
	checked: boolean;
	/** The newer version, or null when there is none. */
	latest: string | null;
}

/** The dialog with nothing special to say. */
export const DIALOG_WIDTH = 555;
export const DIALOG_HEIGHT = 690;

/**
 * What the update band costs, measured on its own styling: 3 + 3 of padding,
 * 2 of border, one line at 11.5px over 1.5, and 6 - 2 of margin. Rounded up,
 * because a window a few pixels too tall shows nothing while one a few pixels
 * too short shows a scrollbar.
 */
export const UPDATE_BAND_HEIGHT = 34;
