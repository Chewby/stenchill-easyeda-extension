import type { Dict } from './i18n';
/**
 * The dictionaries, bundled from the very files the EasyEDA store reads.
 *
 * They are IMPORTED and not re-typed here so that `locales/en.json` and
 * `locales/zh-Hans.json` stay the single source: the packaged `.eext` ships
 * those files, and a copy inside the bundle would drift from them in silence.
 */
import en from '../locales/en.json';
import zhHans from '../locales/zh-Hans.json';

export const DICTS: Record<string, Dict> = { 'en': en, 'zh-Hans': zhHans };
