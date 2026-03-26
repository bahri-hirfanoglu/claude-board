import { useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { emitStatusTransition } from '../features/board/StatusTransitionContext';

// Track in-flight status updates to prevent socket events from overriding optimistic state
export const pendingUpdates = new Set();

export function useTaskHandlers({ tasks, setTasks, addToast, t, setConfirm, terminal, setSelectedTask, setActivePanel, openModal, closeModal, currentProject }) {

  const onStatusChange = useCallback(async (taskId, newStatus) => {
    const task = tasks.find(x => x.id === taskId);
    if (!task) return;
    const fromStatus = task.status || 'backlog';

    if (newStatus === 'in_progress' && fromStatus !== 'in_progress') {
      setConfirm({
        title: t('toast.startClaude'),
        message: `Moving "${task.title}" to In Progress will automatically start Claude. Continue?`,
        onConfirm: async () => {
          setConfirm(null);
          emitStatusTransition(taskId, fromStatus, newStatus);
          pendingUpdates.add(taskId);
          setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: newStatus } : x));
          try {
            const updated = await api.updateStatus(taskId, newStatus);
            setTasks(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
            addToast(t('toast.claudeStarted', { title: task.title }), 'success');
          } catch (e) {
            setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: fromStatus } : x));
            addToast(e.message, 'error');
          } finally { pendingUpdates.delete(taskId); }
        },
        onCancel: () => setConfirm(null),
      });
      return;
    }

    emitStatusTransition(taskId, fromStatus, newStatus);
    pendingUpdates.add(taskId);
    setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: newStatus } : x));
    try {
      const updated = await api.updateStatus(taskId, newStatus);
      setTasks(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    } catch (e) {
      setTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: fromStatus } : x));
      addToast(e.message, 'error');
    } finally { pendingUpdates.delete(taskId); }
  }, [tasks, addToast, t, setTasks, setConfirm]);

  const onCreate = useCallback(async (data) => {
    const files = data._files;
    const pendingDeps = data._pendingDeps;
    delete data._files;
    delete data._pendingDeps;
    const task = await api.createTask(currentProject.id, data);
    setTasks(prev => prev.some(x => x.id === task.id) ? prev : [...prev, task]);
    if (files?.length > 0) {
      try { await api.uploadAttachments(task.id, files); }
      catch (e) { addToast('File upload failed: ' + e.message, 'error'); }
    }
    if (pendingDeps && pendingDeps.length > 0) {
      let depOk = 0;
      for (const depId of pendingDeps) {
        try {
          await api.addDependency(task.id, depId);
          depOk++;
        } catch (e) {
          addToast(`Dependency failed: ${e.message || e}`, 'error');
        }
      }
      if (depOk > 0) addToast(`${depOk} dependency added`, 'info');
    }
    closeModal('task');
    addToast(t('toast.taskCreated'), 'success');
  }, [currentProject, addToast, t, setTasks, closeModal]);

  const onUpdate = useCallback(async (editingTask, data) => {
    const files = data._files;
    delete data._files;
    const updated = await api.updateTask(editingTask.id, data);
    setTasks(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    if (files?.length > 0) {
      try { await api.uploadAttachments(editingTask.id, files); }
      catch (e) { addToast('File upload failed: ' + e.message, 'error'); }
    }
    closeModal('task');
    addToast(t('toast.taskUpdated'), 'success');
  }, [addToast, t, setTasks, closeModal]);

  const onDelete = useCallback((task) => {
    setConfirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await api.deleteTask(task.id);
        setTasks(prev => prev.filter(x => x.id !== task.id));
        addToast(t('toast.taskDeleted'), 'info');
      },
      onCancel: () => setConfirm(null),
    });
  }, [addToast, t, setTasks, setConfirm]);

  const onViewLogs = useCallback((task) => {
    setSelectedTask(task);
    setActivePanel('logs');
    terminal.openTab(task);
  }, [terminal, setSelectedTask, setActivePanel]);

  const onReview = useCallback((task) => openModal('review', task), [openModal]);

  const onApprove = useCallback(async (taskId) => {
    const updated = await api.updateStatus(taskId, 'done');
    setTasks(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    closeModal('review');
    addToast(t('toast.taskApproved'), 'success');
  }, [addToast, t, setTasks, closeModal]);

  const onRequestChanges = useCallback(async (taskId, feedback) => {
    const updated = await api.requestChanges(taskId, feedback);
    setTasks(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    closeModal('review');
    addToast(t('toast.revisionRequested'), 'info');
  }, [addToast, t, setTasks, closeModal]);

  return { onStatusChange, onCreate, onUpdate, onDelete, onViewLogs, onReview, onApprove, onRequestChanges };
}
