import { useMemo, useRef, useState, useEffect, useCallback } from 'react';

const STATUS_COLORS = {
  backlog: { fill: '#374151', stroke: '#6B7280', text: '#D1D5DB' },
  in_progress: { fill: '#78350F', stroke: '#F59E0B', text: '#FDE68A' },
  testing: { fill: '#3B0764', stroke: '#A855F7', text: '#E9D5FF' },
  done: { fill: '#064E3B', stroke: '#10B981', text: '#A7F3D0' },
};

function layoutDAG(tasks, edges, waves) {
  const positions = {};
  const waveMap = {};

  // Assign wave index to each task
  if (waves.length > 0) {
    waves.forEach((wave, wi) => {
      wave.forEach((t, ti) => {
        waveMap[t.id] = { wave: wi, index: ti };
      });
    });
  }

  // Also include done/testing tasks not in waves
  const assignedIds = new Set(Object.keys(waveMap).map(Number));
  const unassigned = tasks.filter(t => !assignedIds.has(t.id));
  let doneIdx = 0;
  unassigned.forEach(t => {
    if (t.status === 'done' || t.status === 'testing') {
      waveMap[t.id] = { wave: -1, index: doneIdx++ };
    }
  });

  const NODE_W = 160;
  const NODE_H = 48;
  const GAP_X = 200;
  const OFFSET_X = 40;
  const OFFSET_Y = 40;

  // Group by wave
  const waveGroups = {};
  Object.entries(waveMap).forEach(([id, { wave, index }]) => {
    if (!waveGroups[wave]) waveGroups[wave] = [];
    waveGroups[wave].push({ id: Number(id), index });
  });

  // Also assign unassigned tasks (no wave, no status match) to a catch-all wave
  const allMapped = new Set(Object.keys(waveMap).map(Number));
  const orphans = tasks.filter(t => !allMapped.has(t.id));
  if (orphans.length > 0) {
    const maxWave = Math.max(...Object.keys(waveGroups).map(Number), -1);
    waveGroups[maxWave + 1] = orphans.map((t, i) => ({ id: t.id, index: i }));
  }

  // Adaptive vertical gap based on max column height
  const maxPerWave = Math.max(...Object.values(waveGroups).map(g => g.length), 1);
  const GAP_Y = maxPerWave > 8 ? 54 : 70;

  const sortedWaves = Object.keys(waveGroups).map(Number).sort((a, b) => a - b);
  sortedWaves.forEach((waveIdx, col) => {
    const group = waveGroups[waveIdx].sort((a, b) => a.index - b.index);
    group.forEach((item, row) => {
      positions[item.id] = {
        x: OFFSET_X + col * GAP_X,
        y: OFFSET_Y + row * GAP_Y,
        w: NODE_W,
        h: NODE_H,
      };
    });
  });

  // Calculate total dimensions
  const allPos = Object.values(positions);
  const maxX = allPos.reduce((m, p) => Math.max(m, p.x + p.w), 0) + OFFSET_X;
  const maxY = allPos.reduce((m, p) => Math.max(m, p.y + p.h), 0) + OFFSET_Y;

  return { positions, width: Math.max(maxX, 400), height: Math.max(maxY, 200) };
}

export default function DependencyGraph({ tasks, edges, waves, onTaskClick }) {
  const svgRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);

  const taskMap = useMemo(() => {
    const map = {};
    tasks.forEach(t => { map[t.id] = t; });
    return map;
  }, [tasks]);

  const { positions, width, height } = useMemo(
    () => layoutDAG(tasks, edges, waves),
    [tasks, edges, waves]
  );

  // Draw edge paths
  const edgePaths = useMemo(() => {
    return edges.map(({ from, to }, i) => {
      const src = positions[from];
      const dst = positions[to];
      if (!src || !dst) return null;

      const x1 = src.x + src.w;
      const y1 = src.y + src.h / 2;
      const x2 = dst.x;
      const y2 = dst.y + dst.h / 2;
      const mx = (x1 + x2) / 2;

      const isHighlighted = hoveredId === from || hoveredId === to;

      return (
        <path
          key={i}
          d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
          fill="none"
          stroke={isHighlighted ? '#D97706' : '#4B5563'}
          strokeWidth={isHighlighted ? 2 : 1.5}
          markerEnd="url(#arrowhead)"
          opacity={hoveredId && !isHighlighted ? 0.2 : 0.8}
        />
      );
    });
  }, [edges, positions, hoveredId]);

  return (
    <div className="overflow-auto rounded-lg border border-surface-700/30 bg-surface-900/50">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="min-w-full"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
          </marker>
        </defs>

        {/* Edges */}
        {edgePaths}

        {/* Nodes */}
        {tasks.map(task => {
          const pos = positions[task.id];
          if (!pos) return null;
          const colors = STATUS_COLORS[task.status] || STATUS_COLORS.backlog;
          const isRunning = task.status === 'in_progress' || task.is_running;
          const isHovered = hoveredId === task.id;

          return (
            <g
              key={task.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onTaskClick?.(task)}
              opacity={hoveredId && !isHovered ? 0.5 : 1}
            >
              <rect
                width={pos.w}
                height={pos.h}
                rx={8}
                fill={colors.fill}
                stroke={isHovered ? '#D97706' : colors.stroke}
                strokeWidth={isHovered ? 2 : 1}
              />
              {isRunning && (
                <rect
                  y={pos.h - 3}
                  width={pos.w * 0.6}
                  height={3}
                  rx={1.5}
                  fill="#D97706"
                  opacity={0.8}
                >
                  <animate attributeName="width" values={`0;${pos.w};0`} dur="2s" repeatCount="indefinite" />
                </rect>
              )}
              <text
                x={10}
                y={20}
                fill={colors.text}
                fontSize={12}
                fontWeight={500}
              >
                {task.title.length > 18 ? task.title.substring(0, 18) + '...' : task.title}
              </text>
              <text x={10} y={36} fill="#9CA3AF" fontSize={10}>
                {task.task_key || `#${task.id}`}
                {task.model && ` \u00B7 ${task.model}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
