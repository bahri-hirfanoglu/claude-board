import Board from '../features/board/Board';
import Dashboard from '../features/dashboard/Dashboard';
import Header from '../features/projects/Header';
import LiveTerminal from '../features/terminal/LiveTerminal';
import StatsPanel from '../features/stats/StatsPanel';
import ActivityTimeline from '../features/activity/ActivityTimeline';
import TaskModal from '../features/tasks/TaskModal';
import ReviewModal from '../features/tasks/ReviewModal';
import TaskDetailModal from '../features/tasks/TaskDetailModal';
import ProjectModal from '../features/projects/ProjectModal';
import ClaudeMdEditor from '../features/editor/ClaudeMdEditor';
import SnippetsModal from '../features/snippets/SnippetsModal';
import TemplatesModal from '../features/templates/TemplatesModal';
import WebhooksModal from '../features/webhooks/WebhooksModal';
import RolesModal from '../features/roles/RolesModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import TerminalBottomPanel from './TerminalBottomPanel';
import { VoiceAssistantProvider } from '../features/voice/VoiceAssistantProvider';
import VoiceAssistant from '../features/voice/VoiceAssistant';
import PlanningModal from '../features/planning/PlanningModal';
import CommandsModal from '../features/commands/CommandsModal';
import SkillsModal from '../features/skills/SkillsModal';
import ScanModal from '../features/scan/ScanModal';
import SettingsModal from '../features/settings/SettingsModal';
import ChatSidebar from '../features/chat/ChatSidebar';
import ErrorBoundary from '../components/ErrorBoundary';

export default function AppLayout({
  connected,
  projects,
  currentProject,
  tasks,
  filteredTasks,
  terminal,
  selectedTask,
  activePanel,
  search,
  toasts,
  confirm,
  templates,
  roles,
  modals,
  openModal,
  closeModal,
  onClosePlanning,
  onOpenPlanning,
  onCloseTemplates,
  onCloseRoles,
  onSearchChange,
  onSetActivePanel,
  onSetSelectedTask,
  onNavigateToProject,
  onNavigateToDashboard,
  taskActions,
  projectActions,
  onOpenAppSettings,
}) {
  const editingTask = modals.task === true ? null : modals.task;
  const editingProject = modals.project === true ? null : modals.project;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <Header
        connected={connected}
        taskCount={tasks.length}
        runningCount={tasks.filter((t) => t.is_running).length}
        tasks={tasks}
        onNewTask={currentProject ? () => openModal('task') : null}
        onToggleStats={() => onSetActivePanel((prev) => (prev === 'stats' ? null : 'stats'))}
        statsActive={activePanel === 'stats'}
        onToggleActivity={() => onSetActivePanel((prev) => (prev === 'activity' ? null : 'activity'))}
        activityActive={activePanel === 'activity'}
        search={search}
        onSearchChange={onSearchChange}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={onNavigateToProject}
        onBackToDashboard={onNavigateToDashboard}
        onNewProject={() => openModal('project')}
        onEditProject={projectActions.onEdit}
        onDeleteProject={projectActions.onDelete}
        onEditClaudeMd={() => openModal('claudeMd')}
        onEditSnippets={() => openModal('snippets')}
        onEditTemplates={() => openModal('templates')}
        onOpenPlanning={currentProject ? onOpenPlanning : null}
        onEditWebhooks={() => openModal('webhooks')}
        onEditRoles={() => openModal('roles')}
        onEditCommands={() => openModal('commands')}
        onEditSkills={() => openModal('skills')}
        onOpenAppSettings={onOpenAppSettings}
        onOpenScan={currentProject ? () => openModal('scan') : null}
        onToggleChat={currentProject ? () => (modals.chat ? closeModal('chat') : openModal('chat')) : null}
        chatActive={!!modals.chat}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Board or Dashboard */}
          <div className="flex-1 overflow-hidden transition-all duration-300">
            {currentProject ? (
              <Board
                tasks={filteredTasks}
                projectId={currentProject.id}
                project={currentProject}
                onStatusChange={taskActions.onStatusChange}
                onViewLogs={taskActions.onViewLogs}
                onEditTask={(task) => openModal('task', task)}
                onDeleteTask={taskActions.onDelete}
                onBulkDelete={taskActions.onBulkDelete}
                onReviewTask={taskActions.onReview}
                onViewDetail={(task) => openModal('detail', task)}
              />
            ) : (
              <Dashboard
                projects={projects}
                onSelectProject={onNavigateToProject}
                onNewProject={() => openModal('project')}
                onOpenSettings={onOpenAppSettings}
                onDeleteProject={projectActions.onDeleteById}
              />
            )}
          </div>

          {/* Side panels */}
          {activePanel === 'logs' && terminal.activeTab && terminal.layout === 'side' && (
            <div className="absolute inset-0 md:relative md:inset-auto z-20 md:z-auto h-full">
              <LiveTerminal
                key={terminal.activeTabId}
                task={terminal.activeTab}
                layout="side"
                onClose={() => terminal.closeTab(terminal.activeTabId)}
                onToggleLayout={() => terminal.setLayout('bottom')}
              />
            </div>
          )}
          {activePanel === 'stats' && currentProject && (
            <div className="absolute inset-0 md:relative md:inset-auto z-20 md:z-auto h-full">
              <StatsPanel projectId={currentProject.id} onClose={() => onSetActivePanel(null)} />
            </div>
          )}
          {activePanel === 'activity' && currentProject && (
            <div className="absolute inset-0 md:relative md:inset-auto z-20 md:z-auto h-full">
              <ActivityTimeline projectId={currentProject.id} onClose={() => onSetActivePanel(null)} />
            </div>
          )}

          {/* AI Chat Sidebar */}
          {modals.chat && currentProject && (
            <ChatSidebar
              projectId={currentProject.id}
              projectName={currentProject.name}
              onClose={() => closeModal('chat')}
            />
          )}
        </div>

        {/* Bottom terminal panel */}
        {activePanel === 'logs' && terminal.hasOpenTabs && terminal.layout === 'bottom' && (
          <TerminalBottomPanel terminal={terminal} selectedTask={selectedTask} onSetSelectedTask={onSetSelectedTask} />
        )}
      </div>

      {/* Modals */}
      {modals.task && currentProject && (
        <ErrorBoundary>
          <TaskModal
            task={editingTask}
            onSubmit={editingTask ? (data) => taskActions.onUpdate(editingTask, data) : taskActions.onCreate}
            onClose={() => closeModal('task')}
            templates={templates || []}
            roles={roles || []}
            allTasks={tasks}
          />
        </ErrorBoundary>
      )}
      {modals.project && (
        <ErrorBoundary>
          <ProjectModal
            project={editingProject}
            onSubmit={
              editingProject ? (data) => projectActions.onUpdate(editingProject, data) : projectActions.onCreate
            }
            onClose={() => closeModal('project')}
          />
        </ErrorBoundary>
      )}
      {modals.claudeMd && currentProject && (
        <ErrorBoundary>
          <ClaudeMdEditor
            projectId={currentProject.id}
            projectName={currentProject.name}
            onClose={() => closeModal('claudeMd')}
          />
        </ErrorBoundary>
      )}
      {modals.snippets && currentProject && (
        <ErrorBoundary>
          <SnippetsModal
            projectId={currentProject.id}
            projectName={currentProject.name}
            onClose={() => closeModal('snippets')}
          />
        </ErrorBoundary>
      )}
      {modals.templates && currentProject && (
        <ErrorBoundary>
          <TemplatesModal projectId={currentProject.id} projectName={currentProject.name} onClose={onCloseTemplates} />
        </ErrorBoundary>
      )}
      {modals.webhooks && currentProject && (
        <ErrorBoundary>
          <WebhooksModal
            projectId={currentProject.id}
            projectName={currentProject.name}
            onClose={() => closeModal('webhooks')}
          />
        </ErrorBoundary>
      )}
      {modals.roles && currentProject && (
        <ErrorBoundary>
          <RolesModal projectId={currentProject.id} projectName={currentProject.name} onClose={onCloseRoles} />
        </ErrorBoundary>
      )}
      {modals.review && (
        <ErrorBoundary>
          <ReviewModal
            task={modals.review}
            onApprove={taskActions.onApprove}
            onRequestChanges={taskActions.onRequestChanges}
            onClose={() => closeModal('review')}
          />
        </ErrorBoundary>
      )}
      {modals.detail && (
        <ErrorBoundary>
          <TaskDetailModal
            task={modals.detail}
            onClose={() => closeModal('detail')}
            onStatusChange={taskActions.onStatusChange}
          />
        </ErrorBoundary>
      )}
      {modals.planning && currentProject && (
        <ErrorBoundary>
          <PlanningModal projectId={currentProject.id} onClose={onClosePlanning} />
        </ErrorBoundary>
      )}
      {modals.commands && (
        <ErrorBoundary>
          <CommandsModal onClose={() => closeModal('commands')} />
        </ErrorBoundary>
      )}
      {modals.skills && (
        <ErrorBoundary>
          <SkillsModal onClose={() => closeModal('skills')} />
        </ErrorBoundary>
      )}
      {modals.scan && currentProject && (
        <ErrorBoundary>
          <ScanModal projectId={currentProject.id} onClose={() => closeModal('scan')} />
        </ErrorBoundary>
      )}
      {modals.appSettings && (
        <ErrorBoundary>
          <SettingsModal onClose={() => closeModal('appSettings')} />
        </ErrorBoundary>
      )}
      {confirm && <ConfirmDialog {...confirm} />}
      <Toast toasts={toasts} />
      {/* Voice assistant temporarily disabled
      <VoiceAssistantProvider
        tasks={tasks}
        currentProject={currentProject}
        onCreateTask={taskActions.onCreate}
        onStatusChange={taskActions.onStatusChange}
      >
        <VoiceAssistant />
      </VoiceAssistantProvider>
      */}
    </div>
  );
}
