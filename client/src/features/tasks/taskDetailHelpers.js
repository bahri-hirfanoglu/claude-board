export const TYPE_COLORS = {
  feature: 'bg-blue-500/15 text-blue-400',
  bugfix: 'bg-red-500/15 text-red-400',
  refactor: 'bg-purple-500/15 text-purple-400',
  docs: 'bg-green-500/15 text-green-400',
  test: 'bg-yellow-500/15 text-yellow-400',
  chore: 'bg-surface-500/15 text-surface-400',
};

export const STATUS_COLORS = {
  backlog: 'text-surface-400',
  in_progress: 'text-amber-400',
  testing: 'text-claude',
  done: 'text-emerald-400',
  failed: 'text-red-400',
};

export function getDiffLineClass(line) {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-surface-300 font-semibold px-4 py-0';
  if (line.startsWith('@@')) return 'text-cyan-400 bg-cyan-500/5 px-4 py-0.5';
  if (line.startsWith('diff --git'))
    return 'text-surface-200 font-semibold bg-surface-800/80 px-4 py-1 border-t border-surface-700/50';
  if (line.startsWith('+')) return 'text-emerald-400 bg-emerald-500/5 px-4 py-0';
  if (line.startsWith('-')) return 'text-red-400 bg-red-500/5 px-4 py-0';
  return 'text-surface-500 px-4 py-0';
}

export function parseTestReport(testReport) {
  if (!testReport) return null;
  if (typeof testReport !== 'string') return testReport;
  try {
    return JSON.parse(testReport);
  } catch {
    return null;
  }
}

export function getCheckStatusColors(status) {
  if (status === 'pass') return 'bg-emerald-500/15 text-emerald-400';
  if (status === 'fail') return 'bg-red-500/15 text-red-400';
  if (status === 'warn') return 'bg-amber-500/15 text-amber-400';
  return 'bg-surface-700/50 text-surface-500';
}

export function getCheckCardBorder(status) {
  if (status === 'fail') return 'bg-red-500/5 border-red-500/20';
  if (status === 'warn') return 'bg-amber-500/5 border-amber-500/20';
  if (status === 'pass') return 'bg-emerald-500/5 border-emerald-500/20';
  return 'bg-surface-800/30 border-surface-700/30';
}
