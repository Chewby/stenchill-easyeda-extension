import type { GenerationParams } from './params';
import { toFormFields } from './params';
import { SseParser } from './sse';

export const DEFAULT_BASE_URL = 'https://www.stenchill.com/api/v1';

/**
 * Cle PUBLIQUE, partagee avec le greffon KiCad, sans valeur d'authentification.
 *
 * La formulation precedente disait « marqueur de priorite, PAS un secret, ne
 * pas la traiter comme une donnee sensible », et elle etait trop rassurante :
 * vingt lignes plus bas, `fetchLatestVersion` documente que `/api/v1/**` rend
 * 401 sans elle. C'est donc bien un identifiant, en clair dans un `.eext` que
 * n'importe qui telecharge, et extractible en trente secondes.
 *
 * Ce qui compte n'est pas le mot mais sa consequence, cote SERVEUR : il ne
 * doit deriver de cette cle ni quota, ni confiance, ni identite. La limitation
 * de debit se fait par IP. Traiter cette cle comme une preuve d'identite
 * reviendrait a n'en avoir aucune.
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

/**
 * A caller's signal AND a deadline, whatever the client supports.
 *
 * `AbortSignal.any` needs Chromium >= 116 and we do not know what the EasyEDA
 * client embeds. The first version fell back to `signal ?? deadline`, which
 * DROPPED the deadline as soon as a caller passed a signal: on an older
 * client, the very case the deadline exists for, an intermediary swallowing
 * the connection, became an infinite wait again. A fallback that discards the
 * property it is falling back from is not a fallback.
 *
 * The manual path keeps both, for six lines.
 */
export function withDeadline(signal: AbortSignal | undefined, ms: number): AbortSignal {
	const deadline = AbortSignal.timeout(ms);
	if (!signal)
		return deadline;
	if (typeof AbortSignal.any === 'function')
		return AbortSignal.any([signal, deadline]);
	const relay = new AbortController();
	for (const source of [signal, deadline])
		source.addEventListener('abort', () => relay.abort(source.reason), { once: true });
	return relay.signal;
}

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
	const effective = withDeadline(signal, REQUEST_TIMEOUT_MS);

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
 * It returns null WITHOUT throwing on any anomaly: a version check that gets
 * in the user's way is worse than no check at all.
 *
 * The API KEY is required here, and forgetting it is exactly how this call
 * spent its first day doing nothing. `/api/v1/**` is behind that key, so
 * without the header the route answers 401, `response.ok` is false, and the
 * function returns null: no error, no log, no toast, and every install stays
 * on its version for ever. Measured on 2026-08-31 against production, which
 * answers 26.8.2 with the header and 401 without it.
 *
 * This docstring used to say the route "does not exist yet server-side",
 * which stopped being true the day it was deployed and then explained the
 * silence away.
 */
export async function fetchLatestVersion(
	fetchImpl: typeof fetch,
	baseUrl: string,
	userAgent: string,
	apiKey: string,
	timeoutMs: number = VERSION_CHECK_TIMEOUT_MS,
): Promise<string | null> {
	try {
		const response = await fetchImpl(`${baseUrl}/plugin/easyeda/version`, {
			headers: { 'X-API-Key': apiKey, 'User-Agent': userAgent },
			// A SHORT ceiling, not a generation's: this call runs at client
			// startup, nobody waits on it, and without a ceiling it holds a
			// connection open for as long as the server stays silent. Its
			// failure is already inconsequential, `catch` returns `null`.
			signal: AbortSignal.timeout(timeoutMs),
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
