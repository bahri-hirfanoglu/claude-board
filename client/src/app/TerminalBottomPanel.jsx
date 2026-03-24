import { Columns2, Rows2, PanelLeftClose } from 'lucide-react';
import LiveTerminal from '../features/terminal/LiveTerminal';

export default function TerminalBottomPanel({ terminal, selectedTask, onSetSelectedTask }) {
  const isSplit = terminal.splitMode && terminal.splitTab;
  const canSplit = terminal.tabs.length >= 2;

  return (
    <div style={{ height: terminal.bottomHeight }} className="flex-shrink-0 flex flex-col border-t border-surface-700">
      {/* Resize handle */}
      <div
        className="h-1.5 bg-surface-800 hover:bg-claude/50 cursor-row-resize flex-shrink-0 transition-colors"
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

      {/* ═══ Tab bar — always visible ═══ */}
      <div className="flex items-center bg-surface-950 border-b border-surface-700 flex-shrink-0 px-1">
        {/* Tabs */}
        <div className="flex-1 flex items-center overflow-x-auto gap-0.5 py-0.5">
          {terminal.tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (isSplit && terminal.activeTabId !== tab.id && terminal.splitTabId !== tab.id) {
                  terminal.setSplitTabId(tab.id);
                } else {
                  terminal.setActiveTabId(tab.id);
                  onSetSelectedTask(tab);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md transition-colors max-w-[200px] ${
                terminal.activeTabId === tab.id
                  ? 'bg-surface-800 text-surface-100 font-medium'
                  : terminal.splitTabId === tab.id
                    ? 'bg-violet-500/10 text-violet-300 font-medium'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
              }`}
            >
              {tab.is_running && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />}
              <span className="truncate">{tab.title}</span>
              <span
                onClick={(e) => { e.stopPropagation(); terminal.closeTab(tab.id); }}
                className="ml-1 hover:text-red-400 text-surface-600 flex-shrink-0"
              >
                ×
              </span>
            </button>
          ))}
        </div>

        {/* ─── Split + layout controls ─── */}
        <div className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-surface-700 ml-1">
          <button
            onClick={() => canSplit && terminal.toggleSplit('vertical')}
            disabled={!canSplit}
            className={`p-1.5 rounded transition-colors ${
              terminal.splitMode === 'vertical'
                ? 'bg-violet-500/20 text-violet-400'
                : canSplit
                  ? 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                  : 'text-surface-700 cursor-not-allowed'
            }`}
            title={canSplit ? 'Split vertical' : 'Open 2+ tabs to split'}
          >
            <Columns2 size={14} />
          </button>
          <button
            onClick={() => canSplit && terminal.toggleSplit('horizontal')}
            disabled={!canSplit}
            className={`p-1.5 rounded transition-colors ${
              terminal.splitMode === 'horizontal'
                ? 'bg-violet-500/20 text-violet-400'
                : canSplit
                  ? 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                  : 'text-surface-700 cursor-not-allowed'
            }`}
            title={canSplit ? 'Split horizontal' : 'Open 2+ tabs to split'}
          >
            <Rows2 size={14} />
          </button>
          <div className="w-px h-4 bg-surface-700 mx-0.5" />
          <button
            onClick={() => terminal.setLayout('side')}
            className="p-1.5 rounded text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            title="Switch to side panel"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      {/* ═══ Terminal content ═══ */}
      <div className={`flex-1 min-h-0 flex ${terminal.splitMode === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
        {/* Primary pane */}
        <div className={isSplit ? (terminal.splitMode === 'horizontal' ? 'flex-1 min-h-0 border-b border-surface-700/50' : 'flex-1 min-w-0 border-r border-surface-700/50') : 'flex-1 min-h-0'}>
          <LiveTerminal
            key={terminal.activeTabId}
            task={terminal.activeTab || selectedTask}
            layout="bottom"
            onClose={() => terminal.closeTab(terminal.activeTabId)}
            onToggleLayout={() => terminal.setLayout('side')}
          />
        </div>

        {/* Split pane */}
        {isSplit && (
          <div className={terminal.splitMode === 'horizontal' ? 'flex-1 min-h-0' : 'flex-1 min-w-0'}>
            <LiveTerminal
              key={`split-${terminal.splitTabId}`}
              task={terminal.splitTab}
              layout="bottom"
              onClose={() => { terminal.setSplitTabId(null); terminal.setSplitMode(null); }}
              onToggleLayout={() => terminal.setLayout('side')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
