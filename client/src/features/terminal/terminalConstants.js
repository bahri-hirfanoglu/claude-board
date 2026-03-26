import { Search, FileText, Terminal, FolderOpen, Code, Eye, Pencil, Zap, Globe, Layers, GitBranch } from 'lucide-react';

// ─── Tool icon registry ───
export const TOOL_ICONS = {
  Read: Eye,
  Write: FileText,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderOpen,
  WebFetch: Globe,
  WebSearch: Globe,
  Agent: Zap,
  Notebook: Code,
  Task: Layers,
  TodoWrite: GitBranch,
};

export function getToolIcon(name) {
  if (!name) return Code;
  for (const [k, I] of Object.entries(TOOL_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return I;
  }
  return Code;
}

// ─── Tool-specific color ───
export const TOOL_COLORS = {
  Read: 'text-sky-400',
  Write: 'text-emerald-400',
  Edit: 'text-yellow-400',
  Bash: 'text-amber-400',
  Grep: 'text-cyan-400',
  Glob: 'text-teal-400',
  WebFetch: 'text-blue-400',
  WebSearch: 'text-blue-400',
  Agent: 'text-violet-400',
};

export function getToolColor(name) {
  if (!name) return 'text-purple-400';
  for (const [k, c] of Object.entries(TOOL_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return c;
  }
  return 'text-purple-400';
}
