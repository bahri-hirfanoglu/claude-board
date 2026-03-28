import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Target,
  Flag,
  FileText,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  Brain,
  Trash2,
  Edit3,
  Link2,
  Unlink,
  Zap,
  Eye,
  Hand,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import { tauriListen } from '../../lib/tauriEvents';

const PHASE_STATUS_COLORS = {
  pending: 'bg-surface-700 text-surface-400',
  planning: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  verifying: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

const PLAN_STATUS_COLORS = {
  pending: 'bg-surface-700 text-surface-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

const MS_STATUS_COLORS = {
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  archived: 'bg-surface-700 text-surface-500 border-surface-600',
};

const CHECKPOINT_ICONS = {
  auto: Zap,
  'human-verify': Eye,
  decision: AlertTriangle,
  'human-action': Hand,
};

const CHECKPOINT_COLORS = {
  auto: 'text-surface-500',
  'human-verify': 'text-purple-400',
  decision: 'text-amber-400',
  'human-action': 'text-rose-400',
};

function ProgressBar({ total, done, inProgress, failed }) {
  if (total === 0) return <div className="h-1.5 bg-surface-700 rounded-full" />;
  const pDone = (done / total) * 100;
  const pActive = (inProgress / total) * 100;
  const pFailed = (failed / total) * 100;
  return (
    <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden flex">
      {pDone > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${pDone}%` }} />}
      {pActive > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${pActive}%` }} />}
      {pFailed > 0 && <div className="bg-red-500 transition-all" style={{ width: `${pFailed}%` }} />}
    </div>
  );
}

function PlanRow({ plan, onRefresh, t }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);

  const loadTasks = useCallback(async () => {
    if (!expanded) return;
    try {
      const pts = await api.getPlanTasks(plan.id);
      setTasks(pts);
    } catch {}
  }, [plan.id, expanded]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleDeletePlan = async (e) => {
    e.stopPropagation();
    try {
      await api.deletePlan(plan.id);
      onRefresh();
    } catch {}
  };

  const handleUnlinkTask = async (taskId) => {
    try {
      await api.unlinkTaskFromPlan(plan.id, taskId);
      loadTasks();
      onRefresh();
    } catch {}
  };

  return (
    <div className="bg-surface-800/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-800 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={10} className="text-surface-600" />
        ) : (
          <ChevronRight size={10} className="text-surface-600" />
        )}
        <span className="text-[10px] font-mono text-surface-600">{plan.plan_number}</span>
        <span className="text-xs text-surface-300 flex-1 truncate">{plan.title}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${PLAN_STATUS_COLORS[plan.status] || PLAN_STATUS_COLORS.pending}`}
        >
          {plan.status}
        </span>
        {plan.task_count > 0 && (
          <span className="text-[10px] text-surface-500">
            {plan.done_count}/{plan.task_count}
          </span>
        )}
        <button
          onClick={handleDeletePlan}
          className="p-1 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={10} />
        </button>
      </button>

      {expanded && tasks.length > 0 && (
        <div className="border-t border-surface-700/50 px-3 py-2 space-y-1">
          {tasks.map((pt) => {
            const Icon = CHECKPOINT_ICONS[pt.checkpoint_type] || Zap;
            const iconColor = CHECKPOINT_COLORS[pt.checkpoint_type] || 'text-surface-500';
            return (
              <div key={pt.id} className="flex items-center gap-2 text-[11px]">
                <Icon size={10} className={iconColor} />
                <span className="text-surface-400">#{pt.task_id}</span>
                {pt.checkpoint_type !== 'auto' && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-surface-700 text-surface-500">
                    {pt.checkpoint_type}
                  </span>
                )}
                <button
                  onClick={() => handleUnlinkTask(pt.task_id)}
                  className="ml-auto p-0.5 rounded hover:bg-red-500/20 text-surface-700 hover:text-red-400 transition-colors"
                  title="Unlink task"
                >
                  <Unlink size={9} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  plans,
  progress,
  onToggle,
  expanded,
  onPlanPhase,
  onExecute,
  onInsertPhase,
  onRefresh,
  projectId,
  t,
}) {
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '' });
  const [showLinkTask, setShowLinkTask] = useState(null); // plan_id
  const [linkTaskId, setLinkTaskId] = useState('');
  const [linkCheckpoint, setLinkCheckpoint] = useState('auto');
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [newCriterion, setNewCriterion] = useState('');
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    title: phase.title,
    goal: phase.goal || '',
    description: phase.description || '',
  });

  const criteria = (() => {
    try {
      return JSON.parse(phase.success_criteria || '[]');
    } catch {
      return [];
    }
  })();
  const verifiedCount = criteria.filter((c) => c.verified).length;

  const handleAddPlan = async () => {
    if (!newPlan.title.trim()) return;
    const existingCount = plans.length;
    const planNum = `${phase.phase_number.replace('.', '')}-${String(existingCount + 1).padStart(2, '0')}`;
    try {
      await api.createPlan(phase.id, planNum, newPlan.title.trim(), '', 0);
      setNewPlan({ title: '' });
      setShowAddPlan(false);
      onRefresh();
    } catch {}
  };

  const handleLinkTask = async (planId) => {
    if (!linkTaskId.trim()) return;
    try {
      await api.linkTaskToPlan(planId, Number(linkTaskId), linkCheckpoint);
      setShowLinkTask(null);
      setLinkTaskId('');
      setLinkCheckpoint('auto');
      onRefresh();
    } catch {}
  };

  const handleToggleCriterion = async (index) => {
    try {
      await api.updateSuccessCriterion(phase.id, index, !criteria[index].verified);
      onRefresh();
    } catch {}
  };

  const handleAddCriterion = async () => {
    if (!newCriterion.trim()) return;
    const updated = [...criteria, { text: newCriterion.trim(), verified: false }];
    try {
      await api.updatePhase(
        phase.id,
        phase.title,
        phase.description,
        phase.goal,
        JSON.stringify(updated),
        phase.status,
      );
      setNewCriterion('');
      onRefresh();
    } catch {}
  };

  const handleDeletePhase = async () => {
    try {
      await api.deletePhase(phase.id);
      onRefresh();
    } catch {}
  };

  const handleSaveEdit = async () => {
    try {
      await api.updatePhase(
        phase.id,
        editFields.title,
        editFields.description,
        editFields.goal,
        phase.success_criteria,
        phase.status,
      );
      setEditing(false);
      onRefresh();
    } catch {}
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updatePhase(phase.id, phase.title, phase.description, phase.goal, phase.success_criteria, newStatus);
      onRefresh();
    } catch {}
  };

  return (
    <div className="border border-surface-700 rounded-lg overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors text-left"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-surface-500 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-surface-500 shrink-0" />
          )}
          <span className="text-xs font-mono text-surface-500 shrink-0 w-8">{phase.phase_number}</span>
          <span className="text-sm font-medium text-surface-200 flex-1 truncate">{phase.title}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${PHASE_STATUS_COLORS[phase.status] || PHASE_STATUS_COLORS.pending}`}
          >
            {phase.status}
          </span>
          {progress.total > 0 && (
            <span className="text-[10px] text-surface-500">
              {progress.done}/{progress.total}
            </span>
          )}
        </button>

        {/* Phase actions */}
        <div className="flex items-center gap-1 pr-3">
          {(phase.status === 'pending' || phase.status === 'planning') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlanPhase(phase);
              }}
              className="p-1.5 rounded hover:bg-blue-500/20 text-surface-500 hover:text-blue-400 transition-colors"
              title="AI Plan Phase"
            >
              <Brain size={14} />
            </button>
          )}
          {plans.length > 0 && phase.status !== 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExecute(phase);
              }}
              className="p-1.5 rounded hover:bg-emerald-500/20 text-surface-500 hover:text-emerald-400 transition-colors"
              title="Execute Phase"
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInsertPhase(phase);
            }}
            className="p-1.5 rounded hover:bg-amber-500/20 text-surface-500 hover:text-amber-400 transition-colors"
            title="Insert Phase After"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="p-1.5 rounded hover:bg-surface-700 text-surface-600 hover:text-surface-400 transition-colors"
            title="Edit Phase"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePhase();
            }}
            className="p-1.5 rounded hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-colors"
            title="Delete Phase"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-700 px-4 py-3 space-y-3">
          {/* Edit form */}
          {editing ? (
            <div className="space-y-2 p-2 border border-surface-600 rounded-lg bg-surface-800/50">
              <input
                type="text"
                value={editFields.title}
                onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                placeholder="Phase title"
              />
              <input
                type="text"
                value={editFields.goal}
                onChange={(e) => setEditFields((f) => ({ ...f, goal: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                placeholder="Goal"
              />
              <textarea
                value={editFields.description}
                onChange={(e) => setEditFields((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 resize-none"
                rows={2}
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 bg-claude/20 text-claude text-xs rounded hover:bg-claude/30"
                >
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-surface-500 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {phase.goal && (
                <div className="flex items-start gap-2">
                  <Target size={12} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-surface-400">{phase.goal}</p>
                </div>
              )}
              {phase.description && <p className="text-xs text-surface-500">{phase.description}</p>}
            </>
          )}

          {/* Manual status change */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-surface-600">Status:</span>
            <select
              value={phase.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-1.5 py-0.5 bg-surface-800 border border-surface-700 rounded text-[10px] text-surface-300"
            >
              <option value="pending">{t('roadmap.pending')}</option>
              <option value="planning">{t('roadmap.planning')}</option>
              <option value="in_progress">{t('roadmap.inProgress')}</option>
              <option value="verifying">{t('roadmap.verifying')}</option>
              <option value="completed">{t('roadmap.completed')}</option>
              <option value="failed">{t('roadmap.failed')}</option>
            </select>
          </div>

          {progress.total > 0 && (
            <ProgressBar
              total={progress.total}
              done={progress.done}
              inProgress={progress.in_progress}
              failed={progress.failed}
            />
          )}

          {/* Success criteria - interactive */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={10} />
                {t('roadmap.successCriteria')} ({verifiedCount}/{criteria.length})
              </div>
              <button
                onClick={() => setEditingCriteria(!editingCriteria)}
                className="text-surface-600 hover:text-surface-400 transition-colors"
              >
                <Edit3 size={10} />
              </button>
            </div>
            {criteria.map((c, i) => (
              <button
                key={i}
                onClick={() => handleToggleCriterion(i)}
                className="flex items-center gap-2 text-xs w-full text-left hover:bg-surface-800/30 rounded px-1 py-0.5 transition-colors"
              >
                {c.verified ? (
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={12} className="text-surface-600 shrink-0" />
                )}
                <span className={c.verified ? 'text-surface-400 line-through' : 'text-surface-300'}>
                  {c.text || c.criterion || c}
                </span>
              </button>
            ))}
            {editingCriteria && (
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  placeholder={t('roadmap.addCriterion')}
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCriterion()}
                  className="flex-1 px-2 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
                  autoFocus
                />
                <button
                  onClick={handleAddCriterion}
                  className="px-2 py-1 bg-claude/20 text-claude text-xs rounded hover:bg-claude/30"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Plans */}
          {plans.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={10} /> {t('roadmap.plan')}s ({plans.length})
              </div>
              {plans.map((p) => (
                <div key={p.id}>
                  <PlanRow plan={p} onRefresh={onRefresh} t={t} />
                  {/* Link task button */}
                  {showLinkTask === p.id ? (
                    <div className="flex gap-1 mt-1 ml-4">
                      <input
                        type="number"
                        placeholder="Task ID"
                        value={linkTaskId}
                        onChange={(e) => setLinkTaskId(e.target.value)}
                        className="w-20 px-2 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                        autoFocus
                      />
                      <select
                        value={linkCheckpoint}
                        onChange={(e) => setLinkCheckpoint(e.target.value)}
                        className="px-1 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                      >
                        <option value="auto">auto</option>
                        <option value="human-verify">human-verify</option>
                        <option value="decision">decision</option>
                        <option value="human-action">human-action</option>
                      </select>
                      <button
                        onClick={() => handleLinkTask(p.id)}
                        className="px-2 py-1 bg-claude/20 text-claude text-xs rounded"
                      >
                        <Link2 size={10} />
                      </button>
                      <button onClick={() => setShowLinkTask(null)} className="px-2 py-1 text-surface-500 text-xs">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowLinkTask(p.id)}
                      className="ml-4 mt-1 flex items-center gap-1 text-[10px] text-surface-600 hover:text-surface-400 transition-colors"
                    >
                      <Link2 size={9} /> {t('roadmap.linkTask')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add plan */}
          {showAddPlan ? (
            <div className="flex gap-1">
              <input
                type="text"
                placeholder={`${t('roadmap.plan')} title`}
                value={newPlan.title}
                onChange={(e) => setNewPlan({ title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlan()}
                className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
                autoFocus
              />
              <button
                onClick={handleAddPlan}
                className="px-2 py-1.5 bg-claude/20 text-claude text-xs rounded hover:bg-claude/30"
              >
                {t('roadmap.addPlan')}
              </button>
              <button onClick={() => setShowAddPlan(false)} className="px-2 py-1.5 text-surface-500 text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPlan(true)}
              className="flex items-center gap-1 text-[10px] text-surface-600 hover:text-surface-400 transition-colors"
            >
              <Plus size={10} /> {t('roadmap.addPlan')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneSection({ milestone, phases, onRefresh, projectId, onPlanPhase, onExecutePhase, t }) {
  const [expandedPhases, setExpandedPhases] = useState(new Set());
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({ number: '', title: '', goal: '' });
  const [editingMs, setEditingMs] = useState(false);
  const [msEdit, setMsEdit] = useState({
    version: milestone.version,
    title: milestone.title,
    description: milestone.description || '',
  });
  const [insertAfter, setInsertAfter] = useState(null); // phase_number to insert after
  const [insertFields, setInsertFields] = useState({ title: '', goal: '' });

  const togglePhase = (id) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddPhase = async () => {
    if (!newPhase.title.trim()) return;
    try {
      await api.createPhase(
        milestone.id,
        projectId,
        newPhase.number || String(phases.length + 1),
        newPhase.title,
        '',
        newPhase.goal,
        '[]',
      );
      setNewPhase({ number: '', title: '', goal: '' });
      setShowAddPhase(false);
      onRefresh();
    } catch {}
  };

  const handleDeleteMilestone = async () => {
    try {
      await api.deleteMilestone(milestone.id);
      onRefresh();
    } catch {}
  };

  const handleSaveMs = async () => {
    try {
      await api.updateMilestone(milestone.id, msEdit.version, msEdit.title, msEdit.description, milestone.status);
      setEditingMs(false);
      onRefresh();
    } catch {}
  };

  const handleMsStatus = async (status) => {
    try {
      await api.updateMilestone(milestone.id, milestone.version, milestone.title, milestone.description, status);
      onRefresh();
    } catch {}
  };

  const handleInsertPhase = async () => {
    if (!insertFields.title.trim() || !insertAfter) return;
    try {
      await api.insertPhase(milestone.id, projectId, insertAfter, insertFields.title, '', insertFields.goal, '[]');
      setInsertAfter(null);
      setInsertFields({ title: '', goal: '' });
      onRefresh();
    } catch {}
  };

  const totalProgress = phases.reduce(
    (acc, p) => ({
      total: acc.total + p.progress.total,
      done: acc.done + p.progress.done,
      in_progress: acc.in_progress + p.progress.in_progress,
      failed: acc.failed + p.progress.failed,
    }),
    { total: 0, done: 0, in_progress: 0, failed: 0 },
  );

  const completedPhases = phases.filter((p) => p.status === 'completed').length;

  return (
    <div className="space-y-3">
      {/* Milestone header */}
      {editingMs ? (
        <div className="space-y-2 p-3 border border-surface-600 rounded-lg bg-surface-800/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={msEdit.version}
              onChange={(e) => setMsEdit((f) => ({ ...f, version: e.target.value }))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
              placeholder="v1.0"
            />
            <input
              type="text"
              value={msEdit.title}
              onChange={(e) => setMsEdit((f) => ({ ...f, title: e.target.value }))}
              className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
            />
          </div>
          <input
            type="text"
            value={msEdit.description}
            onChange={(e) => setMsEdit((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
            placeholder="Description"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveMs} className="px-3 py-1 bg-claude/20 text-claude text-xs rounded">
              Save
            </button>
            <button onClick={() => setEditingMs(false)} className="px-3 py-1 text-surface-500 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${MS_STATUS_COLORS[milestone.status] || MS_STATUS_COLORS.active}`}
            >
              <Flag size={12} />
              {milestone.version}
            </div>
            <h3 className="text-sm font-semibold text-surface-200 flex-1">{milestone.title}</h3>
            <span className="text-[10px] text-surface-500">
              {completedPhases}/{phases.length} phases
              {totalProgress.total > 0 && ` \u00b7 ${totalProgress.done}/${totalProgress.total} ${t('roadmap.tasks')}`}
            </span>
            <select
              value={milestone.status}
              onChange={(e) => handleMsStatus(e.target.value)}
              className="px-1.5 py-0.5 bg-surface-800 border border-surface-700 rounded text-[10px] text-surface-400"
            >
              <option value="active">{t('roadmap.active')}</option>
              <option value="completed">{t('roadmap.completed')}</option>
              <option value="archived">{t('roadmap.archived')}</option>
            </select>
            <button
              onClick={() => setEditingMs(true)}
              className="p-1 rounded hover:bg-surface-700 text-surface-600 hover:text-surface-400 transition-colors"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={handleDeleteMilestone}
              className="p-1 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
          {milestone.description && <p className="text-xs text-surface-500 ml-1">{milestone.description}</p>}
        </>
      )}

      {totalProgress.total > 0 && (
        <ProgressBar
          total={totalProgress.total}
          done={totalProgress.done}
          inProgress={totalProgress.in_progress}
          failed={totalProgress.failed}
        />
      )}

      {/* Phases */}
      <div className="space-y-2 ml-1">
        {phases.map((phaseData) => (
          <div key={phaseData.id}>
            <PhaseCard
              phase={phaseData}
              plans={phaseData.plans || []}
              progress={phaseData.progress || { total: 0, done: 0, in_progress: 0, failed: 0 }}
              expanded={expandedPhases.has(phaseData.id)}
              onToggle={() => togglePhase(phaseData.id)}
              onPlanPhase={onPlanPhase}
              onExecute={onExecutePhase}
              onInsertPhase={(ph) => setInsertAfter(ph.phase_number)}
              onRefresh={onRefresh}
              projectId={projectId}
              t={t}
            />
            {/* Insert phase form after this phase */}
            {insertAfter === phaseData.phase_number && (
              <div className="ml-4 mt-1 mb-1 border border-amber-500/30 rounded-lg p-2 space-y-1 bg-amber-500/5">
                <div className="text-[10px] text-amber-400">Insert phase after {insertAfter}</div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Phase title"
                    value={insertFields.title}
                    onChange={(e) => setInsertFields((f) => ({ ...f, title: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleInsertPhase()}
                  />
                  <input
                    type="text"
                    placeholder="Goal"
                    value={insertFields.goal}
                    onChange={(e) => setInsertFields((f) => ({ ...f, goal: e.target.value }))}
                    className="flex-1 px-2 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleInsertPhase}
                    className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded"
                  >
                    {t('roadmap.insertPhase')}
                  </button>
                  <button onClick={() => setInsertAfter(null)} className="px-2 py-1 text-surface-500 text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add phase */}
      {showAddPhase ? (
        <div className="ml-1 border border-surface-700 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('roadmap.phaseNumber')}
              value={newPhase.number}
              onChange={(e) => setNewPhase((p) => ({ ...p, number: e.target.value }))}
              className="w-16 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
            />
            <input
              type="text"
              placeholder={`${t('roadmap.phase')} title`}
              value={newPhase.title}
              onChange={(e) => setNewPhase((p) => ({ ...p, title: e.target.value }))}
              className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
            />
          </div>
          <input
            type="text"
            placeholder={t('roadmap.goal')}
            value={newPhase.goal}
            onChange={(e) => setNewPhase((p) => ({ ...p, goal: e.target.value }))}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddPhase}
              className="px-3 py-1 bg-claude/20 text-claude text-xs rounded hover:bg-claude/30 transition-colors"
            >
              {t('roadmap.addPhase')}
            </button>
            <button
              onClick={() => setShowAddPhase(false)}
              className="px-3 py-1 text-surface-500 text-xs rounded hover:text-surface-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddPhase(true)}
          className="ml-1 flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
        >
          <Plus size={12} /> {t('roadmap.addPhase')}
        </button>
      )}
    </div>
  );
}

// ─── Planning Modal ───

function PhasePlanningModal({ phase, projectId, onClose, onRefresh }) {
  const [status, setStatus] = useState('idle'); // idle, planning, proposals, approving
  const [model, setModel] = useState('sonnet');
  const [proposals, setProposals] = useState([]);
  const [deps, setDeps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [planTitle, setPlanTitle] = useState(`Plan for Phase ${phase.phase_number}`);
  const [activePlanId, setActivePlanId] = useState(null);

  const startPlanning = async () => {
    setStatus('planning');
    setLogs([]);
    setProposals([]);
    try {
      const result = await api.planPhase(projectId, phase.id, model, 'medium');
      if (result?.planId) setActivePlanId(result.planId);
    } catch {
      setStatus('idle');
    }
  };

  // Listen for planning events - filtered by projectId
  useEffect(() => {
    const unsubs = [
      tauriListen('plan:progress', (p) => {
        if (p.projectId !== projectId) return;
        if (p.type === 'text') {
          setLogs((prev) => [...prev.slice(-50), { type: 'text', content: p.content }]);
        }
      }),
      tauriListen('plan:log', (p) => {
        if (p.projectId !== projectId) return;
        setLogs((prev) => [...prev.slice(-50), { type: p.type, content: p.message }]);
      }),
      tauriListen('plan:phase', (p) => {
        if (p.projectId !== projectId) return;
        if (p.phase === 'exploring' || p.phase === 'writing') {
          setLogs((prev) => [...prev.slice(-50), { type: 'phase', content: `Phase: ${p.phase}` }]);
        }
      }),
      tauriListen('plan:completed', (p) => {
        if (p.projectId !== projectId) return;
        if (p.proposals && p.proposals.length > 0) {
          setProposals(p.proposals);
          setDeps(p.dependencies || []);
          setStatus('proposals');
        } else {
          // Show the analysis text so user knows planning finished but couldn't parse tasks
          setLogs((prev) => [
            ...prev,
            {
              type: 'error',
              content: 'Planning finished but no tasks were parsed. Try again with more detail in the phase goal.',
            },
          ]);
          setStatus('idle');
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [projectId]);

  const handleApprove = async () => {
    setStatus('approving');
    try {
      await api.approvePhasePlan(projectId, phase.id, planTitle, proposals, model, deps);
      onRefresh();
      onClose();
    } catch {
      setStatus('proposals');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-850 border border-surface-700 rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700">
          <Brain size={18} className="text-blue-400" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-surface-100">
              AI Plan: Phase {phase.phase_number} - {phase.title}
            </h3>
            <p className="text-[10px] text-surface-500 mt-0.5">{phase.goal}</p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {status === 'idle' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-surface-400">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200"
                >
                  <option value="haiku">Haiku (Fast)</option>
                  <option value="sonnet">Sonnet (Balanced)</option>
                  <option value="opus">Opus (Best)</option>
                </select>
              </div>
              <button
                onClick={startPlanning}
                className="w-full py-2 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Brain size={16} /> Start AI Planning
              </button>
            </>
          )}

          {status === 'planning' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 size={14} className="animate-spin" />
                Planning in progress...
              </div>
              <div className="bg-surface-900 rounded-lg p-3 max-h-48 overflow-auto">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={`text-[10px] font-mono ${l.type === 'error' ? 'text-red-400' : l.type === 'tool' ? 'text-amber-400' : 'text-surface-500'}`}
                  >
                    {l.content?.substring(0, 200)}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-[10px] text-surface-600">Waiting for output...</div>}
              </div>
            </div>
          )}

          {status === 'proposals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-surface-300">{proposals.length} tasks proposed</span>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  className="px-2 py-1 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 w-48"
                  placeholder="Plan title"
                />
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {proposals.map((p, i) => (
                  <div key={i} className="bg-surface-800/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-surface-600">#{i + 1}</span>
                      <span className="text-xs font-medium text-surface-200">{p.title}</span>
                      <span className="text-[10px] px-1 py-0.5 rounded bg-surface-700 text-surface-500">
                        {p.task_type || 'feature'}
                      </span>
                    </div>
                    {p.description && <p className="text-[10px] text-surface-500 line-clamp-2">{p.description}</p>}
                    {p.acceptance_criteria && (
                      <p className="text-[10px] text-emerald-400/70">
                        <CheckCircle2 size={9} className="inline mr-1" />
                        {p.acceptance_criteria}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {deps.length > 0 && (
                <div className="text-[10px] text-surface-500">
                  {deps.length} dependency edge{deps.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {status === 'approving' && (
            <div className="flex items-center justify-center py-8 gap-2 text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              Creating tasks...
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'proposals' && (
          <div className="flex gap-2 px-5 py-4 border-t border-surface-700">
            <button
              onClick={handleApprove}
              className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} /> Approve & Create Tasks
            </button>
            <button
              onClick={() => {
                setStatus('idle');
                setProposals([]);
              }}
              className="px-4 py-2 text-surface-500 text-sm rounded-lg hover:text-surface-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function RoadmapView({ projectId, project }) {
  const { t } = useTranslation();
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMs, setShowCreateMs] = useState(false);
  const [newMs, setNewMs] = useState({ version: '', title: '', description: '' });
  const [planningPhase, setPlanningPhase] = useState(null);

  const loadRoadmap = useCallback(async () => {
    try {
      const data = await api.getRoadmap(projectId);
      setRoadmap(data);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  useEffect(() => {
    return tauriListen('roadmap:updated', (payload) => {
      if (payload === projectId) loadRoadmap();
    });
  }, [projectId, loadRoadmap]);

  const handleCreateMilestone = async () => {
    if (!newMs.title.trim() || !newMs.version.trim()) return;
    try {
      await api.createMilestone(projectId, newMs.version.trim(), newMs.title.trim(), newMs.description);
      setNewMs({ version: '', title: '', description: '' });
      setShowCreateMs(false);
      loadRoadmap();
    } catch {}
  };

  const handlePlanPhase = (phase) => {
    setPlanningPhase(phase);
  };

  const handleExecutePhase = async (phase) => {
    try {
      await api.executePhase(projectId, phase.id);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-surface-500" />
      </div>
    );
  }

  const milestones = roadmap?.milestones || [];

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-surface-100">{t('roadmap.title')}</h2>
          <p className="text-[10px] text-surface-600 mt-0.5">GSD Workflow - Milestone → Phase → Plan → Task</p>
        </div>
        <button
          onClick={() => setShowCreateMs(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-claude/15 text-claude text-xs font-medium rounded-lg hover:bg-claude/25 transition-colors"
        >
          <Plus size={14} /> {t('roadmap.createMilestone')}
        </button>
      </div>

      {/* Create milestone form */}
      {showCreateMs && (
        <div className="border border-surface-700 rounded-xl p-4 space-y-3 bg-surface-850">
          <h3 className="text-sm font-medium text-surface-200">{t('roadmap.createMilestone')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="v1.0"
              value={newMs.version}
              onChange={(e) => setNewMs((p) => ({ ...p, version: e.target.value }))}
              className="w-20 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
              autoFocus
            />
            <input
              type="text"
              placeholder={`${t('roadmap.milestone')} title`}
              value={newMs.title}
              onChange={(e) => setNewMs((p) => ({ ...p, title: e.target.value }))}
              className="flex-1 px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateMilestone()}
            />
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={newMs.description}
            onChange={(e) => setNewMs((p) => ({ ...p, description: e.target.value }))}
            className="w-full px-2 py-1.5 bg-surface-800 border border-surface-600 rounded text-xs text-surface-200 placeholder-surface-600"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateMilestone}
              className="px-3 py-1.5 bg-claude text-white text-xs rounded-lg hover:bg-claude/80 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateMs(false)}
              className="px-3 py-1.5 text-surface-500 text-xs rounded-lg hover:text-surface-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {milestones.length === 0 && !showCreateMs && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Flag size={32} className="text-surface-600 mb-3" />
          <p className="text-sm text-surface-400 max-w-md">{t('roadmap.noMilestones')}</p>
          <p className="text-xs text-surface-600 mt-2 max-w-sm">
            Create a milestone to start your GSD workflow. Then add phases with goals and success criteria, and let AI
            plan the implementation.
          </p>
        </div>
      )}

      {/* Milestones */}
      {milestones.map((ms) => (
        <div key={ms.id} className="border border-surface-700/50 rounded-xl p-4 bg-surface-900/30">
          <MilestoneSection
            milestone={ms}
            phases={ms.phases || []}
            projectId={projectId}
            onRefresh={loadRoadmap}
            onPlanPhase={handlePlanPhase}
            onExecutePhase={handleExecutePhase}
            t={t}
          />
        </div>
      ))}

      {/* Phase Planning Modal */}
      {planningPhase && (
        <PhasePlanningModal
          key={`plan-${planningPhase.id}`}
          phase={planningPhase}
          projectId={projectId}
          onClose={() => setPlanningPhase(null)}
          onRefresh={loadRoadmap}
        />
      )}
    </div>
  );
}
