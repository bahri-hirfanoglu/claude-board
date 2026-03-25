import { useState, useEffect, useCallback, useRef } from 'react';
import { GitBranch, CalendarRange, Radio } from 'lucide-react';
import { api } from '../../lib/api';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';
import { useTranslation } from '../../i18n/I18nProvider';
import PipelineStats from './PipelineStats';
import AgentCard from './AgentCard';
import DependencyGraph from './DependencyGraph';
import TimelineView from './TimelineView';
import ObservabilityPanel from './ObservabilityPanel';

const STORAGE_KEY = 'claude-board:dag-positions:';

function loadPositions(projectId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + projectId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePositions(projectId, positions) {
  try {
    localStorage.setItem(STORAGE_KEY + projectId, JSON.stringify(positions));
  } catch {}
}

export default function OrchestrationView({ tasks, projectId, onViewLogs, onStatusChange, onViewDetail }) {
  const { t } = useTranslation();
  const [graphData, setGraphData] = useState({ tasks: [], edges: [], waves: [] });
  const [savedPositions, setSavedPositions] = useState(() => loadPositions(projectId));
  const [viewType, setViewType] = useState('graph'); // 'graph' | 'timeline' | 'live'
  const refreshCounter = useRef(0);

  const loadGraph = useCallback(() => {
    if (!IS_TAURI || !projectId) return;
    api.getDependencyGraph(projectId)
      .then(data => setGraphData(data))
      .catch(() => {});
  }, [projectId]);

  // Reload on task changes
  useEffect(() => {
    loadGraph();
  }, [loadGraph, tasks]);

  // Reload saved positions when project changes
  useEffect(() => {
    setSavedPositions(loadPositions(projectId));
  }, [projectId]);

  // Also reload on task:updated events (covers dependency changes)
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:updated', () => {
      refreshCounter.current++;
      loadGraph();
    });
  }, [loadGraph]);

  const runningTasks = tasks.filter(t => t.status === 'in_progress' || t.is_running);
  const waves = (graphData.waves || []).map(w => {
    return (w.taskIds || []).map(id => tasks.find(t => t.id === id)).filter(Boolean);
  });

  const handleStop = useCallback((task) => {
    api.stopTask(task.id).catch(() => {});
  }, []);

  const handleAddDependency = useCallback((taskId, dependsOnId) => {
    if (!IS_TAURI) return;
    api.addDependency(taskId, dependsOnId).then(() => loadGraph());
  }, [loadGraph]);

  const handlePositionsChange = useCallback((positions) => {
    setSavedPositions(positions);
    savePositions(projectId, positions);
  }, [projectId]);

  const handleStartTask = useCallback((task) => {
    if (!onStatusChange) return;
    onStatusChange(task.id, 'in_progress');
  }, [onStatusChange]);

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-auto">
      {/* Pipeline Stats + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <PipelineStats tasks={tasks} waves={waves} />
        </div>
        <div className="flex items-center bg-surface-800/50 rounded-lg border border-surface-700/30 p-0.5">
          <button
            onClick={() => setViewType('graph')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewType === 'graph' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            <GitBranch size={12} />
            {t('orchestration.graph')}
          </button>
          <button
            onClick={() => setViewType('timeline')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewType === 'timeline' ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            <CalendarRange size={12} />
            {t('orchestration.timeline')}
          </button>
          <button
            onClick={() => setViewType('live')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewType === 'live' ? 'bg-emerald-500/15 text-emerald-400' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            <Radio size={12} />
            {t('orchestration.live')}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        {viewType === 'live' ? (
          /* Live Observability Panel — full width */
          <div className="flex-1 min-w-0">
            <ObservabilityPanel projectId={projectId} />
          </div>
        ) : (
          <>
            {/* DAG Graph or Timeline */}
            <div className="flex-1 min-w-0">
              {viewType === 'graph' ? (
                <DependencyGraph
                  tasks={graphData.tasks || []}
                  edges={graphData.edges || []}
                  waves={waves}
                  onTaskClick={onViewDetail}
                  onAddDependency={handleAddDependency}
                  onStartTask={handleStartTask}
                  savedPositions={savedPositions}
                  onPositionsChange={handlePositionsChange}
                />
              ) : (
                <TimelineView
                  tasks={tasks}
                  waves={waves}
                  edges={graphData.edges || []}
                  onTaskClick={onViewDetail}
                />
              )}
            </div>

            {/* Live Agent Cards */}
            {runningTasks.length > 0 && (
              <div className="w-72 flex-shrink-0 space-y-2 overflow-y-auto">
                <div className="text-[11px] font-medium text-surface-400 uppercase tracking-wider px-1">
                  {t('orchestration.liveAgents')} ({runningTasks.length})
                </div>
                {runningTasks.map(task => (
                  <AgentCard
                    key={task.id}
                    task={task}
                    onStop={handleStop}
                    onViewLogs={onViewLogs}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
