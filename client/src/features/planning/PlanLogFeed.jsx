import { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import { getToolIcon, getToolColor } from './planningHelpers';

export function PlanLogFeed({ logs, isActive }) {
  const endRef = useRef(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  // Group tool + result pairs
  const entries = useMemo(() => {
    const out = [];
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.type === 'tool') {
        // Parse tool name: "Read → src/file.rs" or just "Bash"
        const parts = log.message.split(' → ');
        const toolName = parts[0].trim();
        const detail = parts[1] || '';
        // Look ahead for matching result
        let result = null;
        if (i + 1 < logs.length && (logs[i + 1].type === 'result' || logs[i + 1].type === 'error')) {
          result = logs[i + 1];
          i++; // skip next
        }
        out.push({ type: 'tool_group', toolName, detail, result, ts: log.ts, index: out.length });
      } else if (log.type === 'result' || log.type === 'error') {
        // Orphan result (no matching tool)
        out.push({ type: 'standalone', log, index: out.length });
      }
    }
    return out;
  }, [logs]);

  const toggle = (idx) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    return next;
  });

  if (entries.length === 0 && isActive) {
    return (
      <div className="flex items-center gap-2.5 text-[11px] text-surface-500 py-4 px-3">
        <Loader2 size={13} className="animate-spin text-claude" />
        <span>Claude is analyzing the codebase...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        if (entry.type === 'tool_group') {
          const Icon = getToolIcon(entry.toolName);
          const color = getToolColor(entry.toolName);
          const isError = entry.result?.type === 'error';
          const hasResult = !!entry.result;
          const isOpen = expanded.has(entry.index);
          const resultText = entry.result?.message?.replace(/^[✓✗]\s*/, '') || '';

          let statusEl;
          if (!hasResult) statusEl = <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />;
          else if (isError) statusEl = <AlertCircle size={11} className="text-red-400 flex-shrink-0" />;
          else statusEl = <CheckCircle2 size={11} className="text-emerald-500/70 flex-shrink-0" />;

          return (
            <div key={entry.index} className={`rounded-lg border transition-all duration-200 ${
              isError ? 'border-red-500/20 bg-red-500/5' :
              !hasResult ? 'border-amber-500/15 bg-amber-500/5' :
              isOpen ? 'border-surface-600/40 bg-surface-800/50' :
              'border-surface-700/20 bg-surface-800/20 hover:border-surface-700/40'
            }`}>
              <button onClick={() => toggle(entry.index)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[11px]">
                {statusEl}
                <Icon size={12} className={`${color} flex-shrink-0`} />
                <span className={`font-semibold ${color}`}>{entry.toolName}</span>
                {entry.detail && <span className="text-surface-500 truncate text-[10px] min-w-0 flex-1 font-mono">{entry.detail}</span>}
                <span className="flex-shrink-0 ml-auto">
                  {isOpen ? <ChevronDown size={10} className="text-surface-500" /> : <ChevronRight size={10} className="text-surface-600" />}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-0 text-[10px] space-y-1.5 border-t border-surface-700/20">
                  {entry.detail && (
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-surface-600 w-10 flex-shrink-0 text-[9px] uppercase tracking-wide font-medium">path</span>
                      <span className="text-surface-300 font-mono break-all">{entry.detail}</span>
                    </div>
                  )}
                  {resultText && (
                    <div className="mt-1">
                      <div className="text-[9px] text-surface-600 mb-1 uppercase tracking-wide font-medium">output</div>
                      <pre className={`rounded-md bg-surface-950/80 border border-surface-700/20 px-2.5 py-2 text-[10px] font-mono overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed ${
                        isError ? 'text-red-400/80' : 'text-surface-400'
                      }`}>{resultText}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }
        // Standalone result/error
        const log = entry.log;
        const isError = log.type === 'error';
        return (
          <div key={entry.index} className={`flex items-start gap-2 text-[11px] px-3 py-1.5 ${isError ? 'text-red-400/80' : 'text-surface-500'}`}>
            {isError ? <AlertCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={10} className="text-emerald-400/60 flex-shrink-0 mt-0.5" />}
            <span className="truncate">{log.message}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
