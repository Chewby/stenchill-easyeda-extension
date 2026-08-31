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
 * It holds the latest published version as a string, or null when there is
 * nothing newer. The check runs in the entry point, BEFORE the window opens,
 * because that is the only moment its height can still be chosen; the iframe
 * then reads the answer instead of asking again, which also keeps the whole
 * feature down to one network call.
 */
export const UPDATE_LATEST_KEY = 'updateLatest';

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
