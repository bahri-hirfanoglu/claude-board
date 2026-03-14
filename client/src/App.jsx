import { useState, useEffect, useCallback } from 'react';
import { socket } from './socket';
import { api } from './api';
import Board from './components/Board';
import TaskModal from './components/TaskModal';
import LiveTerminal from './components/LiveTerminal';
import StatsPanel from './components/StatsPanel';
import Header from './components/Header';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import ProjectModal from './components/ProjectModal';
import ClaudeMdEditor from './components/ClaudeMdEditor';
import ReviewModal from './components/ReviewModal';
import ActivityTimeline from './components/ActivityTimeline';
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
  const [reviewTask, setReviewTask] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [terminalLayout, setTerminalLayout] = useState('side'); // 'side' or 'bottom'
  const [terminalTabs, setTerminalTabs] = useState([]); // [{task}]
  const [activeTabId, setActiveTabId] = useState(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);

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
      setTasks(prev => {
        const old = prev.find(t => t.id === task.id);
        // Auto-open terminal when task starts running
        if (task.is_running && !old?.is_running) {
          setTerminalTabs(tabs => {
            if (tabs.find(t => t.id === task.id)) return tabs;
            return [...tabs, task];
          });
          setActiveTabId(task.id);
          setSelectedTask(task);
          setActivePanel('logs');
        }
        return prev.map(t => t.id === task.id ? { ...t, ...task } : t);
      });
      setSelectedTask(prev => prev?.id === task.id ? { ...prev, ...task } : prev);
    });

    socket.on('task:usage', (usage) => {
      const patch = {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens,
        cache_creation_tokens: usage.cache_creation_tokens,
        total_cost: usage.total_cost ?? undefined,
      };
      // Remove undefined keys
      Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
      setTasks(prev => prev.map(t => t.id === usage.taskId ? { ...t, ...patch } : t));
      setSelectedTask(prev => prev?.id === usage.taskId ? { ...prev, ...patch } : prev);
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
      socket.off('task:usage');
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

  const handleReviewTask = (task) => {
    setReviewTask(task);
  };

  const handleApproveTask = async (taskId) => {
    await api.updateStatus(taskId, 'done');
    setReviewTask(null);
    addToast('Task approved and moved to Done', 'success');
  };

  const handleRequestChanges = async (taskId, feedback) => {
    await api.requestChanges(taskId, feedback);
    setReviewTask(null);
    addToast('Changes requested — Claude is working on revision', 'info');
  };

  const handleViewLogs = (task) => {
    setSelectedTask(task);
    setActivePanel('logs');
    // Add tab if not already open
    setTerminalTabs(prev => {
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
    setActiveTabId(task.id);
  };

  const handleCloseTerminalTab = (taskId) => {
    setTerminalTabs(prev => prev.filter(t => t.id !== taskId));
    if (activeTabId === taskId) {
      setTerminalTabs(prev => {
        const remaining = prev.filter(t => t.id !== taskId);
        if (remaining.length > 0) {
          const newActive = remaining[remaining.length - 1];
          setActiveTabId(newActive.id);
          setSelectedTask(newActive);
        } else {
          setActiveTabId(null);
          setSelectedTask(null);
          setActivePanel(null);
        }
        return remaining;
      });
    }
  };

  const handleCloseAllTerminals = () => {
    setTerminalTabs([]);
    setActiveTabId(null);
    setSelectedTask(null);
    setActivePanel(null);
  };

  // Keep terminal tabs in sync with task updates
  useEffect(() => {
    setTerminalTabs(prev => prev.map(tab => {
      const updated = tasks.find(t => t.id === tab.id);
      return updated ? { ...tab, ...updated } : tab;
    }));
  }, [tasks]);

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
        tasks={tasks}
        onNewTask={currentProject ? openCreateModal : null}
        onToggleStats={() => setActivePanel(prev => prev === 'stats' ? null : 'stats')}
        statsActive={activePanel === 'stats'}
        onToggleActivity={() => setActivePanel(prev => prev === 'activity' ? null : 'activity')}
        activityActive={activePanel === 'activity'}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden transition-all duration-300">
            {currentProject ? (
              <Board
                tasks={filteredTasks}
                onStatusChange={handleStatusChange}
                onViewLogs={handleViewLogs}
                onEditTask={openEditModal}
                onDeleteTask={handleDeleteTask}
                onReviewTask={handleReviewTask}
              />
            ) : (
              <Dashboard
                projects={projects}
                onSelectProject={navigateToProject}
                onNewProject={() => { setEditingProject(null); setShowProjectModal(true); }}
              />
            )}
          </div>

          {/* Side panel terminal */}
          {activePanel === 'logs' && selectedTask && terminalLayout === 'side' && (
            <LiveTerminal
              key={activeTabId}
              task={terminalTabs.find(t => t.id === activeTabId) || selectedTask}
              layout="side"
              onClose={() => handleCloseTerminalTab(activeTabId)}
              onToggleLayout={() => setTerminalLayout('bottom')}
            />
          )}

          {activePanel === 'stats' && currentProject && (
            <StatsPanel projectId={currentProject.id} onClose={() => setActivePanel(null)} />
          )}

          {activePanel === 'activity' && currentProject && (
            <ActivityTimeline projectId={currentProject.id} onClose={() => setActivePanel(null)} />
          )}
        </div>

        {/* Bottom panel terminal */}
        {activePanel === 'logs' && terminalTabs.length > 0 && terminalLayout === 'bottom' && (
          <div style={{ height: bottomPanelHeight }} className="flex-shrink-0 flex flex-col">
            {/* Resize handle */}
            <div
              className="h-1 bg-surface-800 hover:bg-claude/50 cursor-row-resize flex-shrink-0 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startH = bottomPanelHeight;
                const onMove = (ev) => {
                  const delta = startY - ev.clientY;
                  setBottomPanelHeight(Math.max(150, Math.min(window.innerHeight - 200, startH + delta)));
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />

            {/* Tabs */}
            {terminalTabs.length > 1 && (
              <div className="flex items-center bg-surface-900 border-b border-surface-800 px-2 gap-0.5 overflow-x-auto">
                {terminalTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTabId(tab.id);
                      setSelectedTask(tab);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-t border-b-2 transition-colors max-w-[180px] ${
                      activeTabId === tab.id
                        ? 'border-claude text-surface-200 bg-surface-800'
                        : 'border-transparent text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    {tab.is_running && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                    <span className="truncate">{tab.title}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleCloseTerminalTab(tab.id); }}
                      className="ml-1 hover:text-red-400 text-surface-600"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Active terminal */}
            <div className="flex-1 min-h-0">
              <LiveTerminal
                key={activeTabId}
                task={terminalTabs.find(t => t.id === activeTabId) || selectedTask}
                layout="bottom"
                onClose={() => handleCloseTerminalTab(activeTabId)}
                onToggleLayout={() => setTerminalLayout('side')}
              />
            </div>
          </div>
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

      {reviewTask && (
        <ReviewModal
          task={reviewTask}
          onApprove={handleApproveTask}
          onRequestChanges={handleRequestChanges}
          onClose={() => setReviewTask(null)}
        />
      )}

      {confirm && <ConfirmDialog {...confirm} />}

      <Toast toasts={toasts} />
    </div>
  );
}
