/**
 * Reading and writing the dialog's form, in pure DOM.
 *
 * Split out of `iframe-app.ts` on 2026-08-31 for ONE reason: to make the
 * empty-versus-zero distinction testable. That distinction is the module's
 * whole subject and the project's own designated trap, yet it lived in a
 * file that touches `eda`, `fetch` and `EventSource`, so nothing could
 * reach it. This file must therefore stay free of any `eda` call, so that
 * happy-dom is enough to exercise it.
 */
import type { GenerationParams } from './params';
import { clampParams } from './params';

export const NUMBER_FIELDS = [
	'thickness',
	'shrink',
	'nozzleDiameter',
	'pcbThickness',
	'shoulderLength',
	'shoulderWidth',
	'shoulderClearance',
] as const;

export const BOOL_FIELDS = ['enableShoulders', 'enableSlotify', 'dropUnprintableGrids'] as const;

export function el(id: string): HTMLElement {
	const node = document.getElementById(id);
	if (!node)
		throw new Error(`missing element: ${id}`);
	return node;
}

export function input(id: string): HTMLInputElement {
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
export function readNumber(id: string): number {
	const raw = input(id).value.trim().replace(',', '.');
	return raw === '' ? Number.NaN : Number(raw);
}

export function readForm(): GenerationParams {
	const raw: Record<string, unknown> = {};
	for (const id of NUMBER_FIELDS) raw[id] = readNumber(id);
	for (const id of BOOL_FIELDS) raw[id] = input(id).checked;
	return clampParams(raw as Partial<GenerationParams>);
}

export function writeForm(params: GenerationParams): void {
	for (const id of NUMBER_FIELDS) input(id).value = String(params[id]);
	for (const id of BOOL_FIELDS) input(id).checked = params[id];
}
