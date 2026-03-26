import { Hash } from 'lucide-react';
import { fmtTime } from './terminalHelpers';

// ─── Turn separator ───
export function TurnSeparator({ turn, time, t }) {
  return (
    <div className="flex items-center gap-2 my-3 select-none">
      <div className="flex-1 border-t border-surface-700/50" />
      <span className="text-[11px] text-surface-500 flex items-center gap-1.5 font-medium">
        <Hash size={10} />
        {t('terminal.turn')} {turn}
        {time && <span className="text-surface-600 font-normal">{fmtTime(time)}</span>}
      </span>
      <div className="flex-1 border-t border-surface-700/50" />
    </div>
  );
}
