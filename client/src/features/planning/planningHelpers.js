import { Code } from 'lucide-react';
import { TOOL_ICONS, TOOL_COLORS } from './planningConstants';

/** Compute execution waves from index-based dependency pairs for DAG layout */
export function computeWaves(proposals, deps) {
  const n = proposals.length;
  if (n === 0) return [];
  // Build parent set for each task index
  const parents = Array.from({ length: n }, () => new Set());
  for (const [parentIdx, childIdx] of deps) {
    if (childIdx >= 0 && childIdx < n && parentIdx >= 0 && parentIdx < n) {
      parents[childIdx].add(parentIdx);
    }
  }
  const assigned = new Set();
  const waves = [];
  // Iteratively find tasks whose parents are all assigned
  for (let iter = 0; iter < n; iter++) {
    const wave = [];
    for (let i = 0; i < n; i++) {
      if (assigned.has(i)) continue;
      const allMet = [...parents[i]].every(p => assigned.has(p));
      if (allMet) wave.push(i);
    }
    if (wave.length === 0) break; // remaining tasks form a cycle — skip
    for (const id of wave) assigned.add(id);
    waves.push(wave.map(id => ({ id })));
  }
  // Any unassigned (cyclic) tasks go into last wave
  const remaining = [];
  for (let i = 0; i < n; i++) {
    if (!assigned.has(i)) remaining.push({ id: i });
  }
  if (remaining.length > 0) waves.push(remaining);
  return waves;
}

export function getToolIcon(name) {
  if (!name) return Code;
  for (const [k, I] of Object.entries(TOOL_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return I;
  }
  return Code;
}

export function getToolColor(name) {
  if (!name) return 'text-purple-400';
  for (const [k, c] of Object.entries(TOOL_COLORS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return c;
  }
  return 'text-purple-400';
}

export function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function getStepIndex(phase) {
  if (phase === 'idle' || phase === 'error') return 0;
  if (phase === 'thinking') return 1;
  if (phase === 'review') return 2;
  if (phase === 'approved') return 3;
  return 0;
}

// Persist planning state across modal open/close
const planCache = {};
export function getCache(pid) {
  if (!planCache[pid]) planCache[pid] = { phase: 'idle', planPhase: 'starting', logs: [], analysis: '', proposals: [], dependencies: [], stats: { elapsed: 0, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 }, error: null, topic: '', context: '', model: 'sonnet', effort: 'medium', granularity: 'balanced' };
  return planCache[pid];
}
