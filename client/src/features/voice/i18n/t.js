import locales from './locales';

/**
 * Translate a key for the given language, with optional interpolation.
 * Falls back to en-US if key is missing.
 *
 * @param {string} key - Dot-separated key (e.g. 'create.askTitle')
 * @param {string} lang - Language code (e.g. 'tr-TR')
 * @param {Record<string, string|number>} [params] - Interpolation params
 * @returns {string}
 */
export function t(key, lang, params) {
  const str = locales[lang]?.[key] ?? locales['en-US']?.[key] ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}
