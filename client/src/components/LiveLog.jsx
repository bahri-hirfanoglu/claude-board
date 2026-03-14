import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Square, RotateCcw, ArrowDown, Pause, Play, Trash2 } from 'lucide-react';
import { socket } from '../socket';
import { api } from '../api';

const LOG_COLORS = {
  claude: 'text-surface-200',
  system: 'text-claude',
  error: 'text-red-400',
  success: 'text-emerald-400',
  tool: 'text-purple-400',
  info: 'text-surface-400',
};

export default function LiveLog({ task, onClose }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('all');
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);
  const pausedLogsRef = useRef([]);

  useEffect(() => {
    api.getTaskLogs(task.id).then(setLogs).catch(console.error);
  }, [task.id]);

  useEffect(() => {
    const handler = (data) => {
      if (data.taskId !== task.id) return;
      const entry = { message: data.message, log_type: data.logType, created_at: data.created_at };
      if (paused) {
        pausedLogsRef.current.push(entry);
      } else {
        setLogs(prev => [...prev, entry]);
      }
    };

    socket.on('task:log', handler);
    return () => socket.off('task:log', handler);
  }, [task.id, paused]);

  const resumeLogs = useCallback(() => {
    setPaused(false);
    setLogs(prev => [...prev, ...pausedLogsRef.current]);
    pausedLogsRef.current = [];
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const handleStop = async () => {
    try { await api.stopTask(task.id); } catch (err) { console.error(err); }
  };

  const handleRestart = async () => {
    try {
      setLogs([]);
      await api.restartTask(task.id);
    } catch (err) { console.error(err); }
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.log_type === filter);

  return (
    <div className="w-[480px] flex-shrink-0 flex flex-col bg-surface-900 border-l border-surface-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="min-w-0">
          <h3 className="text-sm font-medium truncate">{task.title}</h3>
          <span className="text-[10px] text-surface-500">#{task.id} - Live Output</span>
        </div>
        <div className="flex items-center gap-1">
          {task.is_running && (
            <button onClick={handleStop} className="p-1.5 rounded-lg hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-colors" title="Stop">
              <Square size={14} />
            </button>
          )}
          <button onClick={handleRestart} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-amber-400 transition-colors" title="Restart">
            <RotateCcw size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-surface-800">
        {['all', 'claude', 'tool', 'system', 'error', 'success'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === f
                ? 'bg-surface-700 text-surface-200'
                : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => paused ? resumeLogs() : setPaused(true)}
          className={`p-1 rounded transition-colors ${paused ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-surface-300'}`}
          title={paused ? `Resume (${pausedLogsRef.current.length} buffered)` : 'Pause'}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
        <button
          onClick={() => setLogs([])}
          className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
          title="Clear"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-surface-600 py-12">
            {task.is_running ? 'Waiting for output...' : 'No logs yet'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className={`py-0.5 ${LOG_COLORS[log.log_type] || 'text-surface-300'}`}>
              <span className="text-surface-600 select-none">
                {log.created_at ? new Date(log.created_at).toLocaleTimeString('tr-TR') : ''}{' '}
              </span>
              <span className="whitespace-pre-wrap break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
          }}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-claude shadow-lg hover:bg-claude-light transition-colors"
        >
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
