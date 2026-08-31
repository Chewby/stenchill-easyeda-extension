/**
 * The dialog's size.
 *
 * `eda.sys_IFrame.openIFrame` takes the height as an argument and the SDK
 * exposes NO way to resize afterwards, checked on 2026-08-31 against
 * `SYS_IFrame`, which offers open, close, hide, show and nothing else. One
 * height therefore has to fit every state the page can be in.
 *
 * That is why it includes room for the update band, which is only there when a
 * newer version exists. An earlier design sized the window per open, from an
 * answer the page had stored on a previous run. It worked from the second open
 * onwards and never on the first, because the context that opens the window
 * has no network access and could not ask for itself. Thirty-four pixels of
 * headroom buys the same result with no storage, no stale answer, and no first
 * open behaving differently from the rest.
 *
 * The footer stays reachable whatever happens: it is `position: sticky` at the
 * bottom, so the Generate button never scrolls out of reach even if some
 * future state does overflow.
 */

export const DIALOG_WIDTH = 555;

/**
 * 690 for the form and its result, plus 34 for the update band.
 *
 * Not a guess: 724 is the height the dynamic version computed for its second
 * open, and that window was looked at and judged right on 2026-08-31. Slack on
 * top of it was tried and rejected the same day, it showed as empty space with
 * nothing in it.
 */
export const DIALOG_HEIGHT = 724;
