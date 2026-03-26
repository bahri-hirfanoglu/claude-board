import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { getToolIcon, getToolColor } from './terminalConstants';
import { fmtTime, fmtMs, shortenPath } from './terminalHelpers';

// ─── Unified tool card ───
export function ToolCard({ call, result, isExpanded, onToggle }) {
  const meta = call?.meta || result?.meta || {};
  const toolName = meta.toolName || 'unknown';
  const Icon = getToolIcon(toolName);
  const color = getToolColor(toolName);
  const input = call?.meta?.input || {};
  const resMeta = result?.meta || {};
  const isError = resMeta.isError;
  const duration = resMeta.duration;
  const hasResult = !!result;

  // Status indicator
  let statusEl = null;
  if (!hasResult) {
    statusEl = <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Running" />;
  } else if (isError) {
    statusEl = <AlertTriangle size={11} className="text-red-400" />;
  } else {
    statusEl = <CheckCircle2 size={11} className="text-emerald-500/70" />;
  }

  // Compact summary line
  let summary = '';
  if (input.file) summary = shortenPath(input.file);
  else if (input.command) summary = input.command;
  else if (input.pattern) summary = input.pattern;
  else if (input.description) summary = input.description;
  else if (input.prompt) summary = input.prompt;
  else if (input.query) summary = input.query;

  return (
    <div className={`my-1 rounded-lg border transition-colors ${
      isError ? 'border-red-500/20 bg-red-500/5' :
      !hasResult ? 'border-amber-500/20 bg-amber-500/5' :
      'border-surface-700/30 bg-surface-800/30 hover:border-surface-700/60'
    }`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs"
      >
        <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none">
          {fmtTime(call?.created_at || result?.created_at)}
        </span>
        {statusEl}
        <Icon size={14} className={`${color} flex-shrink-0`} />
        <span className={`font-semibold ${color}`}>{toolName}</span>

        {summary && (
          <span className="text-surface-400 truncate text-[11px] min-w-0 flex-1">{summary}</span>
        )}

        <span className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {duration && (
            <span className="text-[10px] text-surface-500 flex items-center gap-0.5">
              <Timer size={9} />
              {fmtMs(duration)}
            </span>
          )}
          {isExpanded ? <ChevronDown size={12} className="text-surface-600" /> : <ChevronRight size={12} className="text-surface-600" />}
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1 text-[11px] space-y-2 border-t border-surface-700/20">
          {/* Input details */}
          {call && (
            <div className="space-y-1">
              {input.file && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">path</span>
                  <span className="text-surface-300 font-mono break-all">{input.file}</span>
                </div>
              )}
              {input.command && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">cmd</span>
                  <code className="text-amber-400/80 font-mono break-all">{input.command}</code>
                </div>
              )}
              {input.pattern && !input.file && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">grep</span>
                  <code className="text-cyan-400/80 font-mono">{input.pattern}</code>
                  {input.glob && <span className="text-surface-500 ml-1">in {input.glob}</span>}
                </div>
              )}
              {input.editing && (
                <div className="mt-1 rounded-md bg-surface-900/80 border border-surface-700/30 overflow-hidden">
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-red-400/70 border-b border-surface-700/30 bg-red-500/5">
                    <span>-</span>
                    <span className="font-mono truncate">{input.oldString}</span>
                  </div>
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400/70 bg-emerald-500/5">
                    <span>+</span>
                    <span className="font-mono truncate">{input.newString}</span>
                  </div>
                </div>
              )}
              {input.contentLength && !input.editing && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">size</span>
                  <span className="text-surface-400">{input.contentLength.toLocaleString()} chars</span>
                </div>
              )}
              {input.description && !summary.includes(input.description) && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">desc</span>
                  <span className="text-surface-400">{input.description}</span>
                </div>
              )}
              {input.url && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">url</span>
                  <span className="text-blue-400/70 font-mono break-all">{input.url}</span>
                </div>
              )}
              {input.prompt && (
                <div className="flex gap-2">
                  <span className="text-surface-500 w-12 flex-shrink-0 font-medium">task</span>
                  <span className="text-violet-400/70">{input.prompt}</span>
                </div>
              )}
            </div>
          )}

          {/* Result output */}
          {resMeta.resultPreview && (
            <div className="mt-1.5">
              <div className="text-[10px] text-surface-500 mb-1 flex items-center gap-1 font-medium">
                output
                {resMeta.resultLines > 1 && <span className="text-surface-600 font-normal">({resMeta.resultLines} lines)</span>}
              </div>
              <pre className={`rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono overflow-x-auto max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed ${
                isError ? 'text-red-400/80' : 'text-surface-400'
              }`}>{resMeta.resultPreview}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
