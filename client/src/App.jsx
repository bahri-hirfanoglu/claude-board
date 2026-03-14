import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import { api } from './api';
import Board from './components/Board';
import TaskModal from './components/TaskModal';
import LiveLog from './components/LiveLog';
import StatsPanel from './components/StatsPanel';
import Header from './components/Header';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import ProjectModal from './components/ProjectModal';
import ClaudeMdEditor from './components/ClaudeMdEditor';
import Dashboard from './components/Dashboard';

function getSlugFromPath() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return path || null;
}

export default function App() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Navigate to a project (update URL)
  const navigateToProject = useCallback((project) => {
    setCurrentProject(project);
    setActivePanel(null);
    setSelectedTask(null);
    if (project) {
      window.history.pushState({ slug: project.slug }, '', `/${project.slug}`);
    }
  }, []);

  // Navigate to dashboard (update URL)
  const navigateToDashboard = useCallback(() => {
    setCurrentProject(null);
    setActivePanel(null);
    setSelectedTask(null);
    window.history.pushState({}, '', '/');
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
      return data;
    } catch (err) {
      console.error('Failed to load projects:', err);
      return [];
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!currentProject) { setTasks([]); return; }
    try {
      const data = await api.getTasks(currentProject.id);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      addToast('Failed to load tasks', 'error');
    }
  }, [currentProject, addToast]);

  // Initial load: fetch projects then resolve URL slug
  useEffect(() => {
    loadProjects().then(data => {
      const slug = getSlugFromPath();
      if (slug && data.length > 0) {
        const match = data.find(p => p.slug === slug);
        if (match) {
          setCurrentProject(match);
          // Replace state so we don't double-push
          window.history.replaceState({ slug: match.slug }, '', `/${match.slug}`);
        }
      }
      setInitialLoad(false);
    });
  }, []);

  useEffect(() => {
    loadTasks();
  }, [currentProject]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (e) => {
      const slug = getSlugFromPath();
      if (slug) {
        const match = projects.find(p => p.slug === slug);
        if (match) {
          setCurrentProject(match);
          setActivePanel(null);
          setSelectedTask(null);
        } else {
          setCurrentProject(null);
        }
      } else {
        setCurrentProject(null);
        setActivePanel(null);
        setSelectedTask(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects]);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('task:created', (task) => {
      if (currentProject && task.project_id === currentProject.id) {
        setTasks(prev => [...prev, task]);
      }
    });

    socket.on('task:updated', (task) => {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } : t));
      setSelectedTask(prev => prev?.id === task.id ? { ...prev, ...task } : prev);
    });

    socket.on('task:deleted', ({ id }) => {
      setTasks(prev => prev.filter(t => t.id !== id));
      setSelectedTask(prev => prev?.id === id ? null : prev);
    });

    socket.on('project:created', (project) => {
      setProjects(prev => [...prev, project]);
    });

    socket.on('project:updated', (project) => {
      setProjects(prev => prev.map(p => p.id === project.id ? project : p));
      setCurrentProject(prev => prev?.id === project.id ? project : prev);
    });

    socket.on('project:deleted', ({ id }) => {
      setProjects(prev => prev.filter(p => p.id !== id));
      setCurrentProject(prev => {
        if (prev?.id === id) {
          window.history.pushState({}, '', '/');
          return null;
        }
        return prev;
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
      socket.off('project:created');
      socket.off('project:updated');
      socket.off('project:deleted');
    };
  }, [currentProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (currentProject) openCreateModal();
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'Escape') {
        if (showModal) { setShowModal(false); setEditingTask(null); }
        else if (showProjectModal) { setShowProjectModal(false); setEditingProject(null); }
        else if (confirm) { confirm.onCancel(); }
        else if (activePanel) { setActivePanel(null); setSelectedTask(null); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal, showProjectModal, confirm, activePanel, currentProject]);

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (newStatus === 'in_progress' && task.status !== 'in_progress') {
      setConfirm({
        title: 'Start Claude?',
        message: `Moving "${task.title}" to In Progress will automatically start Claude. Continue?`,
        onConfirm: async () => {
          setConfirm(null);
          await api.updateStatus(taskId, newStatus);
          addToast(`Claude started for "${task.title}"`, 'success');
        },
        onCancel: () => setConfirm(null),
      });
      return;
    }

    await api.updateStatus(taskId, newStatus);
  };

  const handleCreateTask = async (data) => {
    await api.createTask(currentProject.id, data);
    setShowModal(false);
    addToast('Task created', 'success');
  };

  const handleUpdateTask = async (data) => {
    await api.updateTask(editingTask.id, data);
    setEditingTask(null);
    setShowModal(false);
    addToast('Task updated', 'success');
  };

  const handleDeleteTask = (task) => {
    setConfirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await api.deleteTask(task.id);
        addToast('Task deleted', 'info');
      },
      onCancel: () => setConfirm(null),
    });
  };

  const handleViewLogs = (task) => {
    setSelectedTask(task);
    setActivePanel('logs');
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCreateProject = async (data) => {
    const project = await api.createProject(data);
    setShowProjectModal(false);
    navigateToProject(project);
    addToast('Project created', 'success');
  };

  const handleUpdateProject = async (data) => {
    await api.updateProject(editingProject.id, data);
    setEditingProject(null);
    setShowProjectModal(false);
    addToast('Project updated', 'success');
    // Update URL if slug changed
    if (data.slug && currentProject && data.slug !== currentProject.slug) {
      window.history.replaceState({ slug: data.slug }, '', `/${data.slug}`);
    }
  };

  const handleDeleteProject = () => {
    if (!currentProject) return;
    setConfirm({
      title: 'Delete Project',
      message: `Are you sure you want to delete "${currentProject.name}"? All tasks will be deleted.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await api.deleteProject(currentProject.id);
        navigateToDashboard();
        addToast('Project deleted', 'info');
      },
      onCancel: () => setConfirm(null),
    });
  };

  const handleEditProject = () => {
    if (!currentProject) return;
    setEditingProject(currentProject);
    setShowProjectModal(true);
  };

  const filteredTasks = search.trim()
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  if (initialLoad) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-950">
        <div className="text-claude text-2xl animate-pulse">&#10022;</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        connected={connected}
        taskCount={tasks.length}
        runningCount={tasks.filter(t => t.is_running).length}
        onNewTask={currentProject ? openCreateModal : null}
        onToggleStats={() => setActivePanel(prev => prev === 'stats' ? null : 'stats')}
        statsActive={activePanel === 'stats'}
        search={search}
        onSearchChange={setSearch}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={navigateToProject}
        onBackToDashboard={navigateToDashboard}
        onNewProject={() => { setEditingProject(null); setShowProjectModal(true); }}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        onEditClaudeMd={() => setShowClaudeMd(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden transition-all duration-300">
          {currentProject ? (
            <Board
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              onViewLogs={handleViewLogs}
              onEditTask={openEditModal}
              onDeleteTask={handleDeleteTask}
            />
          ) : (
            <Dashboard
              projects={projects}
              onSelectProject={navigateToProject}
              onNewProject={() => { setEditingProject(null); setShowProjectModal(true); }}
            />
          )}
        </div>

        {activePanel === 'logs' && selectedTask && (
          <LiveLog
            task={selectedTask}
            onClose={() => { setActivePanel(null); setSelectedTask(null); }}
          />
        )}

        {activePanel === 'stats' && currentProject && (
          <StatsPanel projectId={currentProject.id} onClose={() => setActivePanel(null)} />
        )}
      </div>

      {showModal && currentProject && (
        <TaskModal
          task={editingTask}
          onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
          onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
        />
      )}

      {showClaudeMd && currentProject && (
        <ClaudeMdEditor
          projectId={currentProject.id}
          projectName={currentProject.name}
          onClose={() => setShowClaudeMd(false)}
        />
      )}

      {confirm && <ConfirmDialog {...confirm} />}

      <Toast toasts={toasts} />
    </div>
  );
}
