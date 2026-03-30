import { useMemo, useState } from 'react';
import { fmtTime } from './terminalHelpers';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Code block with basic JSON syntax highlighting ───
function CodeBlock({ code, lang }) {
  if (lang === 'json' || (code.trim().startsWith('{') && code.includes('"'))) {
    // JSON syntax coloring
    const highlighted = code
      .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="text-violet-400">$1</span>:')
      .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-emerald-400">$1</span>')
      .replace(/:\s*(true|false|null)\b/g, ': <span class="text-amber-400">$1</span>')
      .replace(/:\s*(-?\d+(?:\.\d+)?)\b/g, ': <span class="text-sky-400">$1</span>');
    return (
      <pre
        className="my-1.5 rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono text-surface-300 overflow-x-auto whitespace-pre-wrap leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }
  return (
    <pre className="my-1.5 rounded-md bg-surface-900/80 border border-surface-700/30 px-3 py-2 text-[11px] font-mono text-surface-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {code}
    </pre>
  );
}

// ─── Inline text rendering (bold, code) ───
export function InlineText({ text }) {
  if (!text?.trim()) return null;
  // Bold and inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <strong key={i} className="text-surface-100 font-semibold">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded bg-surface-800 text-amber-300/80 text-[11px] font-mono">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

// ─── Thinking block (collapsible, styled differently) ───
export function ThinkingBlock({ message, time }) {
  const [expanded, setExpanded] = useState(false);

  const preview = useMemo(() => {
    if (!message) return '';
    const first = message.split('\n')[0].trim();
    return first.length > 120 ? first.slice(0, 120) + '…' : first;
  }, [message]);

  const lineCount = useMemo(() => (message ? message.split('\n').length : 0), [message]);

  return (
    <div className="flex items-start gap-2 py-1.5 text-[13px]">
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none mt-0.5">
        {fmtTime(time)}
      </span>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-violet-400/80 hover:text-violet-300 transition-colors group"
        >
          <Brain size={12} className="flex-shrink-0" />
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-[11px] font-medium">Thinking</span>
          {!expanded && lineCount > 1 && <span className="text-[10px] text-surface-600 ml-1">({lineCount} lines)</span>}
        </button>
        {expanded ? (
          <div className="mt-1.5 pl-6 border-l-2 border-violet-500/20 text-surface-400 text-[12px] italic leading-relaxed">
            <InlineText text={message} />
          </div>
        ) : (
          <div className="pl-6 text-surface-500 text-[11px] italic truncate max-w-full">{preview}</div>
        )}
      </div>
    </div>
  );
}

// ─── Claude text block (with inline code/bold rendering) ───
export function ClaudeText({ message, time, isThinking }) {
  // Simple inline rendering: **bold**, `code`, ```codeblock```
  const rendered = useMemo(() => {
    if (isThinking) return null;
    if (!message) return null;

    // Check for code blocks
    if (message.includes('```')) {
      const parts = message.split(/(```[\s\S]*?```)/);
      return parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lang = (part.match(/^```(\w+)/) || [])[1] || '';
          const inner = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          return <CodeBlock key={i} code={inner} lang={lang} />;
        }
        return <InlineText key={i} text={part} />;
      });
    }

    // Standalone JSON object (entire message is JSON-like)
    if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(message.trim());
        return <CodeBlock code={JSON.stringify(parsed, null, 2)} lang="json" />;
      } catch {
        // Not valid JSON, render as text
      }
    }

    return <InlineText text={message} />;
  }, [message, isThinking]);

  if (isThinking) {
    return <ThinkingBlock message={message} time={time} />;
  }

  return (
    <div className="flex items-start gap-2 py-1.5 text-[13px] text-surface-200">
      <span className="text-surface-600 text-[10px] w-[48px] flex-shrink-0 text-right font-mono select-none mt-0.5">
        {fmtTime(time)}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">{rendered}</div>
    </div>
  );
}
