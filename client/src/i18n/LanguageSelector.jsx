import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from './I18nProvider';

/**
 * Reusable language selector dropdown.
 * Props:
 *   compact  — show only flag + code (for tight spaces like headers)
 *   inline   — show as inline button group instead of dropdown
 */
export default function LanguageSelector({ compact = false, inline = false }) {
  const { lang, setLang, languages } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = languages.find((l) => l.code === lang) || languages[0];

  if (inline) {
    return (
      <div className="flex items-center gap-1 text-xs">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`px-2 py-1 rounded transition-colors ${
              lang === l.code
                ? 'bg-claude/20 text-claude'
                : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
            }`}
          >
            <span className="mr-1">{l.flag}</span>
            {l.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors text-xs"
        title={current.label}
      >
        <Globe size={13} />
        {compact ? (
          <span className="uppercase font-medium">{lang}</span>
        ) : (
          <span>
            {current.flag} {current.label}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-[60] py-1 overflow-hidden">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                l.code === lang ? 'text-claude bg-claude/10' : 'text-surface-300 hover:bg-surface-700'
              }`}
            >
              <span className="text-sm">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === lang && <span className="w-1.5 h-1.5 rounded-full bg-claude" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
