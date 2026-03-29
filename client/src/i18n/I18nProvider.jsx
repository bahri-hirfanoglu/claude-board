import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import en from './locales/en';
import tr from './locales/tr';

/**
 * To add a new language:
 * 1. Create client/src/i18n/locales/{code}.js (copy en.js as template)
 * 2. Add import and entry to `locales` and `LANGUAGES` below
 * 3. That's it — the language selector will pick it up automatically
 */
const locales = { en, tr };

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  // { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  // { code: 'fr', label: 'Français', flag: '🇫🇷' },
  // { code: 'es', label: 'Español', flag: '🇪🇸' },
  // { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

const SUPPORTED = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = 'ui-lang';

function detectLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}
  const nav = (navigator.language || '').split('-')[0];
  return SUPPORTED.includes(nav) ? nav : 'en';
}

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
  }, []);

  const t = useCallback(
    (key, params) => {
      const str = locales[lang]?.[key] ?? locales.en[key] ?? key;
      if (!params) return str;
      return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    },
    [lang],
  );

  // Sync language from backend settings on first load (setup saves to DB, not localStorage)
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      api
        .getAppSettings()
        .then((s) => {
          if (s?.language && SUPPORTED.includes(s.language)) {
            setLang(s.language);
          }
        })
        .catch(() => {});
    }
  }, [setLang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useTranslation must be inside I18nProvider');
  return ctx;
}
