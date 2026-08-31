/**
 * Entry point of the extension.
 *
 * It only opens the iframe page and checks the version: it's the page
 * that carries the interface AND the orchestration, the `eda` object
 * being available there in full (measured on 2026-08-30). See
 * `src/iframe-app.ts`.
 */
import { DICTS } from './dicts';
import { resolveDict, siteLocale, translate } from './i18n';
import { IFRAME_ID } from './iframe-id';
import { VERSION } from './version';

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

export function openDialog(): void {
	eda.sys_IFrame.openIFrame('/iframe/index.html', 555, 690, IFRAME_ID);
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
