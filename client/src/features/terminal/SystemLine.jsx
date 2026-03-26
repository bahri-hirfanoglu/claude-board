import { Cpu } from 'lucide-react';
import { fmtTime } from './terminalHelpers';

// ─── System message (compact) ───
export function SystemLine({ log }) {
  const msg = log.message;
  const isUsage = msg.startsWith('Usage:');
  const isInit = msg.startsWith('Session initialized');

  if (isUsage) {
    return (
      <div className="my-2 rounded-lg bg-claude/5 border border-claude/20 px-3 py-2 text-[11px] text-claude/80 flex items-center gap-3 flex-wrap">
        <Cpu size={12} className="flex-shrink-0" />
        <span>{msg}</span>
      </div>
    );
  }

  if (isInit) {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-surface-600">
        <span className="w-[48px] flex-shrink-0" />
        <span className="w-1.5 h-1.5 rounded-full bg-claude/50" />
        <span>{msg}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 py-1 text-[11px] ${
      log.log_type === 'error' ? 'text-red-400' :
      log.log_type === 'success' ? 'text-emerald-400' :
      'text-claude/70'
    }`}>
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
        {fmtTime(log.created_at)}
      </span>
      <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${
        log.log_type === 'error' ? 'bg-red-400' :
        log.log_type === 'success' ? 'bg-emerald-400' :
        'bg-claude/50'
      }`} />
      <span className="whitespace-pre-wrap break-words min-w-0">{msg}</span>
    </div>
  );
}
