import {
  Eye, FileCode, Pencil, Terminal, Search, FolderOpen, Globe, Zap,
  Loader2, Brain, ListChecks,
} from 'lucide-react';

export const GRANULARITIES = [
  { value: 'high-level', label: 'High-level', desc: '3-5 big tasks', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'balanced', label: 'Balanced', desc: '5-10 medium tasks', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'detailed', label: 'Detailed', desc: '10-20 atomic tasks', color: 'bg-purple-500/20 text-purple-300' },
];

export const PHASES = [
  { key: 'starting', label: 'Analyzing', icon: Loader2, color: 'text-amber-400' },
  { key: 'exploring', label: 'Exploring', icon: Search, color: 'text-blue-400' },
  { key: 'writing', label: 'Planning', icon: Brain, color: 'text-purple-400' },
  { key: 'done', label: 'Review', icon: ListChecks, color: 'text-emerald-400' },
];

export const PRIORITY_COLORS = ['text-surface-500', 'text-yellow-400', 'text-orange-400', 'text-red-400'];

export const STEPS = [
  { num: 1, labelKey: 'planning.stepDefine' },
  { num: 2, labelKey: 'planning.stepAnalyze' },
  { num: 3, labelKey: 'planning.stepReview' },
  { num: 4, labelKey: 'planning.stepComplete' },
];

export const SUB_PHASES = [
  { key: 'starting', label: 'Starting' },
  { key: 'exploring', label: 'Exploring' },
  { key: 'writing', label: 'Planning' },
  { key: 'done', label: 'Finalizing' },
];

export const TOOL_ICONS = { Read: Eye, Write: FileCode, Edit: Pencil, Bash: Terminal, Grep: Search, Glob: FolderOpen, WebFetch: Globe, WebSearch: Globe, Agent: Zap };

export const TOOL_COLORS = { Read: 'text-sky-400', Write: 'text-emerald-400', Edit: 'text-yellow-400', Bash: 'text-amber-400', Grep: 'text-cyan-400', Glob: 'text-teal-400', WebFetch: 'text-blue-400', WebSearch: 'text-blue-400', Agent: 'text-violet-400' };
