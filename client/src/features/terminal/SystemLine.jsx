import { Cpu, CheckCircle2, XCircle, AlertCircle, MinusCircle, ShieldCheck, ShieldX } from 'lucide-react';
import { fmtTime } from './terminalHelpers';

const CHECK_ICON = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  WARN: AlertCircle,
  SKIP: MinusCircle,
};
const CHECK_COLOR = {
  PASS: 'text-emerald-400',
  FAIL: 'text-red-400',
  WARN: 'text-amber-400',
  SKIP: 'text-surface-500',
};
const CHECK_BG = {
  PASS: 'bg-emerald-500/10 border-emerald-500/20',
  FAIL: 'bg-red-500/10 border-red-500/20',
  WARN: 'bg-amber-500/10 border-amber-500/20',
  SKIP: 'bg-surface-800/30 border-surface-700/30',
};

// Parse "Auto-test [PASS] Build: detail text"
function parseAutoTestCheck(msg) {
  const m = msg.match(/^Auto-test \[(PASS|FAIL|WARN|SKIP)]\s+(.+?):\s*(.*)$/);
  if (!m) return null;
  return { status: m[1], name: m[2], detail: m[3] };
}

// Parse "Auto-test PASSED: summary" or "Auto-test FAILED: summary — feedback"
function parseAutoTestVerdict(msg) {
  const m = msg.match(/^Auto-test (PASSED|FAILED):\s*(.*)$/);
  if (!m) return null;
  return { passed: m[1] === 'PASSED', summary: m[2] };
}

// ─── Auto-test check card ───
function AutoTestCheckLine({ check, time }) {
  const Icon = CHECK_ICON[check.status] || MinusCircle;
  const color = CHECK_COLOR[check.status] || 'text-surface-500';
  const bg = CHECK_BG[check.status] || CHECK_BG.SKIP;

  return (
    <div className="flex items-start gap-2 py-0.5 ml-[56px]">
      <div className={`flex items-center gap-2 flex-1 rounded-lg border px-3 py-1.5 ${bg}`}>
        <Icon size={14} className={`flex-shrink-0 ${color}`} />
        <span className={`text-[11px] font-semibold ${color}`}>{check.name}</span>
        <span className="text-[10px] text-surface-400 flex-1 min-w-0 truncate">{check.detail}</span>
      </div>
    </div>
  );
}

// ─── Auto-test verdict banner ───
function AutoTestVerdictLine({ verdict, time }) {
  const Icon = verdict.passed ? ShieldCheck : ShieldX;
  const borderColor = verdict.passed ? 'border-emerald-500/30' : 'border-red-500/30';
  const bgColor = verdict.passed ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const textColor = verdict.passed ? 'text-emerald-400' : 'text-red-400';
  const label = verdict.passed ? 'PASSED' : 'FAILED';

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
        {fmtTime(time)}
      </span>
      <div className={`flex items-center gap-2.5 flex-1 rounded-lg border ${borderColor} ${bgColor} px-3 py-2`}>
        <Icon size={16} className={textColor} />
        <span className={`text-[12px] font-bold ${textColor}`}>{label}</span>
        <span className="text-[11px] text-surface-300">{verdict.summary}</span>
      </div>
    </div>
  );
}

// ─── System message (compact) ───
export function SystemLine({ log }) {
  const msg = log.message;

  // Auto-test individual check
  const check = parseAutoTestCheck(msg);
  if (check) return <AutoTestCheckLine check={check} time={log.created_at} />;

  // Auto-test verdict banner
  const verdict = parseAutoTestVerdict(msg);
  if (verdict) return <AutoTestVerdictLine verdict={verdict} time={log.created_at} />;

  // Usage line
  if (msg.startsWith('Usage:')) {
    return (
      <div className="my-2 rounded-lg bg-claude/5 border border-claude/20 px-3 py-2 text-[11px] text-claude/80 flex items-center gap-3 flex-wrap">
        <Cpu size={12} className="flex-shrink-0" />
        <span>{msg}</span>
      </div>
    );
  }

  // Session init
  if (msg.startsWith('Session initialized')) {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-surface-600">
        <span className="w-[48px] flex-shrink-0" />
        <span className="w-1.5 h-1.5 rounded-full bg-claude/50" />
        <span>{msg}</span>
      </div>
    );
  }

  // Default
  return (
    <div
      className={`flex items-start gap-2 py-1 text-[11px] ${
        log.log_type === 'error' ? 'text-red-400' : log.log_type === 'success' ? 'text-emerald-400' : 'text-claude/70'
      }`}
    >
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
        {fmtTime(log.created_at)}
      </span>
      <span
        className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${
          log.log_type === 'error' ? 'bg-red-400' : log.log_type === 'success' ? 'bg-emerald-400' : 'bg-claude/50'
        }`}
      />
      <span className="whitespace-pre-wrap break-words min-w-0">{msg}</span>
    </div>
  );
}
