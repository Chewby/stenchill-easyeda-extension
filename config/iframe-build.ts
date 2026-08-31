import type { BuildOptions } from 'esbuild';

/**
 * The build options for the iframe page's code, in ONE place.
 *
 * `config/esbuild.iframe.ts` builds it once for `npm run build`, and
 * `build/dev.ts` watches it for `npm run debug`. The two carried the same
 * seven options copied side by side, plus a comment saying they must not
 * drift and nothing that checked it. Sharing the object is cheaper than the
 * test that would have watched the copy.
 *
 * The paths are relative to the working directory, not to this file: both
 * entry points are launched from the repository root by npm.
 */
export const IFRAME_BUILD_OPTIONS: BuildOptions = {
	entryPoints: { app: './src/iframe-app' },
	bundle: true,
	minify: false,
	outdir: './iframe/',
	platform: 'browser',
	format: 'iife',
	treeShaking: true,
};
