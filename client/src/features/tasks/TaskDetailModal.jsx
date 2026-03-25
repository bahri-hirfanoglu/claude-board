import { useState, useEffect, useRef } from 'react';
import {
  X, GitCommit, GitPullRequest, ExternalLink, Clock, Cpu, Coins, Activity,
  RotateCcw, Tag, User, Calendar, FileCode, Paperclip, Image, FileText,
  Trash2, ChevronDown, ChevronRight, FileDiff, FlaskConical,
  CircleCheck, CircleX, CircleAlert, CircleMinus, FileSearch, Layers,
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { api } from '../../lib/api';
import { formatTokens, formatDuration } from '../../lib/formatters';
import { COLUMNS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import SessionReplay from '../replay/SessionReplay';

function MarkdownContent({ content }) {
  if (!content) return null;
  const hasMarkdown = /```|^#{1,6}\s|^\*\s|^\-\s|\*\*|__|\[.*\]\(.*\)|^\d+\.\s/m.test(content);
  if (!hasMarkdown) {
    return <p className="text-xs text-surface-400 whitespace-pre-wrap leading-relaxed">{content}</p>;
  }
  return (
    <div data-color-mode="dark" className="md-preview-compact">
      <MDEditor.Markdown source={content} style={{ backgroundColor: 'transparent', color: '#a8a29e', fontSize: '12px', lineHeight: '1.6' }} />
    </div>
  );
}

const TYPE_COLORS = {
  feature: 'bg-blue-500/15 text-blue-400',
  bugfix: 'bg-red-500/15 text-red-400',
  refactor: 'bg-purple-500/15 text-purple-400',
  docs: 'bg-green-500/15 text-green-400',
  test: 'bg-yellow-500/15 text-yellow-400',
  chore: 'bg-surface-500/15 text-surface-400',
};
const STATUS_COLORS = {
  backlog: 'text-surface-400', in_progress: 'text-amber-400',
  testing: 'text-claude', done: 'text-emerald-400',
};

export default function TaskDetailModal({ task, onClose, onStatusChange }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [fullDiff, setFullDiff] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const statusMenuRef = useRef(null);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    api.getTaskDetail(task.id)
      .then((d) => { setDetail(d); setAttachments(d.attachments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [task.id]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const close = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) setShowStatusMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showStatusMenu]);

  const handleStatusChange = (newStatus) => {
    setShowStatusMenu(false);
    setCurrentStatus(newStatus);
    onStatusChange?.(task.id, newStatus);
    onClose?.();
  };

  const d = detail || task;
  const commits = detail?.commits || [];
  const revisions = detail?.revisions || [];
  const totalTokens = (d.input_tokens || 0) + (d.output_tokens || 0);
  const duration = formatDuration(d.started_at, d.completed_at, d.work_duration_ms, d.last_resumed_at);

  // Determine available tabs
  const hasGit = commits.length > 0 || d.pr_url || detail?.diff_stat;
  const hasTest = !!d.test_report;
  const hasAttachments = attachments.length > 0;
  const hasRevisions = revisions.length > 0;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Layers, always: true },
    { id: 'git', label: 'Git', icon: GitCommit, show: hasGit },
    { id: 'test', label: 'Test', icon: FlaskConical, show: hasTest },
    { id: 'attachments', label: 'Files', icon: Paperclip, show: hasAttachments },
    { id: 'revisions', label: 'Revisions', icon: RotateCcw, show: hasRevisions },
    { id: 'replay', label: 'Replay', icon: Activity, always: true },
  ].filter(tab => tab.always || tab.show);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-2xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header — always visible */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-surface-800 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[d.task_type] || ''}`}>{d.task_type}</span>
              <div className="relative" ref={statusMenuRef}>
                <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-surface-800 transition-colors ${STATUS_COLORS[currentStatus]}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${COLUMNS.find(c => c.id === currentStatus)?.bg || ''}`} />
                  {currentStatus?.replace('_', ' ')}
                  <ChevronDown size={10} />
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl min-w-[140px] z-10">
                    {COLUMNS.filter(c => c.id !== currentStatus).map(c => (
                      <button key={c.id} onClick={() => handleStatusChange(c.id)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full ${c.bg}`} />{c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-surface-600 font-mono">{d.task_key || `#${d.id}`}</span>
              {d.revision_count > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Rev {d.revision_count}</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-surface-100">{d.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-5 pt-2 pb-0 border-b border-surface-800 flex-shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive ? 'border-claude text-claude' : 'border-transparent text-surface-500 hover:text-surface-300'
                }`}>
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
            </div>
          ) : (
            <div className="px-5 py-4">

              {/* ═══ OVERVIEW TAB ═══ */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Description */}
                  {d.description && <MarkdownContent content={d.description} />}

                  {/* Acceptance Criteria */}
                  {d.acceptance_criteria && (
                    <div className="bg-surface-800/30 rounded-lg px-4 py-3 border border-surface-700/30">
                      <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Acceptance Criteria</span>
                      <div className="mt-1.5"><MarkdownContent content={d.acceptance_criteria} /></div>
                    </div>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {duration && (
                      <StatCard icon={Clock} label="Duration" value={duration} />
                    )}
                    {totalTokens > 0 && (
                      <StatCard icon={Cpu} label="Tokens" value={formatTokens(totalTokens)}
                        sub={`${(d.input_tokens || 0).toLocaleString()} in / ${(d.output_tokens || 0).toLocaleString()} out`} />
                    )}
                    {d.total_cost > 0 && (
                      <StatCard icon={Coins} label="Cost" value={`$${d.total_cost.toFixed(4)}`} />
                    )}
                    {d.num_turns > 0 && (
                      <StatCard icon={Activity} label="Turns" value={d.num_turns} />
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 pt-2 border-t border-surface-800 text-[10px] text-surface-600 flex-wrap">
                    {d.model_used && <span className="flex items-center gap-1"><Tag size={9} />Model: {d.model_used}</span>}
                    {d.started_at && <span className="flex items-center gap-1"><Calendar size={9} />Started: {new Date(d.started_at).toLocaleString()}</span>}
                    {d.completed_at && <span className="flex items-center gap-1"><Calendar size={9} />Completed: {new Date(d.completed_at).toLocaleString()}</span>}
                    {d.rate_limit_hits > 0 && <span className="text-amber-500">{d.rate_limit_hits} rate limit hits</span>}
                  </div>
                </div>
              )}

              {/* ═══ GIT TAB ═══ */}
              {activeTab === 'git' && (
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
                        Commits ({commits.length})
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
                        File Changes
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
                        View Full Diff
                        {diffLoading && <div className="w-3 h-3 rounded-full border border-surface-600 border-t-claude animate-spin ml-1" />}
                      </button>
                      {showFullDiff && fullDiff !== null && (
                        <div className="mt-2 bg-surface-950 border border-surface-800 rounded-lg overflow-hidden">
                          <div className="max-h-[400px] overflow-auto">
                            {fullDiff ? (
                              <pre className="text-[11px] font-mono leading-[1.6]">
                                {fullDiff.split('\n').map((line, i) => {
                                  let cls = 'text-surface-500 px-4 py-0';
                                  if (line.startsWith('+++') || line.startsWith('---')) cls = 'text-surface-300 font-semibold px-4 py-0';
                                  else if (line.startsWith('@@')) cls = 'text-cyan-400 bg-cyan-500/5 px-4 py-0.5';
                                  else if (line.startsWith('diff --git')) cls = 'text-surface-200 font-semibold bg-surface-800/80 px-4 py-1 border-t border-surface-700/50';
                                  else if (line.startsWith('+')) cls = 'text-emerald-400 bg-emerald-500/5 px-4 py-0';
                                  else if (line.startsWith('-')) cls = 'text-red-400 bg-red-500/5 px-4 py-0';
                                  return <div key={i} className={cls}><span className="text-surface-700 select-none inline-block w-8 text-right mr-3">{i + 1}</span>{line}</div>;
                                })}
                              </pre>
                            ) : (
                              <div className="text-center py-8 text-surface-600 text-xs">No diff available</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No git info */}
                  {!hasGit && (
                    <div className="text-center text-surface-600 text-xs py-8">No git commits or PRs detected for this task</div>
                  )}
                </div>
              )}

              {/* ═══ TEST TAB ═══ */}
              {activeTab === 'test' && (() => {
                try {
                  const report = typeof d.test_report === 'string' ? JSON.parse(d.test_report) : d.test_report;
                  if (!report) return <div className="text-center text-surface-600 text-xs py-8">No test report available</div>;
                  const verdict = report.verdict;
                  const checks = report.checks || [];
                  const StatusIcon = ({ s }) => {
                    if (s === 'pass') return <CircleCheck size={14} className="text-emerald-400" />;
                    if (s === 'fail') return <CircleX size={14} className="text-red-400" />;
                    if (s === 'warn') return <CircleAlert size={14} className="text-amber-400" />;
                    return <CircleMinus size={14} className="text-surface-500" />;
                  };
                  return (
                    <div className="space-y-4">
                      {/* Verdict banner */}
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        verdict === 'approve' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        {verdict === 'approve' ? <CircleCheck size={20} className="text-emerald-400" /> : <CircleX size={20} className="text-red-400" />}
                        <div>
                          <div className={`text-sm font-semibold ${verdict === 'approve' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {verdict === 'approve' ? 'All Checks Passed' : 'Verification Failed'}
                          </div>
                          {report.summary && <p className="text-xs text-surface-400 mt-0.5">{report.summary}</p>}
                        </div>
                      </div>

                      {/* Check cards */}
                      <div className="space-y-2">
                        {checks.map((check, i) => (
                          <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                            check.status === 'fail' ? 'bg-red-500/5 border-red-500/20' :
                            check.status === 'warn' ? 'bg-amber-500/5 border-amber-500/20' :
                            check.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' :
                            'bg-surface-800/30 border-surface-700/30'
                          }`}>
                            <StatusIcon s={check.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-surface-200">{check.name}</span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  check.status === 'pass' ? 'bg-emerald-500/15 text-emerald-400' :
                                  check.status === 'fail' ? 'bg-red-500/15 text-red-400' :
                                  check.status === 'warn' ? 'bg-amber-500/15 text-amber-400' :
                                  'bg-surface-700/50 text-surface-500'
                                }`}>{check.status}</span>
                              </div>
                              {check.detail && <p className="text-[11px] text-surface-400 mt-1 leading-relaxed">{check.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Feedback */}
                      {report.feedback && (
                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
                          <p className="text-[10px] font-semibold text-red-400 mb-1">Feedback</p>
                          <p className="text-xs text-red-300/80 whitespace-pre-wrap leading-relaxed">{report.feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                } catch { return <div className="text-center text-surface-600 text-xs py-8">Could not parse test report</div>; }
              })()}

              {/* ═══ ATTACHMENTS TAB ═══ */}
              {activeTab === 'attachments' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {attachments.map((a) => {
                      const isImage = a.mime_type?.startsWith('image/');
                      return (
                        <div key={a.id} className="bg-surface-800/40 rounded-lg overflow-hidden group relative border border-surface-700/30">
                          {isImage ? (
                            <a href={`/uploads/${a.filename}`} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={`/uploads/${a.filename}`} alt={a.original_name} className="w-full h-28 object-cover" />
                              <div className="px-2.5 py-2"><p className="text-[10px] text-surface-300 truncate">{a.original_name}</p></div>
                            </a>
                          ) : (
                            <a href={`/uploads/${a.filename}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-3">
                              <FileText size={16} className="text-surface-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-surface-300 truncate">{a.original_name}</p>
                                <p className="text-[10px] text-surface-600">{(a.size / 1024).toFixed(1)}KB</p>
                              </div>
                            </a>
                          )}
                          <button onClick={async (e) => {
                            e.preventDefault();
                            try { await api.deleteAttachment(a.id); setAttachments(prev => prev.filter(x => x.id !== a.id)); } catch {}
                          }} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Delete">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {attachments.length === 0 && (
                    <div className="text-center text-surface-600 text-xs py-8">No attachments</div>
                  )}
                </div>
              )}

              {/* ═══ REVISIONS TAB ═══ */}
              {activeTab === 'revisions' && (
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
              )}

              {/* ═══ REPLAY TAB ═══ */}
              {activeTab === 'replay' && (
                <div className="h-80 -mx-5 -mb-4">
                  <SessionReplay taskId={task.id} />
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/30">
      <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5"><Icon size={9} />{label}</div>
      <div className="text-sm font-semibold text-surface-200">{value}</div>
      {sub && <div className="text-[9px] text-surface-600">{sub}</div>}
    </div>
  );
}
