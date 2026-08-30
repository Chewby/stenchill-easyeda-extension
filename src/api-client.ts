import type { GenerationParams } from './params';
import { toFormFields } from './params';
import { SseParser } from './sse';

export const DEFAULT_BASE_URL = 'https://www.stenchill.com/api/v1';

/**
 * Priority marker, NOT a secret: it places the request at priority 0,
 * like the KiCad plugin. Do not treat it as sensitive data.
 */
export const API_KEY = 'stenchill-kicad-2026-xK9mP4wQ7rT2';

/**
 * Delay beyond which we give up on a request that isn't answering.
 *
 * Large by design: a generation takes up to a minute on a large board,
 * and the stream stays open the whole time without that being an
 * anomaly. Without this ceiling, an intermediary that swallows the
 * connection leaves the interface waiting forever, and manual cancellation
 * is the only way out. The timer covers CONNECTION SETUP and the progress
 * of the stream, not the generation itself.
 */
export const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Deadline for the startup version check.
 *
 * Deliberately far shorter than a generation's: nobody is waiting on this
 * call, and the only thing an unbounded one buys is a connection held open
 * against a server that has stopped answering.
 */
export const VERSION_CHECK_TIMEOUT_MS = 15 * 1000;

export class ApiError extends Error {}

/**
 * What the server accepts on `/download/{stlPath}`, identically.
 *
 * <p>Verified in `ApiV1Controller#download`: a single SEGMENT, never a
 * path. Mirroring it here fixes the intent -- `encodeURIComponent` alone
 * would turn a `/` into `%2F` and would end up 404 AFTER a successful
 * generation, at the moment most costly for the user. Better to refuse
 * early and say why.</p>
 */
const STL_PATH_PATTERN = /^[\w.-]+\.zip$/;

export interface ProgressEvent {
	step: number;
	total: number;
	labelText: string;
}

export interface QueuedEvent {
	position: number;
	queueDepth: number;
	etaSeconds: number;
}

export interface GenerateOptions {
	zip: File | Blob;
	params: GenerationParams;
	fetchImpl: typeof fetch;
	baseUrl: string;
	apiKey: string;
	userAgent: string;
	onProgress?: (event: ProgressEvent) => void;
	onQueued?: (event: QueuedEvent) => void;
	/**
	 * Cuts the SSE stream instead of consuming it to the end.
	 *
	 * A generation takes up to a minute on a large board: the user must be
	 * able to give up. Same intent as the KiCad plugin's `cancel_event`,
	 * which drops the connection rather than waiting for it to finish.
	 */
	signal?: AbortSignal;
}

export interface GenerateResult {
	stlPath: string;
	bytes: ArrayBuffer;
}

/**
 * Only accepts a real string.
 *
 * `String(value)` on an object renders "[object Object]", which would be
 * shown as-is in the progress bar or in an error message. The server only
 * sends strings, but nothing guarantees that at runtime.
 */
function asText(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function asInt(value: unknown, fallback: number): number {
	const num = Number(value);
	return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

export async function generateStencil(options: GenerateOptions): Promise<GenerateResult> {
	const { zip, params, fetchImpl, baseUrl, apiKey, userAgent, onProgress, onQueued, signal } = options;

	// The delay ceiling is COMPOSED with manual cancellation, it does not
	// replace it: `AbortSignal.any` returns a signal that fires as soon as
	// either of the two trips. Without this composition, the constant would
	// exist with no caller -- that's the failure this file already documents
	// for another symbol, and it happened again here three hours later.
	// `AbortSignal.any` requires Chromium >= 116. We don't know the version
	// floor of the EasyEDA client, and without this fallback an older client
	// would throw right here: the generation would no longer start at all,
	// so the timeout would be worse than the flaw it fixes.
	const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	const canCompose = typeof AbortSignal.any === 'function';
	const effective = signal && canCompose
		? AbortSignal.any([signal, deadline])
		: (signal ?? deadline);

	const body = new FormData();
	body.append('file', zip, 'gerbers.zip');
	for (const [name, value] of Object.entries(toFormFields(params))) {
		body.append(name, value);
	}

	const response = await fetchImpl(`${baseUrl}/generate/stream`, {
		method: 'POST',
		body,
		headers: { 'X-API-Key': apiKey, 'User-Agent': userAgent },
		signal: effective,
	});

	if (!response.ok || !response.body) {
		throw new ApiError(`Generation request failed: HTTP ${response.status}`);
	}

	let stlPath: string | null = null;
	let failure: string | null = null;

	const parser = new SseParser((event) => {
		let data: Record<string, unknown>;
		try {
			const parsed = JSON.parse(event.data);
			if (typeof parsed !== 'object' || parsed === null)
				return;
			data = parsed as Record<string, unknown>;
		}
		catch {
			return; // a stream must survive a malformed payload
		}
		if (event.type === 'progress' && onProgress) {
			onProgress({
				step: asInt(data.step, 0),
				total: asInt(data.total, 5),
				labelText: asText(data.labelText, ''),
			});
		}
		else if (event.type === 'queued' && onQueued) {
			onQueued({
				position: asInt(data.position, 1),
				queueDepth: asInt(data.queueDepth, 1),
				etaSeconds: asInt(data.etaSeconds, 0),
			});
		}
		else if (event.type === 'complete') {
			stlPath = asText(data.stlPath, '');
		}
		else if (event.type === 'error') {
			failure = asText(data.error, 'unknown');
		}
	});

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	for (;;) {
		const { done, value } = await reader.read();
		if (done)
			break;
		parser.push(decoder.decode(value, { stream: true }));
	}
	// Flush the decoder: without this final call, a multi-byte character cut
	// across two chunks stays in its buffer and is silently lost -- the same
	// trap as SseParser's carry-over buffer, one level down.
	parser.push(decoder.decode());
	parser.end();

	const finalFailure: string | null = failure;
	const finalStlPath: string | null = stlPath;

	if (finalFailure !== null)
		throw new ApiError(`Generation failed: ${finalFailure}`);
	if (!finalStlPath)
		throw new ApiError('Stream ended without a complete event');

	if (!STL_PATH_PATTERN.test(finalStlPath)) {
		throw new ApiError(`Refusing a suspicious download path: ${finalStlPath}`);
	}
	const download = await fetchImpl(`${baseUrl}/download/${encodeURIComponent(finalStlPath)}`, {
		headers: { 'X-API-Key': apiKey, 'User-Agent': userAgent },
		signal: effective,
	});
	if (!download.ok) {
		throw new ApiError(`Download failed: HTTP ${download.status}`);
	}
	return { stlPath: finalStlPath, bytes: await download.arrayBuffer() };
}

/**
 * Returns the latest published version, or null.
 *
 * It returns null WITHOUT throwing on any anomaly, including a 404: the
 * route dedicated to this extension does not exist yet server-side, and a
 * version check that gets in the user's way is worse than no check at
 * all.
 */
export async function fetchLatestVersion(
	fetchImpl: typeof fetch,
	baseUrl: string,
	userAgent: string,
): Promise<string | null> {
	try {
		const response = await fetchImpl(`${baseUrl}/plugin/easyeda/version`, {
			headers: { 'User-Agent': userAgent },
			// A SHORT ceiling, not a generation's: this call runs at client
			// startup, nobody waits on it, and without a ceiling it holds a
			// connection open for as long as the server stays silent. Its
			// failure is already inconsequential, `catch` returns `null`.
			signal: AbortSignal.timeout(VERSION_CHECK_TIMEOUT_MS),
		});
		if (!response.ok)
			return null;
		const data = await response.json();
		const latest = (data as Record<string, unknown>)?.latest;
		return typeof latest === 'string' ? latest : null;
	}
	catch {
		return null;
	}
}

function parseVersion(value: string): number[] | null {
	const parts = value.split('.').map(Number);
	return parts.length > 0 && parts.every(part => Number.isInteger(part) && part >= 0)
		? parts
		: null;
}

/** Compares field by field: "1.10.0" is newer than "1.9.0". */
export function isNewer(latest: string, current: string): boolean {
	const a = parseVersion(latest);
	const b = parseVersion(current);
	if (!a || !b)
		return false;
	const length = Math.max(a.length, b.length);
	for (let i = 0; i < length; i++) {
		const left = a[i] ?? 0;
		const right = b[i] ?? 0;
		if (left !== right)
			return left > right;
	}
	return false;
}
