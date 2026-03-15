import LiveTerminal from '../features/terminal/LiveTerminal';

export default function TerminalBottomPanel({ terminal, selectedTask, onSetSelectedTask }) {
  return (
    <div style={{ height: terminal.bottomHeight }} className="flex-shrink-0 flex flex-col">
      {/* Resize handle */}
      <div
        className="h-1 bg-surface-800 hover:bg-claude/50 cursor-row-resize flex-shrink-0 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startY = e.clientY;
          const startH = terminal.bottomHeight;
          const onMove = (ev) => terminal.setBottomHeight(Math.max(150, Math.min(window.innerHeight - 200, startH + (startY - ev.clientY))));
          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      />

      {/* Tabs */}
      {terminal.tabs.length > 1 && (
        <div className="flex items-center bg-surface-900 border-b border-surface-800 px-2 gap-0.5 overflow-x-auto">
          {terminal.tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { terminal.setActiveTabId(tab.id); onSetSelectedTask(tab); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-t border-b-2 transition-colors max-w-[180px] ${
                terminal.activeTabId === tab.id
                  ? 'border-claude text-surface-200 bg-surface-800'
                  : 'border-transparent text-surface-500 hover:text-surface-300'
              }`}
            >
              {tab.is_running && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              <span className="truncate">{tab.title}</span>
              <span
                onClick={(e) => { e.stopPropagation(); terminal.closeTab(tab.id); }}
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
          key={terminal.activeTabId}
          task={terminal.activeTab || selectedTask}
          layout="bottom"
          onClose={() => terminal.closeTab(terminal.activeTabId)}
          onToggleLayout={() => terminal.setLayout('side')}
        />
      </div>
    </div>
  );
}
