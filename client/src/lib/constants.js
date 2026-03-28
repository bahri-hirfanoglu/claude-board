// ─── Board columns ───
export const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'text-surface-400', bg: 'bg-surface-400', dot: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400', dot: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', color: 'text-claude', bg: 'bg-claude', dot: 'bg-claude' },
  { id: 'done', label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400', dot: 'bg-emerald-400' },
  { id: 'failed', label: 'Failed', color: 'text-red-400', bg: 'bg-red-400', dot: 'bg-red-400' },
  {
    id: 'awaiting_approval',
    label: 'Awaiting Approval',
    color: 'text-violet-400',
    bg: 'bg-violet-400',
    dot: 'bg-violet-400',
  },
];

// ─── Task types ───
export const TASK_TYPES = ['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'];

export const TASK_TYPE_OPTIONS = [
  { value: 'feature', label: 'Feature', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'bugfix', label: 'Bug Fix', color: 'bg-red-500/20 text-red-300' },
  { value: 'refactor', label: 'Refactor', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'docs', label: 'Docs', color: 'bg-green-500/20 text-green-300' },
  { value: 'test', label: 'Test', color: 'bg-yellow-500/20 text-yellow-300' },
  { value: 'chore', label: 'Chore', color: 'bg-surface-500/20 text-surface-300' },
];

export const TYPE_COLORS = {
  feature: 'bg-blue-500/15 text-blue-400',
  bugfix: 'bg-red-500/15 text-red-400',
  refactor: 'bg-purple-500/15 text-purple-400',
  docs: 'bg-green-500/15 text-green-400',
  test: 'bg-yellow-500/15 text-yellow-400',
  chore: 'bg-surface-500/15 text-surface-400',
};

// ─── Priority ───
export const PRIORITY_OPTIONS = [
  { value: 0, label: 'None', style: 'bg-surface-700 text-surface-300' },
  { value: 1, label: 'Low', style: 'bg-yellow-500/20 text-yellow-300' },
  { value: 2, label: 'Medium', style: 'bg-orange-500/20 text-orange-300' },
  { value: 3, label: 'High', style: 'bg-red-500/20 text-red-300' },
];
export const PRIORITY_COLORS = { 0: '', 1: 'border-l-yellow-500', 2: 'border-l-orange-500', 3: 'border-l-red-500' };
export const PRIORITY_LABELS = ['', 'Low', 'Medium', 'High'];

// ─── Models ───
export const MODELS = ['haiku', 'sonnet', 'opus'];

export const MODEL_OPTIONS = [
  { value: 'haiku', label: 'Haiku', color: 'bg-green-500/20 text-green-300' },
  { value: 'sonnet', label: 'Sonnet', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'opus', label: 'Opus', color: 'bg-purple-500/20 text-purple-300' },
];

export const MODEL_COLORS = { haiku: 'text-green-400', sonnet: 'text-blue-400', opus: 'text-purple-400' };
export const MODEL_DOT_COLORS = { haiku: '#4ade80', sonnet: '#60a5fa', opus: '#c084fc' };
export const MODEL_BG_ACTIVE = {
  haiku: 'bg-green-500/15 ring-green-500/30',
  sonnet: 'bg-blue-500/15 ring-blue-500/30',
  opus: 'bg-purple-500/15 ring-purple-500/30',
};

// ─── Effort levels ───
export const EFFORT_LEVELS = ['low', 'medium', 'high'];

export const EFFORT_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'high', label: 'High', color: 'bg-red-500/20 text-red-300' },
];

// ─── Token costs (USD per million tokens) ───
export const MODEL_COSTS = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
};

// ─── Defaults ───
export const DEFAULT_MODEL = 'sonnet';
export const DEFAULT_EFFORT = 'medium';
export const TOAST_TIMEOUT_MS = 3000;

// ─── Tags ───
const TAG_PALETTE = [
  'bg-blue-500/15 text-blue-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-purple-500/15 text-purple-400',
  'bg-amber-500/15 text-amber-400',
  'bg-pink-500/15 text-pink-400',
  'bg-cyan-500/15 text-cyan-400',
  'bg-red-500/15 text-red-400',
  'bg-teal-500/15 text-teal-400',
  'bg-orange-500/15 text-orange-400',
  'bg-violet-500/15 text-violet-400',
  'bg-lime-500/15 text-lime-400',
  'bg-rose-500/15 text-rose-400',
];
export function getTagColor(tag) {
  let hash = 0;
  for (const ch of tag) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

// ─── Avatar ───
export const AVATAR_COLORS = ['#DA7756', '#c4624a', '#e5936f', '#2a2520', '#918678'];
export const AVATAR_VARIANTS = ['marble', 'beam', 'pixel', 'sunset', 'ring', 'bauhaus'];
