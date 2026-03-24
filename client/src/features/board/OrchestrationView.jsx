import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';
import PipelineStats from './PipelineStats';
import AgentCard from './AgentCard';
import DependencyGraph from './DependencyGraph';

export default function OrchestrationView({ tasks, projectId, onViewLogs, onStatusChange, onViewDetail }) {
  const [graphData, setGraphData] = useState({ tasks: [], edges: [], waves: [] });
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

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-auto">
      {/* Pipeline Stats */}
      <PipelineStats tasks={tasks} waves={waves} />

      <div className="flex-1 flex gap-3 min-h-0">
        {/* DAG Graph */}
        <div className="flex-1 min-w-0">
          <DependencyGraph
            tasks={graphData.tasks || []}
            edges={graphData.edges || []}
            waves={waves}
            onTaskClick={onViewDetail}
          />
        </div>

        {/* Live Agent Cards */}
        {runningTasks.length > 0 && (
          <div className="w-64 flex-shrink-0 space-y-2 overflow-y-auto">
            <div className="text-[11px] font-medium text-surface-400 uppercase tracking-wider px-1">
              Live Agents ({runningTasks.length})
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
      </div>
    </div>
  );
}
