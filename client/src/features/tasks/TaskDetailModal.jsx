import { useState, useEffect, useRef } from 'react';
import {
  X, GitCommit, GitPullRequest, Clock, Cpu, Coins, Activity,
  RotateCcw, FileText, Paperclip,
  ChevronDown, FlaskConical,
  Layers, Link2,
} from 'lucide-react';
import { TagList } from '../board/TagBadge';
import { api } from '../../lib/api';
import { formatDuration } from '../../lib/formatters';
import { COLUMNS } from '../../lib/constants';
import { useTranslation } from '../../i18n/I18nProvider';
import SessionReplay from '../replay/SessionReplay';
import { TYPE_COLORS, STATUS_COLORS } from './taskDetailHelpers';
import { MarkdownContent } from './MarkdownContent';
import { TaskOverviewTab } from './TaskOverviewTab';
import { TaskGitTab } from './TaskGitTab';
import { TaskTestTab } from './TaskTestTab';
import { TaskAttachmentsTab } from './TaskAttachmentsTab';
import { TaskRevisionsTab } from './TaskRevisionsTab';
import { TaskDependenciesTab } from './TaskDependenciesTab';

export default function TaskDetailModal({ task, onClose, onStatusChange }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const statusMenuRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [deps, setDeps] = useState({ parents: [], children: [] });
  const [allTasks, setAllTasks] = useState([]);
  const [addDepId, setAddDepId] = useState('');
  const [addDepDirection, setAddDepDirection] = useState('parent'); // parent = "this depends on X"

  useEffect(() => {
    api.getTaskDetail(task.id)
      .then((d) => { setDetail(d); setAttachments(d.attachments || []); setLoading(false); })
      .catch(() => setLoading(false));
    api.getTaskDependencies(task.id).then(setDeps).catch(() => {});
    api.getTasks(task.project_id).then(setAllTasks).catch(() => {});
  }, [task.id, task.project_id]);

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

  // Determine available tabs
  const hasGit = commits.length > 0 || d.pr_url || detail?.diff_stat;
  const hasTest = !!d.test_report;
  const hasAttachments = attachments.length > 0;
  const hasRevisions = revisions.length > 0;
  const hasLifecycle = !!d.lifecycle_summary;

  const TABS = [
    { id: 'overview', label: t('detail.overview'), icon: Layers, always: true },
    { id: 'lifecycle', label: t('detail.summary'), icon: FileText, show: hasLifecycle },
    { id: 'git', label: t('detail.git'), icon: GitCommit, show: hasGit },
    { id: 'test', label: t('detail.test'), icon: FlaskConical, show: hasTest },
    { id: 'attachments', label: t('detail.files'), icon: Paperclip, show: hasAttachments },
    { id: 'revisions', label: t('detail.revisions'), icon: RotateCcw, show: hasRevisions },
    { id: 'dependencies', label: t('detail.dependencies') || 'Dependencies', icon: Link2, always: true },
    { id: 'replay', label: t('detail.replay'), icon: Activity, always: true },
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
              <TagList tags={d.tags} max={5} size="sm" />
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

              {activeTab === 'overview' && (
                <TaskOverviewTab d={d} detail={detail} task={task} />
              )}

              {activeTab === 'git' && (
                <TaskGitTab d={d} detail={detail} task={task} hasGit={hasGit} />
              )}

              {activeTab === 'test' && (
                <TaskTestTab d={d} />
              )}

              {activeTab === 'attachments' && (
                <TaskAttachmentsTab attachments={attachments} setAttachments={setAttachments} />
              )}

              {activeTab === 'revisions' && (
                <TaskRevisionsTab revisions={revisions} />
              )}

              {activeTab === 'lifecycle' && (
                <div className="space-y-4">
                  {d.lifecycle_summary ? (
                    <div className="bg-surface-800/30 border border-surface-700/30 rounded-xl p-5">
                      <MarkdownContent content={d.lifecycle_summary} />
                    </div>
                  ) : (
                    <div className="text-center text-surface-600 text-xs py-8">{t('detail.noLifecycleSummary')}</div>
                  )}
                </div>
              )}

              {activeTab === 'dependencies' && (
                <TaskDependenciesTab
                  task={task}
                  deps={deps}
                  setDeps={setDeps}
                  allTasks={allTasks}
                  currentStatus={currentStatus}
                  addDepId={addDepId}
                  setAddDepId={setAddDepId}
                  addDepDirection={addDepDirection}
                  setAddDepDirection={setAddDepDirection}
                />
              )}

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
