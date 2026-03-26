import { useMemo, useState, useEffect, useRef } from 'react';
import { formatTokens, formatMs } from '../../lib/formatters';
import { useTranslation } from '../../i18n/I18nProvider';

const STATUS_COLORS = {
  backlog: { bar: '#4B5563', barLight: '#6B7280', text: '#D1D5DB' },
  in_progress: { bar: '#D97706', barLight: '#F59E0B', text: '#FDE68A' },
  testing: { bar: '#DA7756', barLight: '#e5936f', text: '#FECACA' },
  done: { bar: '#059669', barLight: '#10B981', text: '#A7F3D0' },
  failed: { bar: '#DC2626', barLight: '#EF4444', text: '#FCA5A5' },
};

const TYPE_DOTS = {
  feature: '#3b82f6',
  bugfix: '#ef4444',
  refactor: '#a855f7',
  docs: '#22c55e',
  test: '#eab308',
  chore: '#6b7280',
};

const ROW_H = 36;
const LABEL_W = 200;
const HEADER_H = 32;
const WAVE_GAP = 8;
const MIN_BAR_W = 6;

function computeTimeScale(tasks, containerWidth) {
  const chartW = containerWidth - LABEL_W;
  if (chartW <= 0) return null;

  const withTime = tasks.filter((t) => t.started_at);
  if (withTime.length === 0) return null;

  const starts = withTime.map((t) => new Date(t.started_at).getTime());
  const ends = withTime.map((t) => {
    if (t.completed_at) return new Date(t.completed_at).getTime();
    if (t.work_duration_ms && t.started_at) return new Date(t.started_at).getTime() + t.work_duration_ms;
    return Date.now();
  });

  let minT = Math.min(...starts);
  let maxT = Math.max(...ends, Date.now());
  const range = maxT - minT;
  if (range < 60000) {
    // min 1 minute range
    minT -= 30000;
    maxT += 30000;
  }
  const pad = (maxT - minT) * 0.05;
  minT -= pad;
  maxT += pad;

  const totalMs = maxT - minT;
  const pxPerMs = chartW / totalMs;

  // Compute tick interval
  const targetTicks = Math.max(4, Math.min(12, Math.floor(chartW / 80)));
  const msPerTick = totalMs / targetTicks;
  const intervals = [60000, 300000, 600000, 1800000, 3600000, 7200000, 14400000, 28800000, 86400000];
  const interval = intervals.find((i) => i >= msPerTick) || intervals[intervals.length - 1];

  const ticks = [];
  let t = Math.ceil(minT / interval) * interval;
  while (t <= maxT) {
    ticks.push(t);
    t += interval;
  }

  return { minT, maxT, totalMs, pxPerMs, chartW, ticks, interval };
}

function formatTick(ts, intervalMs) {
  const d = new Date(ts);
  if (intervalMs >= 86400000) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export default function TimelineView({ tasks, waves, edges, onTaskClick }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredId, setHoveredId] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Live clock for running tasks
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'in_progress' || t.is_running);
    if (!hasRunning) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [tasks]);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Build ordered rows grouped by waves
  const { rows, waveLabels } = useMemo(() => {
    const rows = [];
    const waveLabels = [];
    let y = 0;

    if (waves && waves.length > 0) {
      waves.forEach((wave, wi) => {
        waveLabels.push({ label: `Wave ${wi}`, y });
        wave.forEach((task) => {
          if (task) rows.push({ task, y });
          y += ROW_H;
        });
        y += WAVE_GAP;
      });
    } else {
      // Fallback: all tasks sorted by started_at
      const sorted = [...tasks].sort((a, b) => {
        const sa = a.started_at ? new Date(a.started_at).getTime() : Infinity;
        const sb = b.started_at ? new Date(b.started_at).getTime() : Infinity;
        return sa - sb;
      });
      sorted.forEach((task) => {
        rows.push({ task, y });
        y += ROW_H;
      });
    }

    return { rows, waveLabels };
  }, [tasks, waves]);

  const scale = useMemo(() => computeTimeScale(tasks, containerWidth), [tasks, containerWidth, now]);

  const totalH = rows.length > 0 ? rows[rows.length - 1].y + ROW_H + 8 : 100;

  if (!scale || rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-surface-500 text-sm">{t('timeline.noData')}</div>
    );
  }

  const nowX = LABEL_W + (now - scale.minT) * scale.pxPerMs;

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-surface-900/50 rounded-lg border border-surface-700/30">
      <svg width={containerWidth} height={totalH + HEADER_H} className="select-none">
        {/* Header time axis */}
        <g transform={`translate(0, 0)`}>
          <rect x={0} y={0} width={containerWidth} height={HEADER_H} fill="#1a1714" />
          <line x1={LABEL_W} y1={HEADER_H} x2={containerWidth} y2={HEADER_H} stroke="#3a3530" strokeWidth={1} />
          {scale.ticks.map((tick, i) => {
            const x = LABEL_W + (tick - scale.minT) * scale.pxPerMs;
            return (
              <g key={i}>
                <line x1={x} y1={HEADER_H - 6} x2={x} y2={HEADER_H} stroke="#5a5550" strokeWidth={1} />
                <text x={x} y={HEADER_H - 10} textAnchor="middle" fill="#918678" fontSize={10}>
                  {formatTick(tick, scale.interval)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Grid lines */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {scale.ticks.map((tick, i) => {
            const x = LABEL_W + (tick - scale.minT) * scale.pxPerMs;
            return (
              <line key={i} x1={x} y1={0} x2={x} y2={totalH} stroke="#2a2520" strokeWidth={1} strokeDasharray="4,4" />
            );
          })}
        </g>

        {/* Wave labels */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {waveLabels.map((wl, i) => (
            <text key={i} x={8} y={wl.y + 12} fill="#6B7280" fontSize={10} fontWeight={600}>
              {wl.label}
            </text>
          ))}
        </g>

        {/* Row backgrounds */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {rows.map(({ task, y }, i) => (
            <rect
              key={task.id}
              x={0}
              y={y}
              width={containerWidth}
              height={ROW_H}
              fill={hoveredId === task.id ? '#2a2520' : i % 2 === 0 ? 'transparent' : '#1e1b18'}
              opacity={0.5}
            />
          ))}
        </g>

        {/* Task labels */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {rows.map(({ task, y }) => {
            const dotColor = TYPE_DOTS[task.task_type] || '#6b7280';
            return (
              <g
                key={task.id}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onTaskClick?.(task)}
                className="cursor-pointer"
              >
                <circle cx={16} cy={y + ROW_H / 2} r={4} fill={dotColor} />
                {task.task_key && (
                  <text x={26} y={y + ROW_H / 2 - 4} fill="#6B7280" fontSize={9} fontFamily="monospace">
                    {task.task_key}
                  </text>
                )}
                <text x={26} y={y + ROW_H / 2 + 8} fill="#D1D5DB" fontSize={11} fontWeight={500}>
                  {task.title?.length > 22 ? task.title.slice(0, 22) + '...' : task.title}
                </text>
              </g>
            );
          })}
        </g>

        {/* Separator line */}
        <line x1={LABEL_W} y1={HEADER_H} x2={LABEL_W} y2={totalH + HEADER_H} stroke="#3a3530" strokeWidth={1} />

        {/* Task bars */}
        <g transform={`translate(0, ${HEADER_H})`}>
          {rows.map(({ task, y }) => {
            if (!task.started_at) {
              // Backlog: small dot
              return <circle key={task.id} cx={LABEL_W + 12} cy={y + ROW_H / 2} r={3} fill="#4B5563" opacity={0.6} />;
            }

            const startMs = new Date(task.started_at).getTime();
            const isRunning = task.status === 'in_progress' || task.is_running;
            const endMs = task.completed_at
              ? new Date(task.completed_at).getTime()
              : isRunning
                ? now
                : task.work_duration_ms
                  ? startMs + task.work_duration_ms
                  : startMs + 60000;

            const x1 = LABEL_W + Math.max(0, (startMs - scale.minT) * scale.pxPerMs);
            const x2 = LABEL_W + Math.max(0, (endMs - scale.minT) * scale.pxPerMs);
            const barW = Math.max(MIN_BAR_W, x2 - x1);
            const barY = y + 8;
            const barH = ROW_H - 16;
            const colors = STATUS_COLORS[task.status] || STATUS_COLORS.backlog;
            const isHovered = hoveredId === task.id;

            return (
              <g
                key={task.id}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onTaskClick?.(task)}
                className="cursor-pointer"
              >
                {/* Bar shadow */}
                <rect x={x1} y={barY + 1} width={barW} height={barH} rx={4} fill="black" opacity={0.2} />
                {/* Main bar */}
                <rect
                  x={x1}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={colors.bar}
                  opacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? colors.barLight : 'none'}
                  strokeWidth={1.5}
                />
                {/* Running pulse overlay */}
                {isRunning && (
                  <rect x={x1} y={barY} width={barW} height={barH} rx={4} fill={colors.barLight} opacity={0.3}>
                    <animate attributeName="opacity" values="0.1;0.4;0.1" dur="2s" repeatCount="indefinite" />
                  </rect>
                )}
                {/* Bar label */}
                {barW > 50 && (
                  <text x={x1 + 6} y={barY + barH / 2 + 4} fill={colors.text} fontSize={10} fontWeight={500}>
                    {task.work_duration_ms ? formatMs(task.work_duration_ms) : isRunning ? formatMs(now - startMs) : ''}
                  </text>
                )}
                {/* Token/cost on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={x1}
                      y={barY - 24}
                      width={160}
                      height={20}
                      rx={4}
                      fill="#1a1714"
                      stroke="#3a3530"
                      strokeWidth={1}
                    />
                    <text x={x1 + 6} y={barY - 10} fill="#D1D5DB" fontSize={10}>
                      {[
                        formatTokens((task.input_tokens || 0) + (task.output_tokens || 0)) + ' tokens',
                        task.total_cost ? `$${task.total_cost.toFixed(3)}` : '',
                        task.model_used || task.model || '',
                      ]
                        .filter(Boolean)
                        .join(' | ')}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Now line */}
        <g>
          <line
            x1={nowX}
            y1={HEADER_H}
            x2={nowX}
            y2={totalH + HEADER_H}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4,3"
            opacity={0.7}
          />
          <text x={nowX + 4} y={HEADER_H + 12} fill="#ef4444" fontSize={9} fontWeight={600}>
            NOW
          </text>
        </g>

        {/* Dependency edges with conditional coloring */}
        {edges && edges.length > 0 && (
          <g transform={`translate(0, ${HEADER_H})`} opacity={0.4}>
            {edges.map((edge, i) => {
              const fromRow = rows.find((r) => r.task.id === edge.from);
              const toRow = rows.find((r) => r.task.id === edge.to);
              if (!fromRow || !toRow) return null;
              if (!fromRow.task.started_at) return null;

              const conditionType = edge.conditionType || 'always';
              const edgeColor =
                conditionType === 'on_success' ? '#10B981' : conditionType === 'on_failure' ? '#EF4444' : '#6B7280';

              const fromEndMs = fromRow.task.completed_at
                ? new Date(fromRow.task.completed_at).getTime()
                : fromRow.task.started_at
                  ? new Date(fromRow.task.started_at).getTime() + (fromRow.task.work_duration_ms || 60000)
                  : scale.minT;
              const fromX = LABEL_W + (fromEndMs - scale.minT) * scale.pxPerMs;
              const fromY = fromRow.y + ROW_H / 2;

              const toStartMs = toRow.task.started_at ? new Date(toRow.task.started_at).getTime() : fromEndMs;
              const toX = LABEL_W + (toStartMs - scale.minT) * scale.pxPerMs;
              const toY = toRow.y + ROW_H / 2;

              const midX = (fromX + toX) / 2;
              return (
                <path
                  key={i}
                  d={`M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth={1}
                  strokeDasharray={conditionType === 'always' ? '3,3' : '6,3'}
                  markerEnd={`url(#timeline-arrow-${conditionType})`}
                />
              );
            })}
            <defs>
              <marker
                id="timeline-arrow-always"
                viewBox="0 0 6 6"
                refX={5}
                refY={3}
                markerWidth={6}
                markerHeight={6}
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#6B7280" />
              </marker>
              <marker
                id="timeline-arrow-on_success"
                viewBox="0 0 6 6"
                refX={5}
                refY={3}
                markerWidth={6}
                markerHeight={6}
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#10B981" />
              </marker>
              <marker
                id="timeline-arrow-on_failure"
                viewBox="0 0 6 6"
                refX={5}
                refY={3}
                markerWidth={6}
                markerHeight={6}
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#EF4444" />
              </marker>
            </defs>
          </g>
        )}
      </svg>
    </div>
  );
}
