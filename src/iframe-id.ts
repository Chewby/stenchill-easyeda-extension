/**
 * The plugin window's identifier.
 *
 * Shared between `index.ts`, which opens it, and `iframe-app.ts`, which
 * closes it from its Quit button. The two are compiled into SEPARATE
 * bundles, so the constant must live in a third-party file: if copied on
 * both sides, a drift would make the closing fail silently.
 */
export const IFRAME_ID = 'stenchill-main';
