import { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Wrench, FileText, AlertCircle, Cpu, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { IS_TAURI } from '../../lib/tauriEvents';

const EVENT_COLORS = {
  tool_call: { bg: 'bg-blue-500', dot: 'bg-blue-400', text: 'text-blue-300', icon: Wrench },
  tool_result: { bg: 'bg-emerald-500', dot: 'bg-emerald-400', text: 'text-emerald-300', icon: FileText },
  usage_final: { bg: 'bg-amber-500', dot: 'bg-amber-400', text: 'text-amber-300', icon: Cpu },
  system: { bg: 'bg-slate-500', dot: 'bg-slate-400', text: 'text-slate-300', icon: Clock },
  rate_limit: { bg: 'bg-red-500', dot: 'bg-red-400', text: 'text-red-300', icon: AlertCircle },
};

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export default function SessionReplay({ taskId }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);

  useEffect(() => {
    if (!IS_TAURI || !taskId) return;
    api
      .getTaskEvents(taskId)
      .then(setEvents)
      .catch(() => {});
  }, [taskId]);

  const timeRange = useMemo(() => {
    if (events.length === 0) return { start: 0, end: 1 };
    return {
      start: events[0].timestampMs,
      end: events[events.length - 1].timestampMs,
    };
  }, [events]);

  const duration = timeRange.end - timeRange.start;

  // Playback
  useEffect(() => {
    if (!playing || events.length === 0) return;
    const interval = setInterval(() => {
      setPlayIndex((prev) => {
        if (prev >= events.length - 1) {
          setPlaying(false);
          return prev;
        }
        setSelectedEvent(events[prev + 1]);
        return prev + 1;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [playing, events]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500 text-sm">
        <Clock size={14} className="mr-2" />
        No session events recorded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Timeline scrubber */}
      <div className="px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => {
              setPlaying(!playing);
              if (!playing && playIndex >= events.length - 1) setPlayIndex(0);
            }}
            className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="text-[11px] text-surface-500 font-mono">
            {formatTime((selectedEvent?.timestampMs || timeRange.start) - timeRange.start)}
            <span className="text-surface-600"> / {formatTime(duration)}</span>
          </span>
          <span className="text-[10px] text-surface-600 ml-auto">{events.length} events</span>
        </div>

        {/* Timeline bar */}
        <div
          className="relative h-6 bg-surface-800 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const targetTime = timeRange.start + ratio * duration;
            const closest = events.reduce((prev, curr) =>
              Math.abs(curr.timestampMs - targetTime) < Math.abs(prev.timestampMs - targetTime) ? curr : prev,
            );
            setSelectedEvent(closest);
            setPlayIndex(events.indexOf(closest));
          }}
        >
          {/* Event markers */}
          {events.map((evt, i) => {
            const pos = duration > 0 ? ((evt.timestampMs - timeRange.start) / duration) * 100 : 0;
            const colors = EVENT_COLORS[evt.eventType] || EVENT_COLORS.tool_call;
            return (
              <div
                key={i}
                className={`absolute top-1 w-1.5 h-4 rounded-full ${colors.dot} opacity-60 hover:opacity-100 transition-opacity`}
                style={{ left: `${pos}%` }}
                title={`${evt.eventType}: ${evt.data?.toolName || ''}`}
              />
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 h-full bg-claude"
            style={{
              left: `${
                duration > 0
                  ? (((selectedEvent?.timestampMs || timeRange.start) - timeRange.start) / duration) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Event list + detail */}
      <div className="flex-1 flex min-h-0">
        {/* Event list */}
        <div className="w-72 border-r border-surface-800 overflow-y-auto">
          {events.map((evt, i) => {
            const colors = EVENT_COLORS[evt.eventType] || EVENT_COLORS.tool_call;
            const Icon = colors.icon;
            const isSelected = selectedEvent?.id === evt.id;
            return (
              <button
                key={i}
                onClick={() => {
                  setSelectedEvent(evt);
                  setPlayIndex(i);
                }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[11px] border-b border-surface-800/50 transition-colors ${
                  isSelected ? 'bg-surface-800/80' : 'hover:bg-surface-800/40'
                }`}
              >
                <Icon size={12} className={colors.text} />
                <div className="flex-1 min-w-0">
                  <div className="text-surface-300 truncate">{evt.data?.toolName || evt.eventType}</div>
                  {evt.data?.input?.file && (
                    <div className="text-surface-500 truncate text-[10px]">{evt.data.input.file}</div>
                  )}
                </div>
                <span className="text-[10px] text-surface-600 flex-shrink-0 font-mono">
                  {formatTime(evt.timestampMs - timeRange.start)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Event detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedEvent ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-sm font-medium ${(EVENT_COLORS[selectedEvent.eventType] || EVENT_COLORS.tool_call).text}`}
                >
                  {selectedEvent.data?.toolName || selectedEvent.eventType}
                </span>
                <span className="text-[10px] text-surface-500 font-mono">
                  +{formatTime(selectedEvent.timestampMs - timeRange.start)}
                </span>
              </div>
              <pre className="text-[11px] text-surface-400 bg-surface-800/50 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {JSON.stringify(selectedEvent.data, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-surface-500 text-sm">
              Select an event to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
