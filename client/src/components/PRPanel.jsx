import { useState, useEffect } from 'react';
import { X, GitPullRequest, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function PRPanel({ projectId, onClose }) {
  const [mrs, setMrs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getMergeRequests(projectId);
      setMrs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  return (
    <div className="w-[380px] flex-shrink-0 flex flex-col bg-surface-900 border-l border-surface-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <GitPullRequest size={15} className="text-claude" />
          <h3 className="text-sm font-medium">Merge Requests</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading && mrs.length === 0 ? (
          <div className="text-center text-surface-600 py-12 text-sm">Loading...</div>
        ) : mrs.length === 0 ? (
          <div className="text-center text-surface-600 py-12 text-sm">
            <GitPullRequest size={32} className="mx-auto mb-3 opacity-30" />
            No open merge requests
            <p className="text-xs mt-1 text-surface-700">
              Configure GitLab in project settings to see MRs
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mrs.map((mr, i) => (
              <a
                key={i}
                href={mr.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-surface-800 border border-surface-700/50 hover:border-claude/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm text-surface-200 font-medium line-clamp-2">{mr.title}</h4>
                  <ExternalLink size={12} className="text-surface-600 group-hover:text-claude flex-shrink-0 mt-0.5 transition-colors" />
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-surface-500">
                  <span className="px-1.5 py-0.5 rounded bg-surface-700">{mr.project}</span>
                  <span>{mr.source_branch}</span>
                  <span className="text-surface-700">-&gt;</span>
                  <span>{mr.target_branch}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-surface-600">
                  <span>{mr.author}</span>
                  <span>{new Date(mr.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
