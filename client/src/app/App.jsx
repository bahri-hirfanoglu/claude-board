import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useTerminalTabs } from '../hooks/useTerminalTabs';
import { useToast } from '../hooks/useToast';
import { api, onApiError } from '../lib/api';
import { socket } from '../lib/socket';
import AppLayout from './AppLayout';
import { StatusTransitionProvider, emitStatusTransition } from '../features/board/StatusTransitionContext';
import { I18nProvider, useTranslation } from '../i18n/I18nProvider';

function AppInner() {
  const { t } = useTranslation();
  const connected = useSocket();
  const { toasts, addToast } = useToast();
  const { projects, currentProject, initialLoad, navigateToProject, navigateToDashboard } = useProjects();
  const { tasks } = useTasks(currentProject, addToast);
  const terminal = useTerminalTabs(tasks);

  // Global API error -> toast
  useEffect(() => onApiError((msg) => addToast(msg, 'error')), [addToast]);

  // UI state
  const [activePanel, setActivePanel] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showPlanning, setShowPlanning] = useState(() => {
    return sessionStorage.getItem('planning:active') === 'true';
  });
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [reviewTask, setReviewTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');

  // Auto-open terminal when task starts running
  useEffect(() => {
    const handler = (task) => {
      if (task.is_running) {
        terminal.openTab(task);
        setSelectedTask(task);
        setActivePanel('logs');
      }
    };
    socket.on('task:updated', handler);
    return () => socket.off('task:updated', handler);
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
    api
      .getTemplates(currentProject.id)
      .then(setTemplates)
      .catch(() => setTemplates([]));
    api
      .getRoles(currentProject.id)
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [currentProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && currentProject) {
        e.preventDefault();
        setEditingTask(null);
        setShowModal(true);
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape') {
        if (showModal) {
          setShowModal(false);
          setEditingTask(null);
        } else if (showProjectModal) {
          setShowProjectModal(false);
          setEditingProject(null);
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
  }, [showModal, showProjectModal, confirm, activePanel, currentProject]);

  // ─── Task handlers ───
  const handleStatusChange = useCallback(
    async (taskId, newStatus) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const fromStatus = task.status;
      if (newStatus === 'in_progress' && task.status !== 'in_progress') {
        setConfirm({
          title: t('toast.startClaude'),
          message: `Moving "${task.title}" to In Progress will automatically start Claude. Continue?`,
          onConfirm: async () => {
            setConfirm(null);
            emitStatusTransition(taskId, fromStatus, newStatus);
            await api.updateStatus(taskId, newStatus);
            addToast(t('toast.claudeStarted', { title: task.title }), 'success');
          },
          onCancel: () => setConfirm(null),
        });
        return;
      }
      emitStatusTransition(taskId, fromStatus, newStatus);
      await api.updateStatus(taskId, newStatus);
    },
    [tasks, addToast, t],
  );

  const handleCreateTask = useCallback(
    async (data) => {
      const files = data._files;
      delete data._files;
      const task = await api.createTask(currentProject.id, data);
      if (files?.length > 0) {
        try {
          await api.uploadAttachments(task.id, files);
        } catch (e) {
          addToast('File upload failed: ' + e.message, 'error');
        }
      }
      setShowModal(false);
      addToast(t('toast.taskCreated'), 'success');
    },
    [currentProject, addToast, t],
  );
  const handleUpdateTask = useCallback(
    async (data) => {
      const files = data._files;
      delete data._files;
      await api.updateTask(editingTask.id, data);
      if (files?.length > 0) {
        try {
          await api.uploadAttachments(editingTask.id, files);
        } catch (e) {
          addToast('File upload failed: ' + e.message, 'error');
        }
      }
      setEditingTask(null);
      setShowModal(false);
      addToast(t('toast.taskUpdated'), 'success');
    },
    [editingTask, addToast, t],
  );
  const handleDeleteTask = useCallback(
    (task) => {
      setConfirm({
        title: 'Delete Task',
        message: `Are you sure you want to delete "${task.title}"?`,
        danger: true,
        onConfirm: async () => {
          setConfirm(null);
          await api.deleteTask(task.id);
          addToast(t('toast.taskDeleted'), 'info');
        },
        onCancel: () => setConfirm(null),
      });
    },
    [addToast, t],
  );
  const handleViewLogs = useCallback(
    (task) => {
      setSelectedTask(task);
      setActivePanel('logs');
      terminal.openTab(task);
    },
    [terminal],
  );
  const handleReviewTask = useCallback((task) => setReviewTask(task), []);
  const handleApproveTask = useCallback(
    async (taskId) => {
      await api.updateStatus(taskId, 'done');
      setReviewTask(null);
      addToast(t('toast.taskApproved'), 'success');
    },
    [addToast, t],
  );
  const handleRequestChanges = useCallback(
    async (taskId, feedback) => {
      await api.requestChanges(taskId, feedback);
      setReviewTask(null);
      addToast(t('toast.revisionRequested'), 'info');
    },
    [addToast, t],
  );

  // ─── Project handlers ───
  const handleCreateProject = useCallback(
    async (data) => {
      const p = await api.createProject(data);
      setShowProjectModal(false);
      navigateToProject(p);
      addToast(t('toast.projectCreated'), 'success');
    },
    [navigateToProject, addToast, t],
  );
  const handleUpdateProject = useCallback(
    async (data) => {
      await api.updateProject(editingProject.id, data);
      setEditingProject(null);
      setShowProjectModal(false);
      addToast(t('toast.projectUpdated'), 'success');
      if (data.slug && currentProject && data.slug !== currentProject.slug)
        window.history.replaceState({ slug: data.slug }, '', `/${data.slug}`);
    },
    [editingProject, currentProject, addToast, t],
  );
  const handleDeleteProject = useCallback(() => {
    if (!currentProject) return;
    setConfirm({
      title: 'Delete Project',
      message: `Delete "${currentProject.name}"? All tasks will be deleted.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await api.deleteProject(currentProject.id);
        navigateToDashboard();
        addToast(t('toast.projectDeleted'), 'info');
      },
      onCancel: () => setConfirm(null),
    });
  }, [currentProject, navigateToDashboard, addToast, t]);
  const handleEditProject = useCallback(() => {
    if (currentProject) {
      setEditingProject(currentProject);
      setShowProjectModal(true);
    }
  }, [currentProject]);

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
    <AppLayout
      // Data
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
      // Modals
      showModal={showModal}
      editingTask={editingTask}
      showProjectModal={showProjectModal}
      editingProject={editingProject}
      showClaudeMd={showClaudeMd}
      showSnippets={showSnippets}
      showTemplates={showTemplates}
      showWebhooks={showWebhooks}
      showRoles={showRoles}
      showPlanning={showPlanning}
      templates={templates}
      roles={roles}
      reviewTask={reviewTask}
      detailTask={detailTask}
      // Handlers
      onSearchChange={setSearch}
      onSetActivePanel={setActivePanel}
      onSetSelectedTask={setSelectedTask}
      onNavigateToProject={navigateToProject}
      onNavigateToDashboard={navigateToDashboard}
      // Task
      onStatusChange={handleStatusChange}
      onViewLogs={handleViewLogs}
      onCreateTask={handleCreateTask}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      onOpenCreateModal={() => {
        setEditingTask(null);
        setShowModal(true);
      }}
      onOpenEditModal={(task) => {
        setEditingTask(task);
        setShowModal(true);
      }}
      onCloseTaskModal={() => {
        setShowModal(false);
        setEditingTask(null);
      }}
      // Review
      onReviewTask={handleReviewTask}
      onApproveTask={handleApproveTask}
      onRequestChanges={handleRequestChanges}
      onCloseReview={() => setReviewTask(null)}
      // Project
      onCreateProject={handleCreateProject}
      onUpdateProject={handleUpdateProject}
      onDeleteProject={handleDeleteProject}
      onEditProject={handleEditProject}
      onNewProject={() => {
        setEditingProject(null);
        setShowProjectModal(true);
      }}
      onCloseProjectModal={() => {
        setShowProjectModal(false);
        setEditingProject(null);
      }}
      onEditClaudeMd={() => setShowClaudeMd(true)}
      onCloseClaudeMd={() => setShowClaudeMd(false)}
      onEditSnippets={() => setShowSnippets(true)}
      onCloseSnippets={() => setShowSnippets(false)}
      onEditTemplates={() => setShowTemplates(true)}
      onCloseTemplates={() => {
        setShowTemplates(false);
        if (currentProject)
          api
            .getTemplates(currentProject.id)
            .then(setTemplates)
            .catch(() => {});
      }}
      onEditWebhooks={() => setShowWebhooks(true)}
      onCloseWebhooks={() => setShowWebhooks(false)}
      onEditRoles={() => setShowRoles(true)}
      onCloseRoles={() => {
        setShowRoles(false);
        if (currentProject)
          api
            .getRoles(currentProject.id)
            .then(setRoles)
            .catch(() => {});
      }}
      onViewDetail={(task) => setDetailTask(task)}
      onCloseDetail={() => setDetailTask(null)}
      onOpenPlanning={() => { sessionStorage.setItem('planning:active', 'true'); setShowPlanning(true); }}
      onClosePlanning={() => { sessionStorage.removeItem('planning:active'); setShowPlanning(false); }}
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
