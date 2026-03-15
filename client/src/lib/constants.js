// ─── Board columns ───
export const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'text-surface-400', bg: 'bg-surface-400', dot: 'bg-surface-400' },
  { id: 'in_progress', label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400', dot: 'bg-amber-400' },
  { id: 'testing', label: 'Testing', color: 'text-claude', bg: 'bg-claude', dot: 'bg-claude' },
  { id: 'done', label: 'Done', color: 'text-emerald-400', bg: 'bg-emerald-400', dot: 'bg-emerald-400' },
];

// ─── Task types ───
export const TASK_TYPES = ['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'];

export const TYPE_COLORS = {
  feature: 'bg-blue-500/15 text-blue-400',
  bugfix: 'bg-red-500/15 text-red-400',
  refactor: 'bg-purple-500/15 text-purple-400',
  docs: 'bg-green-500/15 text-green-400',
  test: 'bg-yellow-500/15 text-yellow-400',
  chore: 'bg-surface-500/15 text-surface-400',
};

// ─── Priority ───
export const PRIORITY_COLORS = { 0: '', 1: 'border-l-yellow-500', 2: 'border-l-orange-500', 3: 'border-l-red-500' };
export const PRIORITY_LABELS = ['', 'Low', 'Medium', 'High'];

// ─── Models ───
export const MODELS = ['haiku', 'sonnet', 'opus'];
export const MODEL_COLORS = { haiku: 'text-green-400', sonnet: 'text-blue-400', opus: 'text-purple-400' };

// ─── Effort levels ───
export const EFFORT_LEVELS = ['low', 'medium', 'high'];

// ─── Avatar ───
export const AVATAR_COLORS = ['#DA7756', '#c4624a', '#e5936f', '#2a2520', '#918678'];
export const AVATAR_VARIANTS = ['marble', 'beam', 'pixel', 'sunset', 'ring', 'bauhaus'];
