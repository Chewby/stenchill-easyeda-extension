import type { GenerationParams } from './params';
import JSZip from 'jszip';
import { DEFAULT_BASE_URL } from './api-client';

/**
 * Sharing the stencil: we send the Gerber ZIP back to the site, which
 * returns a `/view/...` URL that can be opened in a browser.
 *
 * The plugin is a channel to stenchill.com: this link is the mechanism,
 * not a workaround. We inject the generation parameters into it so the
 * page reproduces EXACTLY the stencil the user just got; without them,
 * `/view` would regenerate with its own defaults and would show a
 * different stencil than the one saved, which would be worse than no
 * link at all.
 */

export const PARAMS_FILENAME = 'stenchill-params.json';

/** Must stay in sync with `plugin-kicad/share_params.py` on the KiCad side. */
export const SCHEMA_VERSION = 1;

export function buildParamsJson(params: GenerationParams): string {
	return `${JSON.stringify({ v: SCHEMA_VERSION, ...params }, null, 2)}\n`;
}

/**
 * Returns a NEW blob: we do not mutate the ZIP the caller holds.
 *
 * We give JSZip a `Uint8Array` and ask it for one back, never a Blob: its
 * type detection depends on the environment, and it failed in the iframe
 * on 2026-08-30 with "Can't read the data of the loaded zip file" while
 * the tests passed under Node. Raw bytes leave nothing to detect. That is
 * the ONLY cause of the defect; a FileReader fallback added while hunting
 * for the bug was removed, since `arrayBuffer()` is indeed available in
 * the iframe, measured at the very first probe.
 */
export async function injectParams(zip: Blob, params: GenerationParams): Promise<Blob> {
	const archive = await JSZip.loadAsync(new Uint8Array(await zip.arrayBuffer()));
	archive.file(PARAMS_FILENAME, buildParamsJson(params));
	const bytes = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
	// Copied into a definite ArrayBuffer: JSZip's Uint8Array is typed over
	// ArrayBufferLike, which admits SharedArrayBuffer and is therefore not a BlobPart.
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return new Blob([buffer], { type: 'application/zip' });
}

/**
 * Only opens trusted links.
 *
 * The URL comes from a server response: a backend that misbehaves, or an
 * intermediary, must not be able to send the user elsewhere. We read the
 * parsed HOST and never the raw string, because
 * `https://evil.com\\@stenchill.com/x` does indeed contain "stenchill.com".
 * Same rule as `is_trusted_view_url` on the KiCad side.
 */
export function isTrustedViewUrl(url: string, baseUrl: string = DEFAULT_BASE_URL): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	}
	catch {
		return false;
	}
	// A local link is accepted ONLY if we ourselves are targeting a local
	// backend. Otherwise production would accept a compromised server
	// sending back a URL to the user's own machine.
	if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
		return baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
	return parsed.protocol === 'https:'
		&& (parsed.hostname === 'stenchill.com' || parsed.hostname === 'www.stenchill.com');
}

export interface ShareOptions {
	zip: Blob;
	params: GenerationParams;
	fetchImpl: typeof fetch;
	baseUrl: string;
	apiKey: string;
	userAgent: string;
	/** Caller cancellation, composed with the deadline below. */
	signal?: AbortSignal;
}

/**
 * Deadline for a share.
 *
 * Without one, a `/plugin/share` that never answers left the "View in 3D"
 * button disabled until the window was closed, with no message: the
 * `.finally()` that re-enables it only runs once the promise settles.
 */
export const SHARE_TIMEOUT_MS = 2 * 60 * 1000;

export async function shareStencil(options: ShareOptions): Promise<string> {
	const { zip, params, fetchImpl, baseUrl, apiKey, userAgent, signal } = options;

	// Same composition as `generateStencil`, and the same fallback:
	// `AbortSignal.any` requires Chromium >= 116, and we don't know the version
	// the client embeds. With the fallback, the ceiling degrades instead of
	// breaking sharing.
	const deadline = AbortSignal.timeout(SHARE_TIMEOUT_MS);
	const canCompose = typeof AbortSignal.any === 'function';
	const effective = signal && canCompose
		? AbortSignal.any([signal, deadline])
		: (signal ?? deadline);

	const body = new FormData();
	body.append('file', await injectParams(zip, params), 'gerbers.zip');

	const response = await fetchImpl(`${baseUrl}/plugin/share`, {
		method: 'POST',
		body,
		headers: { 'X-API-Key': apiKey, 'User-Agent': userAgent },
		signal: effective,
	});
	if (!response.ok) {
		throw new Error(`Share failed: HTTP ${response.status}`);
	}

	const payload = await response.json() as { url?: unknown };
	const url = typeof payload.url === 'string' ? payload.url : '';
	if (!url)
		throw new Error('Share response did not include a URL');
	if (!isTrustedViewUrl(url, baseUrl))
		throw new Error(`Refusing to open an untrusted URL: ${url}`);
	return url;
}
