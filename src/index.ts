/**
 * Entry point of the extension.
 *
 * It only opens the iframe page and checks the version: it's the page
 * that carries the interface AND the orchestration, the `eda` object
 * being available there in full (measured on 2026-08-30). See
 * `src/iframe-app.ts`.
 */
import { DEFAULT_BASE_URL, fetchLatestVersion, isNewer } from './api-client';
import { IFRAME_ID } from './iframe-id';
import { USER_AGENT, VERSION } from './version';

/**
 * Version check at startup.
 *
 * It cannot get in the way: `fetchLatestVersion` returns `null` on any
 * anomaly, including the 404 the route returns TODAY, its server-side
 * counterpart not existing yet.
 *
 * This wiring was already lost once, on 2026-08-30, while rewriting this
 * file: the two functions ended up with no caller and `activate` empty. A
 * symbol with no caller never cleans itself up on its own.
 */
export function activate(): void {
	void (async () => {
		const latest = await fetchLatestVersion(fetch, DEFAULT_BASE_URL, USER_AGENT);
		if (latest && isNewer(latest, VERSION)) {
			eda.sys_Message.showToastMessage(`Stenchill ${latest} is available`);
		}
	})();
}

export function openDialog(): void {
	eda.sys_IFrame.openIFrame('/iframe/index.html', 555, 690, IFRAME_ID);
}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		`Stenchill ${VERSION}\nhttps://www.stenchill.com`,
		'About',
	);
}
