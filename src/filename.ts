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
		// NFKD splits É into E plus a COMBINING accent, so the accent has to be
		// dropped here. Without this line it survives to the next expression,
		// which does not consider it a letter and turns it into an underscore
		// in the MIDDLE of the word: 'Carte Émetteur' came out 'Carte_E_metteur'.
		.replaceAll(/\p{M}+/gu, '')
		// Letters of EVERY script, not just ASCII. `\w` is ASCII-only, so a
		// Chinese or Cyrillic name lost all of its characters and the function
		// fell back to 'stencil', throwing away the very identity the timestamp
		// exists to preserve. On EasyEDA that is the common case, not the edge
		// one. Measured on 2026-08-31: '电路板设计' produced 'stencil'.
		.replaceAll(/[^\p{L}\p{N}._-]+/gu, '_')
		// Two scans rather than one alternation: Sonar requires parentheses
		// around "^a|b$" to make precedence explicit, and ESLint's
		// no-useless-non-capturing-group rule removes them on the next --fix.
		// The two tools contradicted each other on this line; removing the
		// alternation takes away their subject of dispute, and reads better.
		// The dash belongs in both classes: it was missing from the leading one,
		// and 'ПЛАТА-2' produced a file named '-2_...zip', which a shell reads
		// as an option rather than a path.
		// Sonar raises a denial-of-service hotspot on the second of these two
		// expressions. Reviewed as SAFE, for two independent reasons: a single
		// character class followed by `+` has no ambiguity to resolve, hence
		// nothing to backtrack over, and the input is bounded to 120 characters
		// anyway by the `slice` at the top of the function. The `$` anchors the
		// only one that could be a worry.
		.replaceAll(/^[_.-]+/g, '')
		.replaceAll(/[_.-]+$/g, '')
		.slice(0, 60);
	const base = cleaned.length > 0 ? cleaned : 'stencil';
	return `${base}_${stamp(date)}.zip`;
}
