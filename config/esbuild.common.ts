import type esbuild from 'esbuild';

export default {
	entryPoints: {
		index: './src/index',
	},
	entryNames: '[name]',
	assetNames: '[name]',
	bundle: true, // Used by internal method calls, do not modify.
	minify: false, // Used by internal method calls, do not modify.
	loader: {},
	outdir: './dist/',
	sourcemap: undefined,
	platform: 'browser', // Used by internal method calls, do not modify.
	format: 'iife', // Used by internal method calls, do not modify.
	globalName: 'edaEsbuildExportName', // Used by internal method calls, do not modify.
	treeShaking: true,
	ignoreAnnotations: true,
	define: {},
	external: [],
} satisfies Parameters<(typeof esbuild)['build']>[0];
