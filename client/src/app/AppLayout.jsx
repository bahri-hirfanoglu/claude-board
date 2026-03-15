import Board from '../features/board/Board';
import Dashboard from '../features/dashboard/Dashboard';
import Header from '../features/projects/Header';
import LiveTerminal from '../features/terminal/LiveTerminal';
import StatsPanel from '../features/stats/StatsPanel';
import ActivityTimeline from '../features/activity/ActivityTimeline';
import TaskModal from '../features/tasks/TaskModal';
import ReviewModal from '../features/tasks/ReviewModal';
import ProjectModal from '../features/projects/ProjectModal';
import ClaudeMdEditor from '../features/editor/ClaudeMdEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import TerminalBottomPanel from './TerminalBottomPanel';

export default function AppLayout(props) {
  const {
    connected, projects, currentProject, tasks, filteredTasks, terminal,
    selectedTask, activePanel, search, toasts, confirm,
    showModal, editingTask, showProjectModal, editingProject, showClaudeMd, reviewTask,
    onSearchChange, onSetActivePanel, onSetSelectedTask,
    onNavigateToProject, onNavigateToDashboard,
    onStatusChange, onViewLogs, onCreateTask, onUpdateTask, onDeleteTask,
    onOpenCreateModal, onOpenEditModal, onCloseTaskModal,
    onReviewTask, onApproveTask, onRequestChanges, onCloseReview,
    onCreateProject, onUpdateProject, onDeleteProject, onEditProject, onNewProject, onCloseProjectModal,
    onEditClaudeMd, onCloseClaudeMd,
  } = props;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        connected={connected}
        taskCount={tasks.length}
        runningCount={tasks.filter(t => t.is_running).length}
        tasks={tasks}
        onNewTask={currentProject ? onOpenCreateModal : null}
        onToggleStats={() => onSetActivePanel(prev => prev === 'stats' ? null : 'stats')}
        statsActive={activePanel === 'stats'}
        onToggleActivity={() => onSetActivePanel(prev => prev === 'activity' ? null : 'activity')}
        activityActive={activePanel === 'activity'}
        search={search}
        onSearchChange={onSearchChange}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={onNavigateToProject}
        onBackToDashboard={onNavigateToDashboard}
        onNewProject={onNewProject}
        onEditProject={onEditProject}
        onDeleteProject={onDeleteProject}
        onEditClaudeMd={onEditClaudeMd}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Board or Dashboard */}
          <div className="flex-1 overflow-hidden transition-all duration-300">
            {currentProject ? (
              <Board
                tasks={filteredTasks}
                onStatusChange={onStatusChange}
                onViewLogs={onViewLogs}
                onEditTask={onOpenEditModal}
                onDeleteTask={onDeleteTask}
                onReviewTask={onReviewTask}
              />
            ) : (
              <Dashboard
                projects={projects}
                onSelectProject={onNavigateToProject}
                onNewProject={onNewProject}
              />
            )}
          </div>

          {/* Side panels */}
          {activePanel === 'logs' && terminal.activeTab && terminal.layout === 'side' && (
            <LiveTerminal
              key={terminal.activeTabId}
              task={terminal.activeTab}
              layout="side"
              onClose={() => terminal.closeTab(terminal.activeTabId)}
              onToggleLayout={() => terminal.setLayout('bottom')}
            />
          )}
          {activePanel === 'stats' && currentProject && (
            <StatsPanel projectId={currentProject.id} onClose={() => onSetActivePanel(null)} />
          )}
          {activePanel === 'activity' && currentProject && (
            <ActivityTimeline projectId={currentProject.id} onClose={() => onSetActivePanel(null)} />
          )}
        </div>

        {/* Bottom terminal panel */}
        {activePanel === 'logs' && terminal.hasOpenTabs && terminal.layout === 'bottom' && (
          <TerminalBottomPanel terminal={terminal} selectedTask={selectedTask} onSetSelectedTask={onSetSelectedTask} />
        )}
      </div>

      {/* Modals */}
      {showModal && currentProject && (
        <TaskModal task={editingTask} onSubmit={editingTask ? onUpdateTask : onCreateTask} onClose={onCloseTaskModal} />
      )}
      {showProjectModal && (
        <ProjectModal project={editingProject} onSubmit={editingProject ? onUpdateProject : onCreateProject} onClose={onCloseProjectModal} />
      )}
      {showClaudeMd && currentProject && (
        <ClaudeMdEditor projectId={currentProject.id} projectName={currentProject.name} onClose={onCloseClaudeMd} />
      )}
      {reviewTask && (
        <ReviewModal task={reviewTask} onApprove={onApproveTask} onRequestChanges={onRequestChanges} onClose={onCloseReview} />
      )}
      {confirm && <ConfirmDialog {...confirm} />}
      <Toast toasts={toasts} />
    </div>
  );
}
