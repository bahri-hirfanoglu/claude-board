import { useMemo } from 'react';
import { fmtTime } from './terminalHelpers';

// ─── Inline text rendering (bold, code) ───
export function InlineText({ text }) {
  if (!text?.trim()) return null;
  // Bold and inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} className="text-surface-100 font-semibold">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} className="px-1.5 py-0.5 rounded bg-surface-800 text-amber-300/80 text-[11px] font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ─── Claude text block (with inline code/bold rendering) ───
export function ClaudeText({ message, time }) {
  // Simple inline rendering: **bold**, `code`, ```codeblock```
  const rendered = useMemo(() => {
    if (!message) return null;

    // Check for code blocks
    if (message.includes('```')) {
      const parts = message.split(/(```[\s\S]*?```)/);
      return parts.map((part, i) => {
        if (part.startsWith('```')) {
          const inner = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          return (
            <pre key={i} className="my-1.5 rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono text-surface-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {inner}
            </pre>
          );
        }
        return <InlineText key={i} text={part} />;
      });
    }

    return <InlineText text={message} />;
  }, [message]);

  return (
    <div className="flex items-start gap-2 py-1.5 text-[13px] text-surface-200">
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none mt-0.5">
        {fmtTime(time)}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">{rendered}</div>
    </div>
  );
}
