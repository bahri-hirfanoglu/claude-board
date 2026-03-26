import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { tauriListen, IS_TAURI } from '../lib/tauriEvents';
import { pendingUpdates } from './useTaskHandlers';

export function useTasks(currentProject, addToast) {
  const [tasks, setTasks] = useState([]);

  // Load tasks when project changes
  useEffect(() => {
    if (!currentProject) {
      setTasks([]);
      return;
    }
    api
      .getTasks(currentProject.id)
      .then(setTasks)
      .catch((err) => {
        console.error('Failed to load tasks:', err);
        addToast?.('Failed to load tasks', 'error');
      });
  }, [currentProject, addToast]);

  // Real-time events
  useEffect(() => {
    const onCreate = (task) => {
      if (currentProject && task.project_id === currentProject.id) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === task.id)) return prev;
          return [...prev, task];
        });
      }
    };
    const onUpdate = (task) => {
      // Skip socket updates for tasks with in-flight API calls to prevent race conditions
      if (pendingUpdates.has(task.id)) return;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)));
    };
    const onUsage = (usage) => {
      const patch = {};
      if (usage.input_tokens !== undefined) patch.input_tokens = usage.input_tokens;
      if (usage.output_tokens !== undefined) patch.output_tokens = usage.output_tokens;
      if (usage.cache_read_tokens !== undefined) patch.cache_read_tokens = usage.cache_read_tokens;
      if (usage.cache_creation_tokens !== undefined) patch.cache_creation_tokens = usage.cache_creation_tokens;
      if (usage.total_cost != null) patch.total_cost = usage.total_cost;
      setTasks((prev) => prev.map((t) => (t.id === usage.taskId ? { ...t, ...patch } : t)));
    };
    const onDelete = ({ id }) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    };

    if (IS_TAURI) {
      const unsubs = [
        tauriListen('task:created', onCreate),
        tauriListen('task:updated', onUpdate),
        tauriListen('task:usage', onUsage),
        tauriListen('task:deleted', onDelete),
      ];
      return () => unsubs.forEach((fn) => fn());
    } else {
      socket.on('task:created', onCreate);
      socket.on('task:updated', onUpdate);
      socket.on('task:usage', onUsage);
      socket.on('task:deleted', onDelete);
      return () => {
        socket.off('task:created', onCreate);
        socket.off('task:updated', onUpdate);
        socket.off('task:usage', onUsage);
        socket.off('task:deleted', onDelete);
      };
    }
  }, [currentProject]);

  return { tasks, setTasks };
}
