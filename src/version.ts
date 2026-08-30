/**
 * The extension's version, in ONE single place.
 *
 * Read by `index.ts` for the update check and the "About" box, and by
 * `iframe-app.ts` for the user agent sent to the server, which is the
 * adoption-measurement channel. If copied elsewhere, it would drift and
 * the generation history would report a version that isn't the one
 * running.
 *
 * Must stay in sync with the `version` field of extension.json.
 */
export const VERSION = '26.8.1';

/**
 * The user agent sent to the server, in ONE single place.
 *
 * It used to be rebuilt by interpolation in three places. It is the
 * plugin's adoption-measurement channel: three write sites are three
 * chances that only one changes and the count silently splits in two.
 */
export const USER_AGENT = `Stenchill-EasyEDA/${VERSION}`;
