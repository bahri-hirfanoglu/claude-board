/**
 * Shows clickable command suggestion chips when assistant is idle.
 */
import { t } from '../i18n/t';

export default function CommandHints({ commands, onSelect, voiceLang }) {
  const hints = commands.filter((c) => c.id !== 'cancel' && c.hint);

  if (hints.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 py-1">
      {hints.map((cmd) => {
        const label = t('hint.' + cmd.id, voiceLang);
        return (
          <button
            key={cmd.id}
            onClick={() => onSelect(label)}
            className="px-2.5 py-1 rounded-lg bg-surface-800/60 hover:bg-surface-700 border border-surface-700/50 hover:border-claude/30 text-[11px] text-surface-400 hover:text-claude transition-all"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
