/**
 * Name of the archive offered for saving.
 *
 * Timestamped, because a user regenerates the same stencil several times
 * while varying a parameter: without a timestamp, each attempt overwrites
 * the previous one or produces "stencil (2).zip" files that don't say
 * which one carried which setting. Same reason as the KiCad plugin's dated
 * folder (`minuteur V0.3_20260815_125310`).
 */

/** `20260830_201922`, in LOCAL time: that's the one the user reads. */
function stamp(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		'_',
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join('');
}

/**
 * Returns a safe name, whatever the project's name is.
 *
 * An EasyEDA project name can carry spaces, accents, slashes or
 * ideograms. We keep only what a filesystem accepts everywhere, and fall
 * back to `stencil` if nothing survives: an empty name would produce a
 * file called `_20260830_201922.zip`.
 */
export function stencilFileName(projectName: string | null | undefined, date: Date): string {
	// The length is bounded BEFORE cleanup, not after. The reason stated
	// here was WRONG for a long time: the two expressions below do not
	// backtrack, so they are not super-linear. What the bound actually
	// avoids is running two scans over an arbitrarily long name, and it
	// calms the static analyzer, which cannot prove that on its own. A
	// wrong comment gets paid for later.
	const cleaned = String(projectName ?? '')
		.slice(0, 120)
		.normalize('NFKD')
		.replaceAll(/[^\w.-]+/g, '_')
		// Two scans rather than one alternation: Sonar requires parentheses
		// around "^a|b$" to make precedence explicit, and ESLint's
		// no-useless-non-capturing-group rule removes them on the next --fix.
		// The two tools contradicted each other on this line; removing the
		// alternation takes away their subject of dispute, and reads better.
		.replaceAll(/^[_.]+/g, '')
		.replaceAll(/[_.]+$/g, '')
		.slice(0, 60);
	const base = cleaned.length > 0 ? cleaned : 'stencil';
	return `${base}_${stamp(date)}.zip`;
}
