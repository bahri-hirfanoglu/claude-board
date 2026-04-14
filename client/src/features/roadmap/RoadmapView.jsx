import { useState, useEffect, useCallback, useRef } from 'react';
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
  Package,
  Download,
  RefreshCw,
  Map,
  BookOpen,
  FolderOpen,
  Activity,
  XCircle,
  ListTodo,
} from 'lucide-react';
import { api, notifyError } from '../../lib/api';
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
    } catch (e) {
      console.error('Phase status change failed:', e);
    }
  };

  // /gsd:list-phase-assumptions equivalent — surface risky assumptions Claude
  // would be making about this phase before AI planning kicks off. Writes
  // .planning/phase-N/ASSUMPTIONS.md that the user can review/edit before /gsd:plan-phase.
  const [surfacing, setSurfacing] = useState(false);
  const handleSurfaceAssumptions = async () => {
    if (surfacing) return;
    setSurfacing(true);
    const criteriaList = criteria.map((c, i) => `${i + 1}. ${c.text || c.criterion || ''}`).join('\n');
    const description =
      `Surface the implicit assumptions Claude would make if asked to plan Phase ${phase.phase_number} — "${phase.title}" — and write them to .planning/phase-${phase.phase_number}/ASSUMPTIONS.md.\n\n` +
      `## Phase Goal\n${phase.goal || '(no goal specified)'}\n\n` +
      `## Success Criteria\n${criteriaList || '(none defined)'}\n\n` +
      `## Instructions\n` +
      `1. Read the phase goal and success criteria above\n` +
      `2. Inspect the project codebase briefly (entry points, relevant modules)\n` +
      `3. List the implicit assumptions that an AI planner would make, including:\n` +
      `   - Which files/components are in scope vs. out of scope\n` +
      `   - Which libraries/patterns should be used\n` +
      `   - Which edge cases or non-goals are deferred\n` +
      `   - Any ambiguous terms in the goal that have multiple interpretations\n` +
      `4. Write .planning/phase-${phase.phase_number}/ASSUMPTIONS.md with:\n` +
      `   - Numbered list of assumptions, each marked [RISKY] or [SAFE]\n` +
      `   - Open questions the user should answer before planning`;
    try {
      const task = await api.createTask(projectId, {
        title: `Surface assumptions — Phase ${phase.phase_number}`,
        description,
        taskType: 'docs',
        model: 'sonnet',
        acceptanceCriteria: `ASSUMPTIONS.md exists at .planning/phase-${phase.phase_number}/ with numbered assumptions and open questions`,
        tags: JSON.stringify([`phase:${phase.phase_number}`, 'gsd-assumptions']),
      });
      if (task?.id) {
        await api.restartTask(task.id);
      }
      onRefresh();
    } catch (e) {
      console.error('Surface assumptions failed:', e);
    }
    setSurfacing(false);
  };

  // /gsd:validate-phase equivalent — creates & starts a task that drives claude to
  // audit the phase's implementation against its success criteria and emit
  // .planning/phase-N/VALIDATION.md.
  const [validating, setValidating] = useState(false);
  const handleValidatePhase = async () => {
    if (validating) return;
    setValidating(true);
    const criteriaList = criteria
      .map((c, i) => `${i + 1}. [${c.verified ? 'VERIFIED' : 'UNVERIFIED'}] ${c.text || c.criterion || ''}`)
      .join('\n');
    const description =
      `Validate Phase ${phase.phase_number} — "${phase.title}" against its success criteria and produce .planning/phase-${phase.phase_number}/VALIDATION.md.\n\n` +
      `## Goal\n${phase.goal || '(no goal specified)'}\n\n` +
      `## Success Criteria\n${criteriaList || '(none defined)'}\n\n` +
      `## Instructions\n` +
      `1. Read the phase description, goal, and success criteria above\n` +
      `2. Inspect the actual code/artifacts in the project to confirm each criterion is met\n` +
      `3. Run any relevant tests/builds\n` +
      `4. Write .planning/phase-${phase.phase_number}/VALIDATION.md with:\n` +
      `   - Status per criterion (MET / PARTIAL / FAILED)\n` +
      `   - Evidence (file paths, test output) for each\n` +
      `   - Gaps or follow-up work needed\n` +
      `   - Overall verdict: ready / needs-work / failed`;
    try {
      const task = await api.createTask(projectId, {
        title: `Validate Phase ${phase.phase_number}: ${phase.title}`,
        description,
        taskType: 'test',
        model: 'sonnet',
        acceptanceCriteria: `VALIDATION.md exists at .planning/phase-${phase.phase_number}/ with a verdict on each success criterion`,
        tags: JSON.stringify([`phase:${phase.phase_number}`, 'gsd-validate']),
      });
      if (task?.id) {
        await api.restartTask(task.id);
      }
      onRefresh();
    } catch (e) {
      console.error('Validate phase failed:', e);
    }
    setValidating(false);
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
                handleSurfaceAssumptions();
              }}
              disabled={surfacing}
              className="p-1.5 rounded hover:bg-amber-500/20 text-surface-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              title="Surface assumptions before planning (ASSUMPTIONS.md)"
            >
              {surfacing ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            </button>
          )}
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
          {(phase.status === 'in_progress' || phase.status === 'verifying' || phase.status === 'completed') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleValidatePhase();
              }}
              disabled={validating}
              className="p-1.5 rounded hover:bg-purple-500/20 text-surface-500 hover:text-purple-400 transition-colors disabled:opacity-50"
              title="Validate Phase against success criteria"
            >
              {validating ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
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
    } catch (e) {
      console.error('Milestone status change failed:', e);
    }
  };

  // /gsd:audit-milestone equivalent — dispatches a Claude task that audits the
  // milestone for completeness against its original intent before archival.
  const [auditing, setAuditing] = useState(false);
  const handleAuditMilestone = async () => {
    if (auditing) return;
    setAuditing(true);
    const phaseList = phases.map((p) => `  - Phase ${p.phase_number}: ${p.title} [${p.status}]`).join('\n');
    const description =
      `Audit milestone ${milestone.version} — "${milestone.title}" against its original intent before archival.\n\n` +
      `## Description\n${milestone.description || '(none)'}\n\n` +
      `## Phases in this milestone\n${phaseList || '(none)'}\n\n` +
      `## Instructions\n` +
      `1. Read PROJECT.md and REQUIREMENTS.md under .planning/\n` +
      `2. Cross-reference the milestone's original scope with the phases above\n` +
      `3. Identify any unmet goals, deferred features, or scope drift\n` +
      `4. Write .planning/milestone-${milestone.version}/AUDIT.md with:\n` +
      `   - Requirements vs. delivered (table)\n` +
      `   - Gaps (should-be-fixed / acceptable-debt / out-of-scope)\n` +
      `   - Ready-to-archive verdict (YES / CONDITIONAL / NO + reasons)`;
    try {
      const task = await api.createTask(projectId, {
        title: `Audit Milestone ${milestone.version}: ${milestone.title}`,
        description,
        taskType: 'test',
        model: 'sonnet',
        acceptanceCriteria: `AUDIT.md exists at .planning/milestone-${milestone.version}/ with verdict`,
        tags: JSON.stringify([`milestone:${milestone.version}`, 'gsd-audit']),
      });
      if (task?.id) {
        await api.restartTask(task.id);
      }
      onRefresh();
    } catch (e) {
      console.error('Audit milestone failed:', e);
    }
    setAuditing(false);
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
              onClick={handleAuditMilestone}
              disabled={auditing}
              className="p-1 rounded hover:bg-purple-500/20 text-surface-600 hover:text-purple-400 transition-colors disabled:opacity-50"
              title="Audit milestone completeness"
            >
              {auditing ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            </button>
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
  const [errorMsg, setErrorMsg] = useState(null);

  const startPlanning = async () => {
    setStatus('planning');
    setLogs([]);
    setProposals([]);
    setErrorMsg(null);
    try {
      const result = await api.planPhase(projectId, phase.id, model, 'medium');
      if (result?.planId) setActivePlanId(result.planId);
    } catch (e) {
      const msg = typeof e === 'string' ? e : e?.message || 'Failed to start planning';
      setErrorMsg(msg);
      setStatus('idle');
    }
  };

  const cancelPlanning = async () => {
    try {
      await api.cancelPlanning(projectId);
    } catch (e) {
      console.error('Cancel planning failed:', e);
    }
    setStatus('idle');
    setActivePlanId(null);
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
          const hint = p.error
            ? `Planning failed: ${p.error}`
            : 'Planning finished but no tasks were parsed. Try again with more detail in the phase goal.';
          setErrorMsg(hint);
          setLogs((prev) => [...prev, { type: 'error', content: hint }]);
          setStatus('idle');
        }
      }),
      tauriListen('plan:cancelled', (p) => {
        if (p.projectId !== projectId) return;
        setStatus('idle');
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [projectId]);

  const handleApprove = async () => {
    setStatus('approving');
    setErrorMsg(null);
    try {
      await api.approvePhasePlan(projectId, phase.id, planTitle, proposals, model, deps);
      onRefresh();
      onClose();
    } catch (e) {
      const msg = typeof e === 'string' ? e : e?.message || 'Failed to approve plan';
      setErrorMsg(msg);
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
          {errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-[11px] text-red-300">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-300">
                <X size={12} />
              </button>
            </div>
          )}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-blue-400">
                  <Loader2 size={14} className="animate-spin" />
                  Planning in progress...
                </div>
                <button
                  onClick={cancelPlanning}
                  className="text-[11px] px-2 py-1 bg-surface-800 border border-surface-700 text-surface-400 hover:text-red-400 hover:border-red-500/40 rounded"
                >
                  Cancel
                </button>
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

// Normalize phase number: "01" → "1", "001" → "1", "0" → "0"
const normalizePhaseNum = (n) => {
  const s = String(n).replace(/^0+/, '');
  return s || '0';
};

const GSD_PHASE_STATUS_COLORS = {
  pending: 'bg-surface-700 text-surface-400',
  planning: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  verifying: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  skipped: 'bg-surface-600 text-surface-500',
};

function GsdInstallPrompt({ projectId, onInstalled }) {
  const [installing, setInstalling] = useState(false);
  const [scope, setScope] = useState('global');
  const [error, setError] = useState(null);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await api.gsdInstall(projectId, scope);
      onInstalled();
    } catch (e) {
      setError(typeof e === 'string' ? e : e?.message || 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="border border-surface-700 rounded-xl p-5 bg-gradient-to-br from-surface-800/80 to-surface-900 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-claude/10 flex items-center justify-center flex-shrink-0">
          <Package size={20} className="text-claude" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-surface-100">GSD (Get Shit Done)</h3>
          <p className="text-xs text-surface-500 mt-1">
            GSD is a spec-driven development framework that manages planning phases, roadmaps, and execution through
            structured <code className="text-surface-400 bg-surface-800 px-1 rounded">.planning/</code> files.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex bg-surface-800 rounded-lg p-0.5">
          <button
            onClick={() => setScope('global')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scope === 'global' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
          >
            Global (~/.claude)
          </button>
          <button
            onClick={() => setScope('local')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scope === 'local' ? 'bg-surface-700 text-surface-200' : 'text-surface-500 hover:text-surface-300'}`}
          >
            Local (.claude/)
          </button>
        </div>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center gap-1.5 px-4 py-2 bg-claude hover:bg-claude/80 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {installing ? 'Installing...' : 'Install GSD'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}

const GSD_ACTIONS = {
  pending: {
    label: 'Plan Phase',
    icon: Brain,
    command: 'plan-phase',
    color: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
    prompt: (n, title) =>
      `Run /gsd:plan-phase ${n} for phase "${title}". Research how to implement this phase, create detailed execution plans with task breakdown, dependencies, and verification criteria. Write the plans to .planning/phases/.`,
  },
  planning: {
    label: 'Execute Phase',
    icon: Play,
    command: 'execute-phase',
    color: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
    prompt: (n, title) =>
      `Run /gsd:execute-phase ${n} for phase "${title}". Read the plans from .planning/phases/ and execute them in wave order. Make atomic commits for each completed task. Update STATE.md with progress.`,
  },
  in_progress: {
    label: 'Continue',
    icon: Play,
    command: 'execute-phase',
    color: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
    prompt: (n, title) =>
      `Continue executing /gsd:execute-phase ${n} for phase "${title}". Check STATE.md and .planning/phases/ for remaining tasks and pick up where we left off.`,
  },
  completed: {
    label: 'Verify',
    icon: Eye,
    command: 'verify-work',
    color: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
    prompt: (n, title) =>
      `Run /gsd:verify-work ${n} for phase "${title}". Verify the implementation against the success criteria and acceptance tests defined in the phase plans. Write verification results to .planning/phases/.`,
  },
  failed: {
    label: 'Retry',
    icon: RefreshCw,
    command: 'execute-phase',
    color: 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
    prompt: (n, title) =>
      `Run /gsd:execute-phase ${n} for phase "${title}". The previous execution failed. Check .planning/phases/ for error context and retry the failed tasks.`,
  },
};

function GsdFileRoadmap({ projectId }) {
  const [gsdRoadmap, setGsdRoadmap] = useState(null);
  const [gsdState, setGsdState] = useState(null);
  const [phaseDetails, setPhaseDetails] = useState([]);
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyPhase, setBusyPhase] = useState(null);
  const [planningPhase, setPlanningPhase] = useState(null);
  const [planLogs, setPlanLogs] = useState([]);
  const [phaseMsg, setPhaseMsg] = useState(null);
  const [generatedPhases, setGeneratedPhases] = useState(new Set()); // phases that already have board tasks

  const load = useCallback(async () => {
    try {
      const [roadmap, state, details, tasks] = await Promise.all([
        api.gsdGetRoadmap(projectId),
        api.gsdGetState(projectId),
        api.gsdGetPhaseDetails(projectId),
        api.getTasks(projectId).catch(() => []),
      ]);
      setGsdRoadmap(roadmap);
      setGsdState(state);
      setPhaseDetails(details);
      // Check which phases already have generated board tasks (tag: "phase-N")
      const generated = new Set();
      for (const t of tasks) {
        const tags = t.tags || '';
        const match = tags.match(/phase-(\d+)/);
        if (match && tags.includes('gsd')) generated.add(normalizePhaseNum(match[1]));
      }
      setGeneratedPhases(generated);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for planning events
  useEffect(() => {
    const unsubs = [
      tauriListen('plan:log', (p) => {
        if (p?.projectId !== projectId || !planningPhase) return;
        setPlanLogs((prev) => [...prev.slice(-100), { type: p.type, message: p.message }]);
      }),
      tauriListen('plan:phase', (p) => {
        if (p?.projectId !== projectId || !planningPhase) return;
        setPlanLogs((prev) => [...prev, { type: 'phase', message: `Phase: ${p.phase}` }]);
      }),
      tauriListen('plan:completed', async (p) => {
        if (p?.projectId !== projectId || !planningPhase) return;
        const finishedPhase = planningPhase;
        setPlanningPhase(null);
        if (p.error) {
          await load();
          setPhaseMsg({ type: 'error', text: `Planning failed: ${p.error}` });
          return;
        }
        // Pick up PLAN.md files the agent just wrote, then auto-generate tasks.
        let details = [];
        try {
          details = await api.gsdGetPhaseDetails(projectId);
        } catch {}
        const phaseNum = normalizePhaseNum(finishedPhase.number);
        const hasPlan = details.some((d) => {
          const dNum = normalizePhaseNum(d.number);
          return dNum === phaseNum && d.files?.some((f) => f.name.toLowerCase().includes('plan'));
        });
        await load();
        if (!hasPlan) {
          setPhaseMsg({
            type: 'error',
            text: `Planning finished but no PLAN.md files were written to .planning/phases/. Try again with a clearer phase goal.`,
          });
          return;
        }
        try {
          const created = await api.gsdCreateTasksFromPlans(projectId, finishedPhase.number, finishedPhase.title, true);
          if (created?.length > 0) {
            setGeneratedPhases((prev) => new Set([...prev, phaseNum]));
            setPhaseMsg({
              type: 'success',
              text: `Phase ${finishedPhase.number}: ${created.length} tasks created and queued for execution.`,
            });
          } else {
            setPhaseMsg({
              type: 'error',
              text: `No tasks could be extracted from PLAN files for Phase ${finishedPhase.number}.`,
            });
          }
        } catch (e) {
          setPhaseMsg({
            type: 'error',
            text: typeof e === 'string' ? e : e?.message || 'Failed to generate tasks',
          });
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [projectId, planningPhase, load]);

  // Plan Phase: run via start_planning (inline, no worktree)
  const handlePlanPhase = async (phase) => {
    if (busyPhase || planningPhase) return;
    setBusyPhase(phase.number);
    setPlanningPhase(phase);
    setPlanLogs([]);
    setPhaseMsg(null);
    try {
      const topic = `GSD plan-phase ${phase.number}: ${phase.title}`;
      const context = [
        `## GSD Phase Planning`,
        `Phase ${phase.number}: ${phase.title}`,
        phase.description ? `Description: ${phase.description}` : '',
        ``,
        `## Instructions`,
        `Research how to implement this phase and create detailed execution plans.`,
        `Write PLAN.md files to .planning/phases/ directory following GSD format:`,
        `- YAML front matter with: phase, plan, wave, depends_on, files_modified, autonomous`,
        `- <tasks> section with <task type="auto"> elements containing: <name>, <files>, <action>, <verify>, <done>`,
        `- Create 2-4 plans per phase, grouped by wave for parallel execution`,
        `- Each task should be an atomic unit of work (15-60 min)`,
      ]
        .filter(Boolean)
        .join('\n');
      await api.startPlanning(projectId, { topic, context, model: 'sonnet' });
    } catch (e) {
      setPhaseMsg({ type: 'error', text: typeof e === 'string' ? e : e?.message || 'Failed to start planning' });
      setPlanningPhase(null);
    }
    setBusyPhase(null);
  };

  // Other actions: verify, retry — creates a single task
  const handleOtherAction = async (phase, action) => {
    if (busyPhase) return;
    setBusyPhase(phase.number);
    setPhaseMsg(null);
    try {
      const task = await api.createTask(projectId, {
        title: `GSD ${action.command}: Phase ${phase.number} - ${phase.title}`,
        description: action.prompt(phase.number, phase.title),
        taskType: 'chore',
        model: 'sonnet',
        tags: `gsd,gsd-${action.command},phase-${phase.number}`,
      });
      if (task?.id) {
        await api.restartTask(task.id);
        setPhaseMsg({
          type: 'success',
          text: `${action.label} started for Phase ${phase.number}. Task: ${task.task_key || task.title}`,
        });
      }
    } catch (e) {
      setPhaseMsg({ type: 'error', text: typeof e === 'string' ? e : e?.message || 'Failed' });
    }
    setBusyPhase(null);
  };

  // Generate Tasks: parse PLAN files → create board tasks → queue
  const handleGenerateTasks = async (phase) => {
    if (busyPhase) return;
    setBusyPhase(phase.number);
    setPhaseMsg(null);
    try {
      const created = await api.gsdCreateTasksFromPlans(projectId, phase.number, phase.title, true);
      if (created?.length > 0) {
        setGeneratedPhases((prev) => new Set([...prev, normalizePhaseNum(phase.number)]));
        setPhaseMsg({
          type: 'success',
          text: `Phase ${phase.number}: ${created.length} tasks created and queued for execution.`,
        });
      } else {
        setPhaseMsg({ type: 'error', text: `No tasks could be extracted from PLAN files for Phase ${phase.number}.` });
      }
    } catch (e) {
      setPhaseMsg({ type: 'error', text: typeof e === 'string' ? e : e?.message || 'Failed' });
    }
    setBusyPhase(null);
  };

  if (loading) return null;
  if (!gsdRoadmap) return null;

  const phases = gsdRoadmap.phases || [];
  const completed = phases.filter((p) => p.status === 'completed').length;

  return (
    <div className="border border-surface-700/50 rounded-xl bg-surface-900/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-700/30 flex items-center gap-2">
        <Map size={14} className="text-claude" />
        <h3 className="text-sm font-semibold text-surface-200">.planning/ Roadmap</h3>
        <span className="text-[10px] text-surface-500">
          {completed}/{phases.length} phases
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {gsdState?.current_phase && (
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
              {gsdState.current_phase}
            </span>
          )}
          {gsdState?.current_step && <span className="text-[10px] text-surface-500">{gsdState.current_step}</span>}
          <button onClick={load} className="p-1 text-surface-500 hover:text-surface-300 transition-colors">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className={`p-1 transition-colors ${showRaw ? 'text-claude' : 'text-surface-500 hover:text-surface-300'}`}
            title="Show raw ROADMAP.md"
          >
            <FileText size={12} />
          </button>
        </div>
      </div>

      {/* Phase action feedback */}
      {phaseMsg && (
        <div
          className={`mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            phaseMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {phaseMsg.type === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          <span className="flex-1">{phaseMsg.text}</span>
          <button onClick={() => setPhaseMsg(null)} className="opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Planning in progress */}
      {planningPhase && (
        <div className="mx-3 mt-3 border border-blue-500/20 rounded-lg bg-blue-500/5 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-500/10">
            <Loader2 size={12} className="animate-spin text-blue-400" />
            <span className="text-xs font-medium text-blue-400">
              Planning Phase {planningPhase.number}: {planningPhase.title}
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto p-2 space-y-0.5">
            {planLogs.map((log, i) => (
              <div
                key={i}
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  log.type === 'error'
                    ? 'text-red-400'
                    : log.type === 'tool'
                      ? 'text-surface-400'
                      : log.type === 'phase'
                        ? 'text-blue-400 font-medium'
                        : 'text-surface-500'
                }`}
              >
                {log.message}
              </div>
            ))}
            {planLogs.length === 0 && (
              <div className="text-[10px] text-surface-600 px-2">Starting planning agent...</div>
            )}
          </div>
        </div>
      )}

      {showRaw ? (
        <pre className="p-4 text-xs text-surface-400 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
          {gsdRoadmap.raw}
        </pre>
      ) : (
        <div className="p-3 space-y-1">
          {/* Progress bar */}
          {phases.length > 0 && (
            <div className="mb-3">
              <ProgressBar
                total={phases.length}
                done={completed}
                inProgress={phases.filter((p) => p.status === 'in_progress').length}
                failed={phases.filter((p) => p.status === 'failed').length}
              />
            </div>
          )}

          {phases.map((phase, i) => {
            const phaseNum = normalizePhaseNum(phase.number);
            const detail = phaseDetails.find((d) => {
              const dNum = normalizePhaseNum(d.number);
              return dNum === phaseNum;
            });
            const isExpanded = expandedPhase === phase.number;
            const hasPlan = detail?.files.some((f) => f.name.toLowerCase().includes('plan'));
            const hasGeneratedTasks = generatedPhases.has(phaseNum);
            const isBusy = busyPhase === phase.number;

            return (
              <div
                key={phase.number}
                className="rounded-lg border border-surface-700/30 bg-surface-800/30 overflow-hidden"
              >
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedPhase(isExpanded ? null : phase.number)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-800/60 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-surface-500" />
                    ) : (
                      <ChevronRight size={12} className="text-surface-500" />
                    )}
                    <span className="text-[10px] font-mono text-surface-500 w-6">{phase.number}</span>
                    <span className="text-xs text-surface-200 flex-1">{phase.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${GSD_PHASE_STATUS_COLORS[phase.status] || GSD_PHASE_STATUS_COLORS.pending}`}
                    >
                      {phase.status}
                    </span>
                    {detail && (
                      <span className="text-[10px] text-surface-600">
                        <FolderOpen size={10} className="inline -mt-0.5" /> {detail.files.length}
                      </span>
                    )}
                  </button>

                  {/* Phase action buttons — state machine */}
                  <div className="flex items-center gap-1 mr-2">
                    {/* No PLAN files yet → Plan Phase */}
                    {!hasPlan && (phase.status === 'pending' || phase.status === 'planning') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlanPhase(phase);
                        }}
                        disabled={!!busyPhase || !!planningPhase}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                      >
                        {isBusy || planningPhase?.number === phase.number ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Brain size={10} />
                        )}
                        {planningPhase?.number === phase.number ? 'Planning...' : 'Plan Phase'}
                      </button>
                    )}

                    {/* Has PLAN files but no board tasks yet → Generate Tasks */}
                    {hasPlan && !hasGeneratedTasks && (phase.status === 'pending' || phase.status === 'planning') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateTasks(phase);
                        }}
                        disabled={!!busyPhase}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40 bg-claude/15 text-claude hover:bg-claude/25"
                      >
                        {isBusy ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                        Generate Tasks
                      </button>
                    )}

                    {/* Completed → Verify */}
                    {phase.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOtherAction(phase, GSD_ACTIONS.completed);
                        }}
                        disabled={!!busyPhase}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      >
                        <Eye size={10} />
                        Verify
                      </button>
                    )}

                    {/* Failed → Retry */}
                    {phase.status === 'failed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateTasks(phase);
                        }}
                        disabled={!!busyPhase}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40 bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-surface-700/20">
                    {phase.description && <p className="text-xs text-surface-500 mt-2 pl-7">{phase.description}</p>}

                    {/* Phase files */}
                    {detail &&
                      detail.files.map((file) => {
                        const fileKey = `${phase.number}-${file.name}`;
                        const isFileExpanded = expandedFile === fileKey;
                        const fileType = file.name.includes('PLAN')
                          ? 'plan'
                          : file.name.includes('CONTEXT')
                            ? 'context'
                            : file.name.includes('RESEARCH')
                              ? 'research'
                              : file.name.includes('VERIFICATION')
                                ? 'verify'
                                : file.name.includes('SUMMARY')
                                  ? 'summary'
                                  : 'other';
                        const typeColors = {
                          plan: 'text-blue-400',
                          context: 'text-purple-400',
                          research: 'text-amber-400',
                          verify: 'text-emerald-400',
                          summary: 'text-surface-400',
                          other: 'text-surface-500',
                        };

                        return (
                          <div key={file.name} className="ml-7">
                            <button
                              onClick={() => setExpandedFile(isFileExpanded ? null : fileKey)}
                              className="flex items-center gap-2 w-full text-left py-1 hover:bg-surface-800/40 rounded px-2 -mx-2"
                            >
                              <BookOpen size={10} className={typeColors[fileType]} />
                              <span className="text-[11px] font-mono text-surface-400">{file.name}</span>
                              <span className="text-[10px] text-surface-600 ml-auto">
                                {Math.round(file.content.length / 100) / 10}k
                              </span>
                            </button>
                            {isFileExpanded && (
                              <pre className="mt-1 p-3 bg-surface-900 rounded-lg text-[11px] text-surface-400 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto border border-surface-700/30">
                                {file.content}
                              </pre>
                            )}
                          </div>
                        );
                      })}

                    {!detail && (
                      <p className="text-[10px] text-surface-600 mt-2 pl-7 italic">
                        No phase files yet — click &quot;Plan Phase&quot; to start.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RoadmapView({ projectId, project }) {
  const { t } = useTranslation();
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateMs, setShowCreateMs] = useState(false);
  const [newMs, setNewMs] = useState({ version: '', title: '', description: '' });
  const [planningPhase, setPlanningPhase] = useState(null);
  const [gsdStatus, setGsdStatus] = useState(null);
  const [gsdLoading, setGsdLoading] = useState(true);

  const loadGsdStatus = useCallback(async () => {
    try {
      const status = await api.gsdCheckStatus(projectId);
      setGsdStatus(status);
    } catch (e) {
      console.error('Failed to load GSD status:', e);
    }
    setGsdLoading(false);
  }, [projectId]);

  const loadRoadmap = useCallback(async () => {
    try {
      const data = await api.getRoadmap(projectId);
      setRoadmap(data);
    } catch (e) {
      console.error('Failed to load roadmap:', e);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadRoadmap();
    loadGsdStatus();
  }, [loadRoadmap, loadGsdStatus]);

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
    } catch (e) {
      console.error('Create milestone failed:', e);
    }
  };

  const handlePlanPhase = (phase) => {
    setPlanningPhase(phase);
  };

  const [executingPhases, setExecutingPhases] = useState(() => new Set());
  const handleExecutePhase = async (phase) => {
    if (executingPhases.has(phase.id)) return;
    if (phase.status === 'in_progress') {
      notifyError(`Phase ${phase.phase_number} is already in progress`);
      return;
    }
    setExecutingPhases((prev) => {
      const next = new Set(prev);
      next.add(phase.id);
      return next;
    });
    try {
      await api.executePhase(projectId, phase.id);
      loadRoadmap();
    } catch (e) {
      console.error('Execute phase failed:', e);
    } finally {
      setExecutingPhases((prev) => {
        const next = new Set(prev);
        next.delete(phase.id);
        return next;
      });
    }
  };

  const [gsdIniting, setGsdIniting] = useState(false);
  const [gsdInitMsg, setGsdInitMsg] = useState(null);
  const [showGsdForm, setShowGsdForm] = useState(false);
  const [gsdForm, setGsdForm] = useState({ description: '', goals: '', scope: '' });
  const [healthReport, setHealthReport] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [todos, setTodos] = useState([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [showTodos, setShowTodos] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      const report = await api.gsdHealthCheck(projectId);
      setHealthReport(report);
      setShowHealth(true);
    } catch (e) {
      console.error('Health check failed:', e);
    }
    setHealthLoading(false);
  }, [projectId]);

  const loadTodos = useCallback(async () => {
    setTodosLoading(true);
    try {
      const list = await api.gsdListTodos(projectId);
      setTodos(list || []);
      setShowTodos(true);
    } catch (e) {
      console.error('Load todos failed:', e);
    }
    setTodosLoading(false);
  }, [projectId]);
  const handleGsdInit = async () => {
    if (gsdIniting) return;
    if (!gsdForm.description.trim()) return;
    setGsdIniting(true);
    setGsdInitMsg(null);
    const context = [
      `## Project Context`,
      gsdForm.description.trim(),
      gsdForm.goals.trim() ? `\n## Goals\n${gsdForm.goals.trim()}` : '',
      gsdForm.scope.trim() ? `\n## Scope / Constraints\n${gsdForm.scope.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      const task = await api.createTask(projectId, {
        title: 'Initialize GSD Project',
        description:
          `Create the .planning/ directory for this project with PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, and config.json.\n\n` +
          `${context}\n\n` +
          `## Instructions\n` +
          `1. Analyze the codebase to understand the tech stack and architecture\n` +
          `2. Use the project context above to shape the roadmap\n` +
          `3. Create PROJECT.md with project vision and constraints\n` +
          `4. Create REQUIREMENTS.md with v1 scope (based on goals above)\n` +
          `5. Create ROADMAP.md with **5-8 phases maximum** — each phase should be a meaningful chunk of work, not a single task. Fewer focused phases are better than many granular ones.\n` +
          `6. Create STATE.md tracking current position\n` +
          `7. Create config.json with default GSD settings\n` +
          `8. Each phase in ROADMAP.md must have: ## Phase N: Title, a description, and Status: pending`,
        taskType: 'chore',
        model: 'sonnet',
        tags: 'gsd-init',
      });
      if (task?.id) {
        await api.restartTask(task.id);
        setGsdInitMsg({
          type: 'success',
          text: `Task "${task.task_key || task.title}" created and started. Check the board to track progress.`,
        });
        setShowGsdForm(false);
      }
      loadGsdStatus();
    } catch (e) {
      setGsdInitMsg({ type: 'error', text: typeof e === 'string' ? e : e?.message || 'Failed to create task' });
    }
    setGsdIniting(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={loadTodos}
            disabled={todosLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 border border-surface-700 text-surface-300 hover:text-surface-100 hover:border-surface-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            title="Show captured todos from .planning/todos/"
          >
            {todosLoading ? <Loader2 size={14} className="animate-spin" /> : <ListTodo size={14} />}
            Todos
          </button>
          <button
            onClick={runHealthCheck}
            disabled={healthLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 border border-surface-700 text-surface-300 hover:text-surface-100 hover:border-surface-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            title="Check .planning/ directory integrity"
          >
            {healthLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Health
          </button>
          <button
            onClick={() => setShowCreateMs(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-claude/15 text-claude text-xs font-medium rounded-lg hover:bg-claude/25 transition-colors"
          >
            <Plus size={14} /> {t('roadmap.createMilestone')}
          </button>
        </div>
      </div>

      {/* Todos panel */}
      {showTodos && (
        <div className="border border-surface-700 rounded-xl p-4 space-y-2 bg-surface-850">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo size={14} className="text-amber-400" />
              <h3 className="text-sm font-medium text-surface-100">
                Todos{' '}
                <span className="text-[10px] text-surface-500 font-normal">
                  ({todos.filter((t) => t.status === 'pending').length} pending ·{' '}
                  {todos.filter((t) => t.status === 'done').length} done)
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadTodos}
                disabled={todosLoading}
                className="p-1 text-surface-500 hover:text-surface-300 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw size={12} className={todosLoading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowTodos(false)} className="p-1 text-surface-500 hover:text-surface-300">
                <X size={14} />
              </button>
            </div>
          </div>
          {todos.length === 0 ? (
            <div className="text-[11px] text-surface-500 py-4 text-center">
              No todos captured yet. Use <code className="text-surface-300">/gsd:add-todo</code> in a Claude session to
              capture ideas.
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-auto">
              {todos.map((todo) => (
                <div
                  key={todo.path}
                  className={`flex items-start gap-2 p-2 rounded border border-surface-700/50 ${todo.status === 'done' ? 'bg-surface-900/50 opacity-60' : 'bg-surface-900/80'}`}
                >
                  {todo.status === 'done' ? (
                    <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={11} className="text-surface-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-medium ${todo.status === 'done' ? 'text-surface-400 line-through' : 'text-surface-200'}`}
                      >
                        {todo.title}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500 flex-shrink-0">
                        {todo.area}
                      </span>
                    </div>
                    {todo.preview && <p className="text-[10px] text-surface-500 mt-0.5 line-clamp-2">{todo.preview}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health report panel */}
      {showHealth && healthReport && (
        <div className="border border-surface-700 rounded-xl p-4 space-y-2 bg-surface-850">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity
                size={14}
                className={
                  healthReport.overall === 'healthy'
                    ? 'text-emerald-400'
                    : healthReport.overall === 'degraded'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              />
              <h3 className="text-sm font-medium text-surface-100">
                Planning Directory Health:{' '}
                <span
                  className={
                    healthReport.overall === 'healthy'
                      ? 'text-emerald-400'
                      : healthReport.overall === 'degraded'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                >
                  {healthReport.overall}
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={runHealthCheck}
                disabled={healthLoading}
                className="p-1 text-surface-500 hover:text-surface-300 disabled:opacity-50"
                title="Re-run checks"
              >
                <RefreshCw size={12} className={healthLoading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowHealth(false)} className="p-1 text-surface-500 hover:text-surface-300">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {healthReport.checks.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                {c.status === 'ok' ? (
                  <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : c.status === 'warning' ? (
                  <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="text-surface-200">{c.name}</span>
                  {c.message && <span className="text-surface-500"> — {c.message}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* GSD Package Integration */}
      {!gsdLoading && gsdStatus && !gsdStatus.installed && (
        <GsdInstallPrompt projectId={projectId} onInstalled={loadGsdStatus} />
      )}

      {/* GSD File-Based Roadmap */}
      {gsdStatus?.has_planning && gsdStatus?.has_roadmap && <GsdFileRoadmap projectId={projectId} />}

      {/* GSD Init */}
      {gsdStatus?.installed && !gsdStatus?.has_planning && (
        <div className="space-y-2">
          {!showGsdForm && !gsdInitMsg?.type && (
            <div className="flex items-center gap-3 px-4 py-3 bg-surface-800/40 border border-surface-700/30 rounded-xl">
              <Package size={14} className="text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-surface-400 flex-1">
                GSD installed. <code className="text-surface-300 bg-surface-800 px-1 rounded">.planning/</code>{' '}
                directory needs to be initialized.
              </span>
              <button
                onClick={() => setShowGsdForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-claude/15 text-claude text-xs font-medium rounded-lg hover:bg-claude/25 transition-colors flex-shrink-0"
              >
                <Play size={12} />
                Initialize Project
              </button>
            </div>
          )}

          {showGsdForm && !gsdInitMsg?.type && (
            <div className="border border-surface-700 rounded-xl p-4 space-y-3 bg-surface-850">
              <h3 className="text-sm font-medium text-surface-200">Initialize GSD Project</h3>
              <p className="text-[11px] text-surface-500">
                Describe your project so GSD can create a focused roadmap with the right phases.
              </p>
              <div className="space-y-2">
                <textarea
                  placeholder="What is this project? What does it do? (required)"
                  value={gsdForm.description}
                  onChange={(e) => setGsdForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs text-surface-200 placeholder-surface-600 resize-none"
                  rows={3}
                  autoFocus
                />
                <textarea
                  placeholder="What are your goals for v1? What features matter most?"
                  value={gsdForm.goals}
                  onChange={(e) => setGsdForm((f) => ({ ...f, goals: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs text-surface-200 placeholder-surface-600 resize-none"
                  rows={2}
                />
                <textarea
                  placeholder="Any constraints or scope limits? (optional)"
                  value={gsdForm.scope}
                  onChange={(e) => setGsdForm((f) => ({ ...f, scope: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs text-surface-200 placeholder-surface-600 resize-none"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGsdInit}
                  disabled={gsdIniting || !gsdForm.description.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-claude hover:bg-claude/80 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {gsdIniting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {gsdIniting ? 'Creating...' : 'Create & Start'}
                </button>
                <button
                  onClick={() => setShowGsdForm(false)}
                  className="px-3 py-2 text-surface-500 text-xs rounded-lg hover:text-surface-300 transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] text-surface-600 ml-auto">5-8 phases will be generated</span>
              </div>
            </div>
          )}

          {gsdInitMsg && (
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs ${
                gsdInitMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {gsdInitMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              <span>{gsdInitMsg.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {milestones.length === 0 && !showCreateMs && !gsdStatus?.has_roadmap && (
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
