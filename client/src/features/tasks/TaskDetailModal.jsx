import { useState, useEffect, useRef } from 'react';
import {
  X,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Clock,
  Cpu,
  Coins,
  Activity,
  RotateCcw,
  Tag,
  User,
  Calendar,
  FileCode,
  Paperclip,
  Image,
  FileText,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatTokens, formatDuration } from '../../lib/formatters';
import { COLUMNS } from '../../lib/constants';

export default function TaskDetailModal({ task, onClose, onStatusChange }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const statusMenuRef = useRef(null);

  useEffect(() => {
    api
      .getTaskDetail(task.id)
      .then((d) => {
        setDetail(d);
        setAttachments(d.attachments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [task.id]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const close = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setShowStatusMenu(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('touchstart', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('touchstart', close);
    };
  }, [showStatusMenu]);

  const handleStatusChange = (newStatus) => {
    setShowStatusMenu(false);
    setCurrentStatus(newStatus);
    onStatusChange?.(task.id, newStatus);
  };

  const d = detail || task;
  const commits = detail?.commits || [];
  const revisions = detail?.revisions || [];
  const [attachments, setAttachments] = useState(detail?.attachments || []);
  const totalTokens = (d.input_tokens || 0) + (d.output_tokens || 0);
  const duration = formatDuration(d.started_at, d.completed_at, d.work_duration_ms, d.last_resumed_at);

  const TYPE_COLORS = {
    feature: 'bg-blue-500/15 text-blue-400',
    bugfix: 'bg-red-500/15 text-red-400',
    refactor: 'bg-purple-500/15 text-purple-400',
    docs: 'bg-green-500/15 text-green-400',
    test: 'bg-yellow-500/15 text-yellow-400',
    chore: 'bg-surface-500/15 text-surface-400',
  };
  const STATUS_COLORS = {
    backlog: 'text-surface-400',
    in_progress: 'text-amber-400',
    testing: 'text-claude',
    done: 'text-emerald-400',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-2xl shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-surface-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[d.task_type] || ''}`}>
                {d.task_type}
              </span>
              <div className="relative" ref={statusMenuRef}>
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-surface-800 transition-colors ${STATUS_COLORS[currentStatus]}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${COLUMNS.find(c => c.id === currentStatus)?.bg || ''}`} />
                  {currentStatus?.replace('_', ' ')}
                  <ChevronDown size={10} />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl min-w-[140px] z-10">
                    {COLUMNS.filter(c => c.id !== currentStatus).map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleStatusChange(c.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${c.bg}`} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-surface-600 font-mono">{d.task_key || `#${d.id}`}</span>
              {d.revision_count > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  Rev {d.revision_count}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-surface-100">{d.title}</h2>
            {d.description && <p className="text-xs text-surface-400 mt-1">{d.description}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 ml-3 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {duration && (
                <div className="bg-surface-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5">
                    <Clock size={9} />
                    Duration
                  </div>
                  <div className="text-sm font-semibold text-surface-200">{duration}</div>
                </div>
              )}
              {totalTokens > 0 && (
                <div className="bg-surface-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5">
                    <Cpu size={9} />
                    Tokens
                  </div>
                  <div className="text-sm font-semibold text-surface-200">{formatTokens(totalTokens)}</div>
                  <div className="text-[9px] text-surface-600">
                    {(d.input_tokens || 0).toLocaleString()} in / {(d.output_tokens || 0).toLocaleString()} out
                  </div>
                </div>
              )}
              {d.total_cost > 0 && (
                <div className="bg-surface-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5">
                    <Coins size={9} />
                    Cost
                  </div>
                  <div className="text-sm font-semibold text-surface-200">${d.total_cost.toFixed(4)}</div>
                </div>
              )}
              {d.num_turns > 0 && (
                <div className="bg-surface-800/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5">
                    <Activity size={9} />
                    Turns
                  </div>
                  <div className="text-sm font-semibold text-surface-200">{d.num_turns}</div>
                </div>
              )}
            </div>

            {/* Git Commits */}
            {commits.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
                  <GitCommit size={13} className="text-emerald-400" />
                  Commits ({commits.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {commits.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-surface-800/40 rounded-lg px-3 py-2 text-xs group"
                    >
                      <code className="text-amber-400/80 font-mono text-[10px] mt-0.5 flex-shrink-0">{c.short}</code>
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-200 truncate">{c.message}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-surface-600">
                          {c.author && (
                            <span className="flex items-center gap-0.5">
                              <User size={8} />
                              {c.author}
                            </span>
                          )}
                          {c.date && <span>{new Date(c.date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-surface-700 text-surface-600 hover:text-claude transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                          title="View on GitHub"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pull Request */}
            {d.pr_url && (
              <div>
                <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
                  <GitPullRequest size={13} className="text-purple-400" />
                  Pull Request
                </h3>
                <a
                  href={d.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5 text-sm text-purple-300 hover:bg-purple-500/15 transition-colors"
                >
                  <GitPullRequest size={14} />
                  <span className="truncate">{d.pr_url}</span>
                  <ExternalLink size={12} className="flex-shrink-0 ml-auto" />
                </a>
              </div>
            )}

            {/* Diff Preview */}
            {detail?.diff_stat && (
              <div>
                <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
                  <FileCode size={13} className="text-blue-400" />
                  File Changes
                </h3>
                <div className="bg-surface-800/40 rounded-lg px-4 py-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[250px] overflow-y-auto">
                  {detail.diff_stat.split('\n').map((line, i) => {
                    const isInsert = line.includes('+') && !line.includes('changed');
                    const isDelete = line.includes('-') && !line.includes('-->');
                    const isSummary = line.includes('file') && line.includes('changed');
                    return (
                      <div
                        key={i}
                        className={`whitespace-pre ${
                          isSummary
                            ? 'text-surface-300 font-semibold border-t border-surface-700/50 pt-2 mt-1'
                            : 'text-surface-400'
                        }`}
                      >
                        {line.split('').map((ch, j) => {
                          if (ch === '+')
                            return (
                              <span key={j} className="text-emerald-400">
                                {ch}
                              </span>
                            );
                          if (ch === '-' && !isSummary)
                            return (
                              <span key={j} className="text-red-400">
                                {ch}
                              </span>
                            );
                          return ch;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
                  <Paperclip size={13} className="text-cyan-400" />
                  Attachments ({attachments.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachments.map((a) => {
                    const isImage = a.mime_type?.startsWith('image/');
                    return (
                      <div key={a.id} className="bg-surface-800/40 rounded-lg overflow-hidden group relative">
                        {isImage ? (
                          <a
                            href={`/uploads/${a.filename}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={`/uploads/${a.filename}`}
                              alt={a.original_name}
                              className="w-full h-24 object-cover"
                            />
                            <div className="px-2 py-1.5">
                              <p className="text-[10px] text-surface-300 truncate">{a.original_name}</p>
                            </div>
                          </a>
                        ) : (
                          <a
                            href={`/uploads/${a.filename}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-3"
                          >
                            <FileText size={16} className="text-surface-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-surface-300 truncate">{a.original_name}</p>
                              <p className="text-[10px] text-surface-600">{(a.size / 1024).toFixed(1)}KB</p>
                            </div>
                          </a>
                        )}
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              await api.deleteAttachment(a.id);
                              setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                            } catch {}
                          }}
                          className="absolute top-1 right-1 p-1 rounded bg-black/60 text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete attachment"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No git info message */}
            {commits.length === 0 &&
              !d.pr_url &&
              !detail?.diff_stat &&
              (d.status === 'testing' || d.status === 'done') && (
                <div className="text-center text-surface-600 text-xs py-3 bg-surface-800/30 rounded-lg">
                  No git commits or PRs detected for this task
                </div>
              )}

            {/* Revisions */}
            {revisions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-amber-400" />
                  Revision History ({revisions.length})
                </h3>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="bg-surface-800/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Rev #{rev.revision_number}
                        </span>
                        <span className="text-[10px] text-surface-600">
                          {new Date(rev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-surface-300">{rev.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-4 pt-2 border-t border-surface-800 text-[10px] text-surface-600 flex-wrap">
              {d.model_used && (
                <span className="flex items-center gap-1">
                  <Tag size={9} />
                  Model: {d.model_used}
                </span>
              )}
              {d.started_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={9} />
                  Started: {new Date(d.started_at).toLocaleString()}
                </span>
              )}
              {d.completed_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={9} />
                  Completed: {new Date(d.completed_at).toLocaleString()}
                </span>
              )}
              {d.rate_limit_hits > 0 && <span className="text-amber-500">{d.rate_limit_hits} rate limit hits</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
