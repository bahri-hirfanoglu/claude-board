import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GitBranch, CalendarRange, Radio, X, Tag, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';
import { useTranslation } from '../../i18n/I18nProvider';
import { getTagColor } from '../../lib/constants';
import { parseTags } from './TagBadge';
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
  const [tagFilter, setTagFilter] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef(null);
  const refreshCounter = useRef(0);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const close = (e) => { if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) setTagDropdownOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [tagDropdownOpen]);

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

  // Tag filter
  const { activeTags, tagCounts } = useMemo(() => {
    const counts = {};
    tasks.forEach(t => parseTags(t.tags).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return { activeTags: Object.keys(counts).sort((a, b) => counts[b] - counts[a]), tagCounts: counts };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (tagFilter.length === 0) return tasks;
    return tasks.filter(t => {
      const tags = parseTags(t.tags);
      return tagFilter.some(f => tags.includes(f));
    });
  }, [tasks, tagFilter]);

  const filteredIds = useMemo(() => new Set(filteredTasks.map(t => t.id)), [filteredTasks]);

  const runningTasks = filteredTasks.filter(t => t.status === 'in_progress' || t.is_running);
  const waves = (graphData.waves || []).map(w => {
    return (w.taskIds || []).map(id => filteredTasks.find(t => t.id === id)).filter(Boolean);
  });

  // Filter graph edges to only show filtered tasks
  const filteredEdges = useMemo(() => {
    if (tagFilter.length === 0) return graphData.edges || [];
    return (graphData.edges || []).filter(e => filteredIds.has(e.from) && filteredIds.has(e.to));
  }, [graphData.edges, filteredIds, tagFilter]);

  const filteredGraphTasks = useMemo(() => {
    if (tagFilter.length === 0) return graphData.tasks || [];
    return (graphData.tasks || []).filter(t => filteredIds.has(t.id));
  }, [graphData.tasks, filteredIds, tagFilter]);

  const handleStop = useCallback((task) => {
    api.stopTask(task.id).catch(() => {});
  }, []);

  const handleAddDependency = useCallback((taskId, dependsOnId) => {
    if (!IS_TAURI) return;
    api.addDependency(taskId, dependsOnId).then(() => loadGraph()).catch(() => {});
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
      {/* Pipeline Stats + Tag Filter + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <PipelineStats tasks={filteredTasks} waves={waves} />
        </div>
        {/* Tag filter dropdown */}
        {activeTags.length > 0 && (
          <div className="relative" ref={tagDropdownRef}>
            <button onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tagFilter.length > 0 ? 'bg-claude/15 text-claude' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
              }`}>
              <Tag size={12} />
              {t('task.tags')}
              {tagFilter.length > 0 && (
                <span className="text-[10px] bg-claude/20 px-1.5 py-px rounded-full">{tagFilter.length}</span>
              )}
              <ChevronDown size={10} />
            </button>
            {tagDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl z-20 min-w-[280px] max-h-[320px] overflow-y-auto">
                {tagFilter.length > 0 && (
                  <button onClick={() => { setTagFilter([]); setTagDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-500 hover:bg-surface-700 border-b border-surface-700/50">
                    <X size={10} /> {t('common.clearAll')}
                  </button>
                )}
                {activeTags.map(tag => {
                  const isActive = tagFilter.includes(tag);
                  const color = getTagColor(tag);
                  return (
                    <button key={tag}
                      onClick={() => setTagFilter(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        isActive ? 'bg-surface-700/50 text-surface-200' : 'text-surface-400 hover:bg-surface-700/30'
                      }`}>
                      <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                        isActive ? 'bg-claude border-claude' : 'border-surface-600'
                      }`}>
                        {isActive && <span className="text-[8px] text-white font-bold">✓</span>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${color}`}>{tag}</span>
                      <span className="ml-auto text-[10px] text-surface-600">{tagCounts[tag]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
                  tasks={filteredGraphTasks}
                  edges={filteredEdges}
                  waves={waves}
                  onTaskClick={onViewDetail}
                  onAddDependency={handleAddDependency}
                  onStartTask={handleStartTask}
                  savedPositions={savedPositions}
                  onPositionsChange={handlePositionsChange}
                />
              ) : (
                <TimelineView
                  tasks={filteredTasks}
                  waves={waves}
                  edges={filteredEdges}
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
