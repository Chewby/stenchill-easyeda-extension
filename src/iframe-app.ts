import type { Dict } from './i18n';
/**
 * The iframe page's code, and the extension's real orchestrator.
 *
 * The probe on 2026-08-30 measured that the iframe carries the `eda`
 * object in FULL, `pcb_ManufactureData` included, plus `fetch` and
 * `EventSource`. So there is no dialogue protocol to write between the
 * page and the extension: the page exports the Gerber files itself and
 * talks to the server itself. `src/index.ts` now only opens this page.
 */
import type { GenerationParams } from './params';
import { API_KEY, ApiError, DEFAULT_BASE_URL, fetchLatestVersion, generateStencil, isNewer } from './api-client';
import { DICTS } from './dicts';
import { exportPasteGerbers } from './exporter';
import { stencilFileName } from './filename';
import { localizeDocument, resolveDict, siteLocale, translate } from './i18n';
import { IFRAME_ID } from './iframe-id';
import { clampParams, DEFAULT_PARAMS } from './params';
import { shareStencil } from './share';
import { USER_AGENT, VERSION } from './version';

// No `declare const eda` here: @jlceda/pro-api-types already declares the
// global `const eda: EDA`, and it is in the tsconfig's include. Redeclaring
// it as `any` would overwrite that typing right where it matters most, on
// getCurrentProjectInfo, saveFile and getCurrentTheme.

/**
 * Error safety net, placed BEFORE everything else.
 *
 * Without it, an exception at load time prevents the submit handler from
 * being registered, the form then goes into navigation, and the page
 * turns BLANK without a word. Encountered on 2026-08-30. A blank page
 * cannot be diagnosed, so we make any error visible on screen.
 */
/**
 * The dictionary in force, English until the host answers.
 *
 * It is a mutable module binding and not a promise the callers await: every
 * caller is an event handler, and making them all async to read a label would
 * spread the wait through the whole file for a value that is settled long
 * before the user can click anything.
 */
let dict: Dict = DICTS.en;

/** Translates through the dictionary in force. */
function t(text: string, ...args: ReadonlyArray<string | number>): string {
	return translate(dict, text, ...args);
}

/**
 * Applies the host's language to the page.
 *
 * The page is NOT hidden while this resolves, deliberately, and the tradeoff
 * is the same one `applyTheme` already makes: a brief flash of English is a
 * lesser evil than a dialog that could stay blank forever if the reveal never
 * ran. English is also what a failure leaves on screen, which is readable.
 */
/** The site locale to link to, settled with the dictionary. */
let locale = 'en';

async function applyLanguage(): Promise<void> {
	const language = await hostLanguage();
	dict = await resolveDict(() => language, DICTS);
	locale = siteLocale(language);
	localizeDocument(document, dict);
}

/**
 * The user's language, asked of the host first and of the browser second.
 *
 * `eda.sys_I18n` IS reachable from the iframe: measured on 2026-08-31 in the
 * real desktop client, switching EasyEDA Pro to Simplified Chinese and getting
 * the whole dialog back translated. It was the one unverified assumption of
 * this feature, and it held.
 *
 * The browser fallback stays, downgraded from load-bearing to belt and braces.
 * What it guards against is silent: had the call thrown, `resolveDict` would
 * have swallowed the TypeError and every reader would have got English with
 * nothing on screen to say why. Three lines is a fair price for that, and the
 * iframe is a real browsing context whatever else it is.
 *
 * It is a FALLBACK and not the primary source: the host answers with the
 * language EasyEDA Pro is displayed in, which is what the user expects the
 * extension to follow; the browser answers with the operating system's, which
 * can differ.
 */
async function hostLanguage(): Promise<string> {
	try {
		return await eda.sys_I18n.getCurrentLanguage();
	}
	catch {
		return navigator.language;
	}
}

function showFatal(what: string, detail: unknown): void {
	// ONE panel only, reused. Without this, three failures in a row stacked
	// three red blocks that pushed the form off screen, and the oldest one,
	// hence the least relevant, stayed at the top.
	let box = document.getElementById('fatal');
	if (!box) {
		box = document.createElement('pre');
		box.id = 'fatal';
		box.style.cssText = 'white-space:pre-wrap;color:#ef6c6c;font:12px monospace;padding:12px';
		document.body.prepend(box);
	}
	box.textContent = `${what}\n${String(detail)}`;
}

globalThis.addEventListener('error', event => showFatal(t('Script error'), event.message));
globalThis.addEventListener('unhandledrejection', event => showFatal(t('Unhandled rejection'), event.reason));

const SETTINGS_KEY = 'generationParams';

/**
 * The ZIP of the last generation, kept for sharing.
 *
 * Sharing is LAZY: we only send the archive back to the site if the user
 * clicks, so as not to make them pay for a second upload they didn't ask
 * for.
 */
let lastZip: Blob | null = null;
let lastParams: GenerationParams | null = null;

/** Non-null during a generation: carries the bottom button's cancellation. */
let inFlight: AbortController | null = null;

const NUMBER_FIELDS = [
	'thickness',
	'shrink',
	'nozzleDiameter',
	'pcbThickness',
	'shoulderLength',
	'shoulderWidth',
	'shoulderClearance',
] as const;

const BOOL_FIELDS = ['enableShoulders', 'enableSlotify', 'dropUnprintableGrids'] as const;

function el(id: string): HTMLElement {
	const node = document.getElementById(id);
	if (!node)
		throw new Error(`missing element: ${id}`);
	return node;
}

function input(id: string): HTMLInputElement {
	return el(id) as HTMLInputElement;
}

/**
 * Reads a numeric field, and returns NaN on an empty or invalid entry.
 *
 * `Number('')` is 0, which is finite, so `clampParams` would CLAMP it
 * instead of rejecting it: an empty `thickness` field gave 0.1 mm -- the
 * minimum -- instead of reverting to 0.4. So "empty" must be distinguished
 * from "zero" here, since `clampParams` can no longer do it once the
 * number has been computed.
 *
 * The comma `replace` is defensive and nothing more: on an
 * `<input type="number">`, the browser renders `.value === ''` when the
 * entry is invalid, so in practice it never sees a comma. An earlier
 * draft of this comment claimed the opposite.
 */
function readNumber(id: string): number {
	const raw = input(id).value.trim().replace(',', '.');
	return raw === '' ? Number.NaN : Number(raw);
}

function readForm(): GenerationParams {
	const raw: Record<string, unknown> = {};
	for (const id of NUMBER_FIELDS) raw[id] = readNumber(id);
	for (const id of BOOL_FIELDS) raw[id] = input(id).checked;
	return clampParams(raw as Partial<GenerationParams>);
}

function writeForm(params: GenerationParams): void {
	for (const id of NUMBER_FIELDS) input(id).value = String(params[id]);
	for (const id of BOOL_FIELDS) input(id).checked = params[id];
}

function setStatus(text: string): void {
	el('label').textContent = text;
}

async function loadSettings(): Promise<GenerationParams> {
	try {
		const saved = await eda.sys_Storage.getExtensionUserConfig(SETTINGS_KEY);
		return clampParams((saved ?? {}) as Partial<GenerationParams>);
	}
	catch {
		// An unreadable setting must not prevent opening the form.
		return DEFAULT_PARAMS;
	}
}

async function run(): Promise<void> {
	// We make the click visible BEFORE any read: if anything fails
	// afterwards, we at least know the handler was properly called.
	el('progress').style.display = 'block';
	el('result').style.display = 'none';
	el('view').style.display = 'none';
	el('bar').setAttribute('value', '0');
	setStatus(t('Starting...'));
	// Reset to null on ENTRY: otherwise a failure would leave the previous
	// generation's ZIP in place, and "View in 3D" would share that one.
	lastZip = null;
	lastParams = null;

	const controller = new AbortController();
	inFlight = controller;
	setDismiss('Cancel');

	try {
		const params = readForm();
		// We WRITE BACK to the form what was actually kept. `clampParams` brings
		// an out-of-bounds entry back within bounds, but the field went on
		// showing the refused value: the user believed they were generating a
		// 5 mm stencil and got a 0.6 mm one, without a word.
		// `<input type="number" max>` does not block typing, it only feeds native
		// validation, which a `type="button"` button never triggers.
		writeForm(params);
		input('go').disabled = true;
		input('reset').disabled = true;
		setStatus(t('Exporting gerbers...'));
		try {
			await eda.sys_Storage.setExtensionUserConfig(SETTINGS_KEY, params);
		}
		catch {
			// Persisting the settings is a CONVENIENCE: its failure must not
			// prevent the export the user just asked for.
			// `loadSettings` is already protected the same way.
		}
		const zip = await exportPasteGerbers(eda);
		lastZip = zip;
		lastParams = params;

		const result = await generateStencil({
			zip,
			params,
			fetchImpl: fetch,
			baseUrl: DEFAULT_BASE_URL,
			apiKey: API_KEY,
			userAgent: USER_AGENT,
			onProgress: (event) => {
				el('bar').setAttribute('max', String(event.total));
				el('bar').setAttribute('value', String(event.step));
				setStatus(event.labelText || t('Step ${1} of ${2}', event.step, event.total));
			},
			onQueued: (event) => {
				setStatus(t('Waiting in queue: position ${1} of ${2}', event.position, event.queueDepth));
			},
			signal: controller.signal,
		});

		let project: string | null = null;
		try {
			const info = await eda.dmt_Project.getCurrentProjectInfo();
			project = info?.friendlyName ?? info?.name ?? null;
		}
		catch {
			// The project name is only a convenience: its absence must not
			// prevent saving the stencil we just waited for.
		}
		const fileName = stencilFileName(project, new Date());

		// The save dialog is modal: we put the progress bar away BEFORE
		// opening it, and only announce success once it has been rendered.
		el('progress').style.display = 'none';
		setStatus('');
		await eda.sys_FileSystem.saveFile(new Blob([result.bytes]), fileName);
		el('result').style.display = 'block';
		el('view').style.display = '';
		el('resultText').className = 'ok';
		el('resultText').textContent = t('Saved as ${1}', fileName);
	}
	catch (error) {
		el('progress').style.display = 'none';
		// A cancellation is not a failure: the user knows what they did,
		// showing them a red error would be punishing them for their own click.
		const aborted = controller.signal.aborted;
		el('result').style.display = aborted ? 'none' : 'block';
		if (!aborted) {
			el('resultText').className = 'ko';
			el('resultText').textContent
				= error instanceof ApiError ? error.message : t('Failed: ${1}', String(error));
		}
		setStatus('');
	}
	finally {
		inFlight = null;
		setDismiss('Quit');
		input('go').disabled = false;
		input('reset').disabled = false;
	}
}

el('go').addEventListener('click', () => {
	run().catch(error => showFatal(t('Generate failed'), error));
});

el('reset').addEventListener('click', () => writeForm(DEFAULT_PARAMS));

/**
 * The bottom button is DYNAMIC, like the KiCad plugin's: "Quit" at rest,
 * "Cancel" during a generation. Cancelling actually cuts the SSE stream
 * instead of waiting for it to finish, since a generation takes up to a
 * minute on a large board.
 */
function setDismiss(label: 'Quit' | 'Cancel'): void {
	// The parameter stays the ENGLISH string: it is the dictionary key, and the
	// type union locks it. Translate at display time, never at the call site,
	// otherwise the key to translate becomes a variable and the guard in
	// `tests/i18n.contract.test.ts` no longer sees it.
	el('quit').textContent = t(label);
}

el('quit').addEventListener('click', () => {
	if (inFlight) {
		inFlight.abort();
		return;
	}
	eda.sys_IFrame.closeIFrame(IFRAME_ID);
});

/**
 * Help bubbles, on CLICK and only one at a time.
 *
 * The KiCad plugin opens a `RichToolTip` on clicking the badge, with a
 * TITLE and a text, and its code sets the rule we follow here: the panel
 * is the ONLY help channel for a setting. Two channels, the panel and a
 * `title` on the field, would force keeping two texts in sync forever.
 *
 * On hover rather than click, the bubble would open without being asked
 * for, just by crossing the row, and would hide the very field being
 * targeted.
 *
 * The title is DERIVED from the row's label, never copied: copied, it
 * would drift out of sync the day a label changes.
 */
function hideTip(): void {
	el('tip').style.display = 'none';
}

function showTip(badge: HTMLElement): void {
	const row = badge.closest('.row');
	const title = row?.querySelector('label')?.textContent?.trim() ?? '';
	el('tipTitle').textContent = title;
	el('tipText').textContent = badge.dataset.tip ?? '';

	const tip = el('tip');
	tip.style.display = 'block';
	// Anchored to the left of the badge, and pulled up if it would overflow at the bottom.
	const spot = badge.getBoundingClientRect();
	const top = Math.min(
		spot.top + window.scrollY - 4,
		window.scrollY + window.innerHeight - tip.offsetHeight - 8,
	);
	tip.style.top = `${Math.max(window.scrollY + 4, top)}px`;
	tip.style.left = `${Math.max(8, spot.left + window.scrollX - tip.offsetWidth - 8)}px`;
}

document.addEventListener('click', (event) => {
	const badge = (event.target as HTMLElement | null)?.closest?.('.info') as HTMLElement | null;
	if (!badge) {
		hideTip();
		return;
	}
	const alreadyOpen = el('tip').style.display === 'block'
		&& el('tipText').textContent === badge.dataset.tip;
	if (alreadyOpen)
		hideTip();
	else showTip(badge);
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape')
		hideTip();
});

/**
 * Opens a URL in the browser.
 *
 * The URL is shown ONLY if the opening throws: a share address is forty
 * characters long, it wraps and clutters the panel for nothing when the
 * browser did open. But without this fallback the button would be a
 * silent dead end the day the call fails, so we keep it for that case
 * only. Same tradeoff as `dialog.py` on the KiCad side, which only shows
 * the link when `webbrowser.open` returns false.
 */
function openAndShow(url: string): void {
	const link = el('resultLink') as HTMLAnchorElement;
	link.style.display = 'none';
	try {
		eda.sys_Window.open(url, '_blank' as ESYS_WindowOpenTarget);
	}
	catch {
		link.textContent = url;
		link.href = url;
		link.style.display = 'block';
	}
}

el('view').addEventListener('click', () => {
	// The plugin is a channel to the site: we send the user there with
	// THEIR stencil rather than embed a viewer, which would keep them in EasyEDA.
	if (!lastZip || !lastParams) {
		openAndShow('https://www.stenchill.com');
		return;
	}
	const button = el('view') as HTMLButtonElement;
	button.disabled = true;
	shareStencil({
		zip: lastZip,
		params: lastParams,
		fetchImpl: fetch,
		baseUrl: DEFAULT_BASE_URL,
		apiKey: API_KEY,
		userAgent: USER_AGENT,
	})
		.then(openAndShow)
		.catch(error => showFatal(t('Share failed'), error))
		.finally(() => { button.disabled = false; });
});

el('site').addEventListener('click', () => openAndShow('https://www.stenchill.com'));
// URLs taken from plugin-kicad/dialog.py: do not reinvent them, an earlier
// draft had written "ko-fi.com/stenchill", which doesn't exist.
el('kofi').addEventListener('click', () => eda.sys_Window.open('https://ko-fi.com/thomascottard', '_blank' as ESYS_WindowOpenTarget));
el('paypal').addEventListener('click', () => eda.sys_Window.open('https://paypal.me/thomascottard', '_blank' as ESYS_WindowOpenTarget));

/**
 * `getCurrentTheme()` is ASYNCHRONOUS: it returns a promise, not a string.
 * Measured on 2026-08-30, it is 'dark' on a dark client. Without the await,
 * String(promise) never contains 'dark' and the page stays light on a
 * dark client, with no error.
 */
async function applyTheme(): Promise<void> {
	let theme = 'dark';
	try {
		theme = String(await eda.sys_Window.getCurrentTheme());
	}
	catch {
		// The client is dark by default: that's the best fallback.
	}
	document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

void applyTheme();

/**
 * The update notice, shown in the dialog and not as a startup toast.
 *
 * `eda.sys_Message.showToastMessage` closes itself after three seconds, and it
 * fired while EasyEDA was still starting up, so nobody ever saw it. The KiCad
 * plugin puts a persistent band in its own dialog for the same reason.
 *
 * Silent on every anomaly, by design: `fetchLatestVersion` returns null rather
 * than throwing, and a version check that gets in the way is worse than none.
 */
async function checkForUpdate(): Promise<void> {
	const latest = await fetchLatestVersion(fetch, DEFAULT_BASE_URL, USER_AGENT, API_KEY);
	if (!latest || !isNewer(latest, VERSION))
		return;
	el('updateText').textContent = t('New version ${1} available', latest);
	const link = el('updateLink') as HTMLAnchorElement;
	link.textContent = t('Download');
	link.onclick = (event) => {
		event.preventDefault();
		// La page du SITE et non la page des releases : elle explique, elle
		// porte le bouton de telechargement, et le greffon est un canal vers
		// le site. Dans la langue du client quand le site la parle.
		openAndShow(`https://www.stenchill.com/${locale}/easyeda-extension`);
	};
	el('update').style.display = 'block';
}

// Apres la langue : le bandeau ecrit du texte traduit, et `applyLanguage` ne
// traduit que ce qui est deja dans le document.
void applyLanguage().then(checkForUpdate);

void loadSettings().then(writeForm);

/**
 * Marker read by the page's probe: proves that this file ran to completion.
 *
 * KEPT on purpose in the shipped bundle, and declared rather than cast: a
 * blank dialog was the hardest failure of this project to diagnose, and this
 * one boolean tells apart "the script never ran" from "the script ran and
 * drew nothing". It costs one property on an object the client already owns.
 */
declare global {
	// eslint-disable-next-line vars-on-top
	var __stenchillLoaded: boolean | undefined;
}

globalThis.__stenchillLoaded = true;
