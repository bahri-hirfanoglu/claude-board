import { MarkdownContent } from './MarkdownContent';

export function TaskRevisionsTab({ revisions }) {
  return (
    <div className="space-y-2.5">
      {revisions.map((rev) => (
        <div key={rev.id} className="bg-surface-800/40 rounded-lg px-4 py-3 border border-surface-700/30">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Rev #{rev.revision_number}</span>
            <span className="text-[10px] text-surface-600">{new Date(rev.created_at).toLocaleString()}</span>
          </div>
          <div className="text-xs text-surface-300"><MarkdownContent content={rev.feedback} /></div>
        </div>
      ))}
      {revisions.length === 0 && (
        <div className="text-center text-surface-600 text-xs py-8">No revisions</div>
      )}
    </div>
  );
}
