import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import fs from 'fs-extra';
// `WebSocket` imported from `ws` and not the global one: the global is not
// guaranteed on the Node 20.17 that `engines` declares.
import { WebSocket, WebSocketServer } from 'ws';

import common from '../config/esbuild.common.ts';
import { IFRAME_BUILD_OPTIONS } from '../config/iframe-build.ts';
import rawExtensionConfig from '../extension.json' with { type: 'json' };

import { fixUuid, packageExtension, testUuid } from './utils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBSOCKET_PORT = 59394;
// build/dist, like packaged.ts, and above all OUTSIDE the packaged tree. At the
// root, the previous build's .eext ended up in the list of files to zip: the
// package grew on every pass, and worse, the old one's read stream ran while
// the new one's write stream truncated it, which produces a corrupted package
// in a non-deterministic way.
const DIST_DIR = path.join(__dirname, 'dist');
const ROOT_DIR = path.join(__dirname, '../');

// Process extension.json, making sure the UUID is valid (fixed only once, at startup)
function resolveExtensionConfig() {
	const extensionConfig = { ...rawExtensionConfig } as Record<string, unknown>;
	if (!testUuid(extensionConfig.uuid as string | undefined)) {
		delete extensionConfig.default;
		extensionConfig.uuid = fixUuid(extensionConfig.uuid as string | undefined);
		fs.writeJsonSync(path.join(__dirname, '../extension.json'), extensionConfig, { spaces: '\t', EOL: '\n', encoding: 'utf-8' });
		console.log('[Dev Mode] Fixed UUID in extension.json');
	}
	return extensionConfig;
}

const extensionConfig = resolveExtensionConfig();
const EEXT_FILENAME = `${extensionConfig.name}_v${extensionConfig.version}.eext`;
const EEXT_PATH = path.join(DIST_DIR, EEXT_FILENAME);

/**
 * Read the eext file and convert it to base64
 */
async function getEextBase64(): Promise<string> {
	const buffer = await fs.readFile(EEXT_PATH);
	return buffer.toString('base64');
}

/**
 * Push the eext file to every connected WebSocket client
 */
async function broadcastEext(wss: WebSocketServer): Promise<void> {
	let base64Content: string;
	try {
		base64Content = await getEextBase64();
	}
	catch (err) {
		console.error('[Dev Mode] Failed to read eext file:', err);
		return;
	}

	const message = JSON.stringify({
		type: 'file',
		topic: 'Dev Mode Extension Package Update',
		content: base64Content,
		fileName: EEXT_FILENAME,
		fileMimeType: 'application/octet-stream',
	});

	let clientCount = 0;
	wss.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message);
			clientCount++;
		}
	});
	console.log(`[Dev Mode] Pushed update to ${clientCount} client(s): ${EEXT_FILENAME}`);
}

/**
 * Main logic
 */
async function main() {
	// Make sure the dist directory exists
	fs.ensureDirSync(DIST_DIR);

	// Start the WebSocket server
	const wss = new WebSocketServer({ port: WEBSOCKET_PORT });
	console.log(`[Dev Mode] WebSocket server started: ws://localhost:${WEBSOCKET_PORT}`);

	wss.on('connection', async (ws) => {
		console.log('[Dev Mode] New client connected');

		// On a client's first connection, send the current latest eext file
		try {
			const base64Content = await getEextBase64();
			const message = JSON.stringify({
				type: 'file',
				topic: 'Dev Mode Extension Package Update',
				content: base64Content,
				fileName: EEXT_FILENAME,
				fileMimeType: 'application/octet-stream',
			});
			ws.send(message);
			console.log(`[Dev Mode] Sent current version to new client: ${EEXT_FILENAME}`);
		}
		catch (err) {
			console.error('[Dev Mode] Failed to send initial eext:', err);
		}

		ws.on('close', () => {
			console.log('[Dev Mode] Client disconnected');
		});
	});

	// Listen for the build-finished event: after an incremental build, package and push automatically
	let buildTimeout: NodeJS.Timeout | null = null;
	const rebuildPlugin = {
		name: 'rebuild-notify',
		setup(build: esbuild.PluginBuild) {
			build.onEnd((result) => {
				if (result.errors.length === 0) {
					// Debounce, to avoid firing several times in quick succession
					if (buildTimeout) {
						clearTimeout(buildTimeout);
					}
					buildTimeout = setTimeout(async () => {
						console.log('[Dev Mode] Change detected, repackaging...');
						try {
							await packageExtension(ROOT_DIR, EEXT_PATH);
							console.log('[Dev Mode] Repackaging complete');
							await broadcastEext(wss);
						}
						catch (err) {
							console.error('[Dev Mode] Repackaging failed:', err);
						}
					}, 300);
				}
			});
		},
	};

	// Create the context with the plugin
	const ctx = await esbuild.context({
		...common,
		plugins: [rebuildPlugin],
	});

	// The SECOND entry point, the one that carries the whole interface.
	//
	// `common` only builds `src/index`, so dev mode ignored `src/iframe-app.ts`
	// entirely: editing the interface triggered no rebuild, and on a fresh
	// clone `npm run debug` packaged an extension with NO `iframe/app.js` at
	// all, whose `<script src="/iframe/app.js">` 404s and leaves the dialog
	// blank. Worse, `src/i18n.ts` IS in the first graph, through `dicts` and
	// the update toast: editing a translation printed "Repackaging complete"
	// while changing nothing on screen. A success message that lies is worse
	// than no message.
	//
	// Same options as `npm run build`, shared through `IFRAME_BUILD_OPTIONS`
	// so the two cannot drift. Only the watch plugin is added here.
	const iframeCtx = await esbuild.context({
		...IFRAME_BUILD_OPTIONS,
		plugins: [rebuildPlugin],
	});

	// Initial build
	console.log('[Dev Mode] Starting initial build...');
	await ctx.rebuild();
	await iframeCtx.rebuild();
	console.log('[Dev Mode] Initial build complete');

	// Initial packaging
	console.log('[Dev Mode] Starting to package extension...');
	await packageExtension(ROOT_DIR, EEXT_PATH);
	// Start watching files
	await ctx.watch();
	// The plugin's 300 ms debounce absorbs both notifications when one file
	// belongs to the two graphs, which is the case for everything `src/` shares
	// between the extension and the iframe.
	await iframeCtx.watch();
	console.log('[Dev Mode] File watcher started, waiting for changes...');
}

main().catch((err) => {
	console.error('[Dev Mode] Error occurred:', err);
	process.exit(1);
});
