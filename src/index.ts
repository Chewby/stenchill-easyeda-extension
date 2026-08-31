/**
 * Entry point of the extension.
 *
 * It only opens the iframe page and checks the version: it's the page
 * that carries the interface AND the orchestration, the `eda` object
 * being available there in full (measured on 2026-08-30). See
 * `src/iframe-app.ts`.
 */
import { API_KEY, DEFAULT_BASE_URL, fetchLatestVersion, isNewer, PREOPEN_VERSION_TIMEOUT_MS } from './api-client';
import { DIALOG_HEIGHT, DIALOG_WIDTH, UPDATE_BAND_HEIGHT, UPDATE_LATEST_KEY, type UpdateAnswer } from './dialog-size';
import { DICTS } from './dicts';
import { resolveDict, siteLocale, translate } from './i18n';
import { IFRAME_ID } from './iframe-id';
import { USER_AGENT, VERSION } from './version';

/*
 * There is no `activate` here any more, and no `activationEvents` in
 * extension.json either.
 *
 * It existed to check for a newer version when EasyEDA started, and it did so
 * with `eda.sys_Message.showToastMessage`, which closes itself after three
 * seconds while the client is still starting up. Nobody ever saw it. The check
 * now lives in the dialog, as a band that stays put, which is where the user
 * actually is and what the KiCad plugin does.
 *
 * Removing the export is safe: the host calls it as
 * `if (typeof activate === 'function')`, verified on 2026-08-31 in the
 * client's own `pro-api/api.js`. The extension also stops making a network
 * call every time EasyEDA launches, whether or not anyone opens a PCB.
 */

/**
 * Opens the dialog, after asking whether a newer version exists.
 *
 * The order is forced by the SDK, not chosen: `openIFrame` takes the height as
 * an argument and nothing can change it afterwards, so the answer has to be in
 * hand before the window exists. The answer is then left in storage for the
 * page to read, which keeps the whole feature down to a single network call.
 *
 * Nothing here can prevent the dialog from opening: `fetchLatestVersion`
 * returns null on any anomaly, the storage write is swallowed, and the check
 * gives up after `PREOPEN_VERSION_TIMEOUT_MS`, which is short precisely
 * because the user is waiting on a window that has not appeared yet.
 */
export function openDialog(): void {
	void (async () => {
		const answer: UpdateAnswer = { checked: false, latest: null };
		try {
			const latest = await fetchLatestVersion(
				fetch, DEFAULT_BASE_URL, USER_AGENT, API_KEY, PREOPEN_VERSION_TIMEOUT_MS,
			);
			// `null` se lit ici « pas de reponse » et non « rien de neuf » : la
			// fonction rend null aussi bien sur un 404 que sur un reseau muet,
			// et confondre les deux ferait taire le repli de la page.
			answer.checked = latest !== null;
			answer.latest = latest !== null && isNewer(latest, VERSION) ? latest : null;
		}
		catch {
			// A version check must never cost the user their dialog.
		}
		try {
			await eda.sys_Storage.setExtensionUserConfig(UPDATE_LATEST_KEY, answer);
		}
		catch {
			// Sans reponse ecrite, la page redemandera d'elle-meme.
		}
		const height = DIALOG_HEIGHT + (answer.latest ? UPDATE_BAND_HEIGHT : 0);
		eda.sys_IFrame.openIFrame('/iframe/index.html', DIALOG_WIDTH, height, IFRAME_ID);
	})();
}

/**
 * The About dialog.
 *
 * Only its TITLE goes through the dictionary: the body is a version number and
 * a URL, and neither is language.
 */
export function about(): void {
	void (async () => {
		const language = await eda.sys_I18n.getCurrentLanguage().catch(() => 'en');
		const dict = await resolveDict(() => language, DICTS);
		const body = [
			`Stenchill ${VERSION}`,
			'',
			translate(dict, 'Turns the paste layers of your board into a stencil you can print on a normal FDM printer, with no manual Gerber export.'),
			'',
			// La page du site dans la langue du client : elle explique tout, et
			// le greffon est un canal vers le site.
			`https://www.stenchill.com/${siteLocale(language)}/easyeda-extension`,
			translate(dict, 'MIT licensed. Source on GitHub.'),
		].join('\n');
		eda.sys_Dialog.showInformationMessage(body, translate(dict, 'About'));
	})();
}
