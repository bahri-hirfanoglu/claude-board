import { useState } from 'react';
import {
  GitCommit, GitPullRequest, ExternalLink, User, FileCode,
  ChevronDown, ChevronRight, FileDiff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getDiffLineClass } from './taskDetailHelpers';
import { useTranslation } from '../../i18n/I18nProvider';

export function TaskGitTab({ d, detail, task, hasGit }) {
  const { t } = useTranslation();
  const commits = detail?.commits || [];
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [fullDiff, setFullDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  return (
    <div className="space-y-4">
      {/* Pull Request */}
      {d.pr_url && (
        <a href={d.pr_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5 text-sm text-purple-300 hover:bg-purple-500/15 transition-colors">
          <GitPullRequest size={14} />
          <span className="truncate">{d.pr_url}</span>
          <ExternalLink size={12} className="flex-shrink-0 ml-auto" />
        </a>
      )}

      {/* Commits */}
      {commits.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
            <GitCommit size={13} className="text-emerald-400" />
            {t('detail.commits')} ({commits.length})
          </h3>
          <div className="space-y-1">
            {commits.map((c, i) => (
              <div key={i} className="flex items-start gap-2 bg-surface-800/40 rounded-lg px-3 py-2 text-xs group">
                <code className="text-amber-400/80 font-mono text-[10px] mt-0.5 flex-shrink-0">{c.short}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-surface-200 truncate">{c.message}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-surface-600">
                    {c.author && <span className="flex items-center gap-0.5"><User size={8} />{c.author}</span>}
                    {c.date && <span>{new Date(c.date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff stat */}
      {detail?.diff_stat && (
        <div>
          <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
            <FileCode size={13} className="text-blue-400" />
            {t('detail.fileChanges')}
          </h3>
          <div className="bg-surface-800/40 rounded-lg px-4 py-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[200px] overflow-y-auto">
            {detail.diff_stat.split('\n').map((line, i) => {
              const isSummary = line.includes('file') && line.includes('changed');
              return (
                <div key={i} className={`whitespace-pre ${isSummary ? 'text-surface-300 font-semibold border-t border-surface-700/50 pt-2 mt-1' : 'text-surface-400'}`}>
                  {line.split('').map((ch, j) => {
                    if (ch === '+') return <span key={j} className="text-emerald-400">{ch}</span>;
                    if (ch === '-' && !isSummary) return <span key={j} className="text-red-400">{ch}</span>;
                    return ch;
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full diff */}
      {detail?.diff_stat && (
        <div>
          <button onClick={() => {
            if (!showFullDiff && fullDiff === null) {
              setDiffLoading(true);
              api.getTaskDiff(task.id).then(r => setFullDiff(r.diff || '')).catch(() => setFullDiff('')).finally(() => setDiffLoading(false));
            }
            setShowFullDiff(!showFullDiff);
          }} className="flex items-center gap-1.5 text-xs font-medium text-surface-400 hover:text-surface-300 transition-colors">
            {showFullDiff ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <FileDiff size={12} className="text-violet-400" />
            {t('detail.viewFullDiff')}
            {diffLoading && <div className="w-3 h-3 rounded-full border border-surface-600 border-t-claude animate-spin ml-1" />}
          </button>
          {showFullDiff && fullDiff !== null && (
            <div className="mt-2 bg-surface-950 border border-surface-800 rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                {fullDiff ? (
                  <pre className="text-[11px] font-mono leading-[1.6]">
                    {fullDiff.split('\n').map((line, i) => {
                      const cls = getDiffLineClass(line);
                      return <div key={i} className={cls}><span className="text-surface-700 select-none inline-block w-8 text-right mr-3">{i + 1}</span>{line}</div>;
                    })}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-surface-600 text-xs">{t('detail.noDiff')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No git info */}
      {!hasGit && (
        <div className="text-center text-surface-600 text-xs py-8">{t('detail.noGitInfo')}</div>
      )}
    </div>
  );
}
