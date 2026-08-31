/**
 * The dialog's size, and the one thing that changes it.
 *
 * `eda.sys_IFrame.openIFrame` takes the height as an argument and the SDK
 * exposes NO way to resize afterwards (checked on 2026-08-31 against
 * `SYS_IFrame`, which offers open, close, hide, show and nothing else). The
 * height is therefore decided before the page that knows whether the update
 * band will show even exists.
 *
 * Hence the flag: the iframe records what its version check found, and the
 * next open reads it back. The consequence is worth stating plainly, because
 * it is a real limitation and not an oversight: the FIRST open after a new
 * version appears is still the short one, so it scrolls once. Every open after
 * that is tall enough, and the window shrinks back on its own once the update
 * is installed and the check stops finding anything.
 *
 * Both values live here rather than in the two files that use them: they are a
 * contract between the extension entry point, which sizes the window, and the
 * iframe, which fills it. Apart they would drift, and the symptom would be a
 * scrollbar nobody connects back to a number.
 */

/** Key under which the last version check's verdict is kept. */
export const UPDATE_PENDING_KEY = 'updatePending';

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
