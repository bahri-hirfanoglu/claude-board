import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Loader2, ExternalLink, Import, Check } from 'lucide-react';
import { api } from '../../lib/api';

const LABEL_COLORS = {
  bug: 'bg-red-500/15 text-red-400',
  enhancement: 'bg-blue-500/15 text-blue-400',
  feature: 'bg-blue-500/15 text-blue-400',
  documentation: 'bg-green-500/15 text-green-400',
  'good first issue': 'bg-purple-500/15 text-purple-400',
  'help wanted': 'bg-amber-500/15 text-amber-400',
};

function getLabelClass(name) {
  const lower = name.toLowerCase();
  for (const [key, cls] of Object.entries(LABEL_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-surface-700 text-surface-400';
}

export default function GitHubIssuesPanel({ projectId, onClose }) {
  const [issues, setIssues] = useState([]);
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importedNow, setImportedNow] = useState(new Set());

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.githubFetchIssues(projectId);
      setIssues(result?.issues || []);
      setRepo(result?.repo || '');
    } catch (e) {
      setError(e.message || 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const toggleSelect = (num) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  };

  const selectAllNew = () => {
    const newIssues = issues.filter((i) => !i.already_imported).map((i) => i.number);
    setSelected(new Set(newIssues));
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const nums = Array.from(selected);
      const result = await api.githubImportIssues(projectId, nums);
      if (result?.imported > 0) {
        setImportedNow((prev) => {
          const next = new Set(prev);
          nums.forEach((n) => next.add(n));
          return next;
        });
        setSelected(new Set());
        // Refresh to update already_imported flags
        await fetchIssues();
      }
    } catch (e) {
      setError(e.message || 'Failed to import issues');
    }
    setImporting(false);
  };

  const newCount = issues.filter((i) => !i.already_imported && !importedNow.has(i.number)).length;

  return (
    <div className="flex flex-col h-full bg-surface-900 border-l border-surface-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" className="text-surface-400">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-surface-200">GitHub Issues</div>
          {repo && <div className="text-[10px] text-surface-500 font-mono truncate">{repo}</div>}
        </div>
        <button
          onClick={fetchIssues}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Action bar */}
      {issues.length > 0 && !loading && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-800 bg-surface-900/80">
          <button
            onClick={selectAllNew}
            className="text-[10px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
          >
            Select all new ({newCount})
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-surface-700">|</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[10px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
              >
                Clear
              </button>
              <div className="ml-auto">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-lg bg-claude/15 text-claude hover:bg-claude/25 disabled:opacity-50 transition-colors"
                >
                  {importing ? <Loader2 size={12} className="animate-spin" /> : <Import size={12} />}
                  Import {selected.size} as task{selected.size > 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-surface-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {error && (
          <div className="m-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{error}</div>
        )}

        {!loading && !error && issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-surface-500 text-xs">
            <div className="text-2xl mb-2">🎉</div>
            No open issues
          </div>
        )}

        {!loading &&
          issues.map((issue) => {
            const imported = issue.already_imported || importedNow.has(issue.number);
            const isSelected = selected.has(issue.number);

            return (
              <div
                key={issue.number}
                onClick={() => !imported && toggleSelect(issue.number)}
                className={`flex items-start gap-3 px-4 py-3 border-b border-surface-800/50 cursor-pointer transition-colors ${
                  imported ? 'opacity-40 cursor-default' : isSelected ? 'bg-claude/5' : 'hover:bg-surface-800/50'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    imported
                      ? 'border-surface-700 bg-surface-800'
                      : isSelected
                        ? 'border-claude bg-claude'
                        : 'border-surface-700'
                  }`}
                >
                  {(imported || isSelected) && <Check size={10} className="text-white" />}
                </div>

                {/* Issue content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-surface-500 font-mono">#{issue.number}</span>
                    {imported && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        IMPORTED
                      </span>
                    )}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">
                      {issue.suggested_type}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-surface-200 mb-1 leading-snug">{issue.title}</div>
                  {issue.body && (
                    <div className="text-[10px] text-surface-500 line-clamp-2 leading-relaxed">
                      {issue.body.slice(0, 200)}
                    </div>
                  )}
                  {issue.labels?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {issue.labels.map((label) => (
                        <span
                          key={label.name}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${getLabelClass(label.name)}`}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* External link */}
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 p-1 rounded hover:bg-surface-700 text-surface-600 hover:text-surface-300 transition-colors flex-shrink-0"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            );
          })}
      </div>
    </div>
  );
}
