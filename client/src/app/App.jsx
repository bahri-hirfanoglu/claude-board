import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useTerminalTabs } from '../hooks/useTerminalTabs';
import { useToast } from '../hooks/useToast';
import { useModalState } from '../hooks/useModalState';
import { useTaskHandlers } from '../hooks/useTaskHandlers';
import { useProjectHandlers } from '../hooks/useProjectHandlers';
import { api, onApiError } from '../lib/api';
import { socket } from '../lib/socket';
import { tauriListen, IS_TAURI } from '../lib/tauriEvents';
import AppLayout from './AppLayout';
import { StatusTransitionProvider } from '../features/board/StatusTransitionContext';
import { I18nProvider, useTranslation } from '../i18n/I18nProvider';

function AppInner() {
  const { t } = useTranslation();
  const connected = useSocket();
  const { toasts, addToast } = useToast();
  const { projects, currentProject, initialLoad, navigateToProject, navigateToDashboard } = useProjects();
  const { tasks, setTasks } = useTasks(currentProject, addToast);
  const terminal = useTerminalTabs(tasks);

  // Global API error -> toast
  useEffect(() => onApiError((msg) => addToast(msg, 'error')), [addToast]);

  // ─── Modal state (replaces 12 individual useState) ───
  const { modals, openModal, closeModal } = useModalState({
    planning: sessionStorage.getItem('planning:active') === 'true' || null,
  });

  // UI state
  const [activePanel, setActivePanel] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);

  // ─── Task handlers ───
  const taskActions = useTaskHandlers({
    tasks, setTasks, addToast, t, setConfirm, terminal,
    setSelectedTask, setActivePanel, openModal, closeModal, currentProject,
  });

  // ─── Project handlers ───
  const projectActions = useProjectHandlers({
    currentProject, navigateToProject, navigateToDashboard,
    addToast, t, setConfirm, openModal, closeModal,
  });

  // ─── Special modal closers (with side effects) ───
  const handleClosePlanning = useCallback(() => {
    sessionStorage.removeItem('planning:active');
    closeModal('planning');
  }, [closeModal]);

  const handleOpenPlanning = useCallback(() => {
    sessionStorage.setItem('planning:active', 'true');
    openModal('planning');
  }, [openModal]);

  const handleCloseTemplates = useCallback(() => {
    closeModal('templates');
    if (currentProject)
      api.getTemplates(currentProject.id).then(setTemplates).catch(() => {});
  }, [closeModal, currentProject]);

  const handleCloseRoles = useCallback(() => {
    closeModal('roles');
    if (currentProject)
      api.getRoles(currentProject.id).then(setRoles).catch(() => {});
  }, [closeModal, currentProject]);

  // Listen for app updates
  useEffect(() => {
    if (!IS_TAURI) return;
    const unsubs = [
      tauriListen('update:available', (data) => setUpdateInfo(data)),
      tauriListen('update:ready', (data) => setUpdateInfo({ ...data, status: 'ready' })),
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  // Auto-open terminal when task NEWLY starts running
  const runningIdsRef = useRef(new Set());
  const suppressRef = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => { suppressRef.current = false; }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    runningIdsRef.current = new Set(tasks.filter(t => t.is_running).map(t => t.id));
  }, [tasks]);

  useEffect(() => {
    const handler = (task) => {
      if (suppressRef.current) return;
      if (task.is_running && !runningIdsRef.current.has(task.id)) {
        runningIdsRef.current.add(task.id);
        terminal.openTab(task);
        setSelectedTask(task);
        setActivePanel('logs');
      } else if (!task.is_running) {
        runningIdsRef.current.delete(task.id);
      }
    };
    if (IS_TAURI) {
      return tauriListen('task:updated', handler);
    } else {
      socket.on('task:updated', handler);
      return () => socket.off('task:updated', handler);
    }
  }, [terminal]);

  // Clear panels on project change
  useEffect(() => {
    setActivePanel(null);
    setSelectedTask(null);
    setSearch('');
  }, [currentProject]);

  // Fetch templates and roles when project changes
  useEffect(() => {
    if (!currentProject) {
      setTemplates([]);
      setRoles([]);
      return;
    }
    api.getTemplates(currentProject.id).then(setTemplates).catch(() => setTemplates([]));
    api.getRoles(currentProject.id).then(setRoles).catch(() => setRoles([]));
  }, [currentProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && currentProject) {
        e.preventDefault();
        openModal('task');
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape') {
        if (modals.task) {
          closeModal('task');
        } else if (modals.project) {
          closeModal('project');
        } else if (confirm) {
          confirm.onCancel();
        } else if (activePanel) {
          setActivePanel(null);
          setSelectedTask(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modals.task, modals.project, confirm, activePanel, currentProject, openModal, closeModal]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [tasks, search]);

  if (initialLoad) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-950">
        <div className="text-claude text-2xl animate-pulse">&#10022;</div>
      </div>
    );
  }

  return (
    <StatusTransitionProvider>
    {updateInfo && (
      <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 bg-claude text-white text-xs font-medium">
        {updateInfo.status === 'ready' ? (
          <>
            <span>v{updateInfo.version} is ready. Restart to update.</span>
            <button onClick={() => { window.__TAURI_INTERNALS__?.invoke('plugin:process|restart').catch(() => window.location.reload()); }} className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs">Restart Now</button>
          </>
        ) : updateInfo.status === 'downloading' ? (
          <span>Downloading v{updateInfo.version}...</span>
        ) : (
          <span>v{updateInfo.version} available</span>
        )}
        <button onClick={() => setUpdateInfo(null)} className="ml-auto text-white/60 hover:text-white">&#x2715;</button>
      </div>
    )}
    <AppLayout
      connected={connected}
      projects={projects}
      currentProject={currentProject}
      tasks={tasks}
      filteredTasks={filteredTasks}
      terminal={terminal}
      selectedTask={selectedTask}
      activePanel={activePanel}
      search={search}
      toasts={toasts}
      confirm={confirm}
      templates={templates}
      roles={roles}
      modals={modals}
      openModal={openModal}
      closeModal={closeModal}
      onClosePlanning={handleClosePlanning}
      onOpenPlanning={handleOpenPlanning}
      onCloseTemplates={handleCloseTemplates}
      onCloseRoles={handleCloseRoles}
      onSearchChange={setSearch}
      onSetActivePanel={setActivePanel}
      onSetSelectedTask={setSelectedTask}
      onNavigateToProject={navigateToProject}
      onNavigateToDashboard={navigateToDashboard}
      taskActions={taskActions}
      projectActions={projectActions}
      onOpenAppSettings={() => openModal('appSettings')}
    />
    </StatusTransitionProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
