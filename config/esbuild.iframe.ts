/**
 * Second output: the iframe page's code.
 *
 * The iframe is a DOCUMENT separate from the extension bundle, so it cannot
 * import `dist/index.js`. Our tested modules (params, sse, api-client,
 * exporter) are therefore bundled a second time into `iframe/app.js`, which
 * the page loads via a script tag. The produced file is generated, it is
 * in the .gitignore.
 */
import process from 'node:process';
import esbuild from 'esbuild';
import { IFRAME_BUILD_OPTIONS } from './iframe-build.ts';

(async () => {
	await esbuild.build(IFRAME_BUILD_OPTIONS);
	process.exit();
})();
