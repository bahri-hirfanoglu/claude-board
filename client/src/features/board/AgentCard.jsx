import { useState, useEffect, useRef } from 'react';
import {
  Square,
  Cpu,
  Clock,
  Zap,
  Coins,
  Eye,
  FileText,
  Pencil,
  Terminal,
  Search,
  FolderOpen,
  Globe,
  Layers,
  Hash,
} from 'lucide-react';
import Avatar from 'boring-avatars';
import { formatTokens } from '../../lib/formatters';
import { TYPE_COLORS, MODEL_COSTS, AVATAR_COLORS } from '../../lib/constants';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';

const TOOL_ICONS = {
  Read: Eye,
  Write: FileText,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderOpen,
  WebFetch: Globe,
  WebSearch: Globe,
  Agent: Zap,
  Task: Layers,
};

const TOOL_COLORS = {
  Read: 'text-sky-400',
  Write: 'text-emerald-400',
  Edit: 'text-yellow-400',
  Bash: 'text-amber-400',
  Grep: 'text-cyan-400',
  Glob: 'text-teal-400',
  WebFetch: 'text-blue-400',
  WebSearch: 'text-blue-400',
  Agent: 'text-violet-400',
};

function formatElapsed(ms) {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function estimateCost(model, inputTokens, outputTokens) {
  const normalizedModel = (model || '').toLowerCase();
  let costs = MODEL_COSTS.sonnet;
  if (normalizedModel.includes('haiku')) costs = MODEL_COSTS.haiku;
  else if (normalizedModel.includes('opus')) costs = MODEL_COSTS.opus;
  return (inputTokens / 1e6) * costs.input + (outputTokens / 1e6) * costs.output;
}

function shortenPath(path) {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  if (parts.length <= 2) return parts.join('/');
  return '.../' + parts.slice(-2).join('/');
}

export default function AgentCard({ task, onStop, onViewLogs }) {
  const model = task.model_used || task.model || 'sonnet';
  const typeColor = TYPE_COLORS[task.task_type] || TYPE_COLORS.feature;
  const isTesting = task.status === 'testing' && task.is_running;
  const agentName = task.agent_name || `Agent ${task.id}`;

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!task.started_at) return;
    const start = new Date(task.started_at).getTime();
    const update = () => setElapsed(Date.now() - start);
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [task.started_at]);

  // Real-time token/cost from task:usage events
  const [liveUsage, setLiveUsage] = useState({
    input: task.input_tokens || 0,
    output: task.output_tokens || 0,
    cost: task.total_cost || 0,
  });
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:usage', (payload) => {
      if (payload.taskId !== task.id) return;
      setLiveUsage({
        input: payload.input_tokens || 0,
        output: payload.output_tokens || 0,
        cost: payload.total_cost || estimateCost(model, payload.input_tokens || 0, payload.output_tokens || 0),
      });
    });
  }, [task.id, model]);

  // Last tool call from task:log events
  const [lastTool, setLastTool] = useState(null);
  const [lastText, setLastText] = useState(null);
  const [turns, setTurns] = useState(task.num_turns || 0);
  const turnRef = useRef(task.num_turns || 0);

  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:log', (payload) => {
      if (payload.taskId !== task.id) return;
      if (payload.logType === 'tool') {
        const meta = payload.meta ? (typeof payload.meta === 'string' ? JSON.parse(payload.meta) : payload.meta) : {};
        const toolName = meta.toolName || meta.tool || payload.message?.match(/^(\w+)/)?.[1] || 'Tool';
        const filePath = meta.file || meta.filePath || meta.path || meta.command || '';
        setLastTool({ name: toolName, path: filePath });
      } else if (payload.logType === 'claude' && payload.message) {
        setLastText(payload.message.slice(0, 80));
      } else if (payload.logType === 'system' && payload.message?.includes('Turn')) {
        turnRef.current += 1;
        setTurns(turnRef.current);
      }
    });
  }, [task.id]);

  const totalTokens = liveUsage.input + liveUsage.output;
  const ToolIcon = lastTool ? TOOL_ICONS[lastTool.name] || Zap : null;
  const toolColor = lastTool ? TOOL_COLORS[lastTool.name] || 'text-surface-400' : '';

  // Token progress visual (rough estimate based on typical task ~200K tokens)
  const tokenProgress = Math.min(100, (totalTokens / 200000) * 100);

  return (
    <div
      className={`bg-surface-800/60 border rounded-lg p-3 transition-colors cursor-pointer group ${
        isTesting ? 'border-purple-500/40 hover:border-purple-400/50' : 'border-surface-700/40 hover:border-claude/30'
      }`}
      onClick={() => onViewLogs?.(task)}
    >
      {/* Agent identity */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="rounded-lg overflow-hidden ring-1 ring-surface-600 flex-shrink-0">
            <Avatar size={28} name={agentName} variant="beam" colors={AVATAR_COLORS} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-bold text-claude">{agentName}</span>
              {isTesting && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                  Testing
                </span>
              )}
            </div>
            <span className="text-[10px] text-surface-400 truncate block">{task.title}</span>
            {task.task_key && <span className="text-[9px] text-surface-600 font-mono">{task.task_key}</span>}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop?.(task);
          }}
          className="p-1 rounded hover:bg-red-500/20 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="Stop"
        >
          <Square size={12} />
        </button>
      </div>

      {/* Token progress bar */}
      <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isTesting ? 'bg-gradient-to-r from-purple-500 to-purple-300' : 'bg-gradient-to-r from-claude to-amber-400'
          }`}
          style={{ width: `${Math.max(tokenProgress, 5)}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
        <span className="flex items-center gap-1 text-surface-500">
          <Cpu size={9} />
          <span className="text-surface-300">{model}</span>
        </span>
        <span className="flex items-center gap-1 text-surface-500">
          <Clock size={9} />
          <span className="text-surface-300">{formatElapsed(elapsed)}</span>
        </span>
        <span className="flex items-center gap-1 text-surface-500">
          <Zap size={9} />
          <span className="text-surface-300">
            {formatTokens(liveUsage.input)}
            <span className="text-surface-600 mx-0.5">/</span>
            {formatTokens(liveUsage.output)}
          </span>
        </span>
        <span className="flex items-center gap-1 text-surface-500">
          <Coins size={9} />
          <span className="text-emerald-400">${liveUsage.cost.toFixed(3)}</span>
        </span>
        {turns > 0 && (
          <span className="flex items-center gap-1 text-surface-500">
            <Hash size={9} />
            <span className="text-surface-300">{turns} turns</span>
          </span>
        )}
      </div>

      {/* Agent activity — speech bubble style */}
      {lastTool && (
        <div className="relative mt-1.5">
          <div className="absolute -top-1 left-4 w-2 h-2 bg-surface-900/60 border-l border-t border-surface-700/30 rotate-45" />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-900/60 border border-surface-700/30">
            {ToolIcon && <ToolIcon size={10} className={toolColor} />}
            <span className={`text-[10px] font-medium ${toolColor}`}>{lastTool.name}</span>
            {lastTool.path && (
              <span className="text-[9px] text-surface-600 truncate flex-1">{shortenPath(lastTool.path)}</span>
            )}
          </div>
        </div>
      )}
      {lastText && !lastTool && (
        <div className="relative mt-1.5">
          <div className="absolute -top-1 left-4 w-2 h-2 bg-surface-900/60 border-l border-t border-surface-700/30 rotate-45" />
          <div className="px-2.5 py-1.5 rounded-lg bg-surface-900/60 border border-surface-700/30">
            <span className="text-[9px] text-surface-400 italic">{lastText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
