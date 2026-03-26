import { useMemo, useRef, useState, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';

const STATUS_COLORS = {
  backlog: { fill: '#374151', stroke: '#6B7280', text: '#D1D5DB' },
  in_progress: { fill: '#78350F', stroke: '#F59E0B', text: '#FDE68A' },
  testing: { fill: '#3B0764', stroke: '#A855F7', text: '#E9D5FF' },
  done: { fill: '#064E3B', stroke: '#10B981', text: '#A7F3D0' },
  failed: { fill: '#450A0A', stroke: '#EF4444', text: '#FCA5A5' },
};

const NODE_W = 160;
const NODE_H = 48;
const GAP_X = 200;
const GAP_Y_DEFAULT = 70;
const GAP_Y_DENSE = 54;
const OFFSET_X = 40;
const OFFSET_Y = 40;

function autoLayout(tasks, edges, waves) {
  const positions = {};
  const waveMap = {};

  // Build edge lookup to find connected tasks
  const edgeSet = new Set();
  const taskParents = {};
  (edges || []).forEach(e => {
    edgeSet.add(e.from);
    edgeSet.add(e.to);
    if (!taskParents[e.to]) taskParents[e.to] = [];
    taskParents[e.to].push(e.from);
  });

  if (waves.length > 0) {
    waves.forEach((wave, wi) => {
      wave.forEach((t, ti) => {
        waveMap[t.id] = { wave: wi, index: ti };
      });
    });
  }

  // For unassigned tasks (done/testing/orphans), place them in the correct wave
  // based on their dependency relationships, not in a separate column
  const assignedIds = new Set(Object.keys(waveMap).map(Number));
  const unassigned = tasks.filter(t => !assignedIds.has(t.id));

  // Find max wave of parents for each unassigned task to place it after its dependencies
  const maxWaveFromMap = waves.length > 0 ? waves.length - 1 : 0;
  unassigned.forEach(t => {
    const parents = taskParents[t.id] || [];
    let bestWave = 0;
    parents.forEach(pid => {
      if (waveMap[pid]) bestWave = Math.max(bestWave, waveMap[pid].wave + 1);
    });
    // If task has no parents in waveMap, place after last wave
    if (parents.length === 0 && maxWaveFromMap > 0) bestWave = maxWaveFromMap + 1;
    waveMap[t.id] = { wave: bestWave, index: 0 }; // index will be recalculated below
  });

  const waveGroups = {};
  Object.entries(waveMap).forEach(([id, { wave }]) => {
    if (!waveGroups[wave]) waveGroups[wave] = [];
    waveGroups[wave].push({ id: Number(id), index: waveGroups[wave].length });
  });

  const allMapped = new Set(Object.keys(waveMap).map(Number));
  const orphans = tasks.filter(t => !allMapped.has(t.id));
  if (orphans.length > 0) {
    const maxWave = Math.max(...Object.keys(waveGroups).map(Number), -1);
    waveGroups[maxWave + 1] = orphans.map((t, i) => ({ id: t.id, index: i }));
  }

  const maxPerWave = Math.max(...Object.values(waveGroups).map(g => g.length), 1);
  const GAP_Y = maxPerWave > 8 ? GAP_Y_DENSE : GAP_Y_DEFAULT;

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

  return positions;
}

function computeDimensions(positions) {
  const allPos = Object.values(positions);
  if (allPos.length === 0) return { width: 400, height: 200 };
  const maxX = allPos.reduce((m, p) => Math.max(m, p.x + (p.w || NODE_W)), 0) + OFFSET_X;
  const maxY = allPos.reduce((m, p) => Math.max(m, p.y + (p.h || NODE_H)), 0) + OFFSET_Y;
  return { width: Math.max(maxX, 400), height: Math.max(maxY, 200) };
}

export default function DependencyGraph({
  tasks, edges, waves,
  onTaskClick, onAddDependency, onStartTask,
  savedPositions, onPositionsChange,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [edgeDrag, setEdgeDrag] = useState(null);   // edge creation: { fromId, cursorX, cursorY, targetId }
  const [nodeDrag, setNodeDrag] = useState(null);    // node move: { id, startX, startY, origX, origY }
  const [localPositions, setLocalPositions] = useState(null);
  const justDraggedRef = useRef(false);               // prevents click after drag

  // Compute auto positions
  const autoPositions = useMemo(
    () => autoLayout(tasks, edges, waves),
    [tasks, edges, waves]
  );

  // Merge: savedPositions > localPositions > autoPositions
  const positions = useMemo(() => {
    const base = { ...autoPositions };
    const saved = savedPositions || {};
    for (const task of tasks) {
      const id = task.id;
      if (saved[id]) {
        base[id] = { ...base[id], x: saved[id].x, y: saved[id].y };
      } else if (localPositions && localPositions[id]) {
        base[id] = { ...base[id], x: localPositions[id].x, y: localPositions[id].y };
      }
      // Ensure w/h always set
      if (base[id]) {
        base[id].w = NODE_W;
        base[id].h = NODE_H;
      }
    }
    return base;
  }, [autoPositions, savedPositions, localPositions, tasks]);

  const { width, height } = useMemo(() => computeDimensions(positions), [positions]);

  // Convert browser mouse coords to SVG coords
  const toSvgCoords = useCallback((e) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + container.scrollLeft,
      y: e.clientY - rect.top + container.scrollTop,
    };
  }, []);

  // Hit test
  const hitTest = useCallback((sx, sy) => {
    for (const task of tasks) {
      const pos = positions[task.id];
      if (!pos) continue;
      if (sx >= pos.x && sx <= pos.x + pos.w && sy >= pos.y && sy <= pos.y + pos.h) {
        return task.id;
      }
    }
    return null;
  }, [tasks, positions]);

  // ── Node mouse down: decide edge-creation vs node-move ──
  const handleNodeMouseDown = useCallback((e, taskId) => {
    e.stopPropagation();
    const { x, y } = toSvgCoords(e);

    if (onAddDependency && e.shiftKey) {
      // Shift+drag = create edge
      setEdgeDrag({ fromId: taskId, cursorX: x, cursorY: y, targetId: null });
    } else if (onPositionsChange) {
      // Regular drag = move node
      const pos = positions[taskId];
      if (pos) {
        setNodeDrag({ id: taskId, startX: x, startY: y, origX: pos.x, origY: pos.y });
      }
    } else if (onAddDependency) {
      // No position persistence (e.g. planning preview) -> edge creation by default
      setEdgeDrag({ fromId: taskId, cursorX: x, cursorY: y, targetId: null });
    }
  }, [onAddDependency, onPositionsChange, toSvgCoords, positions]);

  const handleSvgMouseMove = useCallback((e) => {
    if (edgeDrag) {
      const { x, y } = toSvgCoords(e);
      const targetId = hitTest(x, y);
      setEdgeDrag(prev => ({ ...prev, cursorX: x, cursorY: y, targetId: targetId !== prev.fromId ? targetId : null }));
    } else if (nodeDrag) {
      const { x, y } = toSvgCoords(e);
      const dx = x - nodeDrag.startX;
      const dy = y - nodeDrag.startY;
      const newX = Math.max(0, nodeDrag.origX + dx);
      const newY = Math.max(0, nodeDrag.origY + dy);
      setLocalPositions(prev => ({
        ...(prev || {}),
        [nodeDrag.id]: { x: newX, y: newY },
      }));
    }
  }, [edgeDrag, nodeDrag, toSvgCoords, hitTest]);

  const handleSvgMouseUp = useCallback(() => {
    if (edgeDrag) {
      if (edgeDrag.targetId && edgeDrag.targetId !== edgeDrag.fromId) {
        onAddDependency?.(edgeDrag.targetId, edgeDrag.fromId);
      }
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 50);
      setEdgeDrag(null);
    } else if (nodeDrag) {
      // Persist moved position
      const pos = positions[nodeDrag.id];
      if (pos && onPositionsChange) {
        const updated = { ...(savedPositions || {}) };
        for (const task of tasks) {
          const p = positions[task.id];
          if (p) updated[task.id] = { x: p.x, y: p.y };
        }
        // Apply the local drag position
        if (localPositions && localPositions[nodeDrag.id]) {
          updated[nodeDrag.id] = { x: localPositions[nodeDrag.id].x, y: localPositions[nodeDrag.id].y };
        }
        onPositionsChange(updated);
      }
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 50);
      setNodeDrag(null);
    }
  }, [edgeDrag, nodeDrag, onAddDependency, onPositionsChange, positions, savedPositions, localPositions, tasks]);

  const handleAutoLayout = useCallback(() => {
    setLocalPositions(null);
    if (onPositionsChange) {
      // Save auto positions
      const fresh = autoLayout(tasks, edges, waves);
      const save = {};
      for (const [id, pos] of Object.entries(fresh)) {
        save[id] = { x: pos.x, y: pos.y };
      }
      onPositionsChange(save);
    }
  }, [tasks, edges, waves, onPositionsChange]);

  // Cancel on mouse leave
  const handleMouseLeave = useCallback(() => {
    if (edgeDrag) setEdgeDrag(null);
    if (nodeDrag) {
      // Revert local drag
      setLocalPositions(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next[nodeDrag.id];
        return Object.keys(next).length ? next : null;
      });
      setNodeDrag(null);
    }
  }, [edgeDrag, nodeDrag]);

  const isDragging = !!(edgeDrag || nodeDrag);

  // Draw edge paths with conditional styling
  const edgePaths = useMemo(() => {
    const EDGE_STYLES = {
      always:     { color: '#4B5563', dash: 'none' },
      on_success: { color: '#10B981', dash: '6,3' },
      on_failure: { color: '#EF4444', dash: '6,3' },
    };

    return edges.map((edge, i) => {
      const { from, to } = edge;
      const conditionType = edge.conditionType || 'always';
      const src = positions[from];
      const dst = positions[to];
      if (!src || !dst) return null;

      const x1 = src.x + src.w;
      const y1 = src.y + src.h / 2;
      const x2 = dst.x;
      const y2 = dst.y + dst.h / 2;
      const mx = (x1 + x2) / 2;

      const isHighlighted = hoveredId === from || hoveredId === to;
      const style = EDGE_STYLES[conditionType] || EDGE_STYLES.always;

      return (
        <g key={i}>
          <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={isHighlighted ? '#D97706' : style.color}
            strokeWidth={isHighlighted ? 2 : 1.5}
            strokeDasharray={conditionType === 'always' ? 'none' : style.dash}
            markerEnd={`url(#arrowhead${conditionType !== 'always' ? '-' + conditionType : ''})`}
            opacity={hoveredId && !isHighlighted ? 0.2 : 0.8}
          />
          {/* Condition label on edge midpoint */}
          {conditionType !== 'always' && (
            <text
              x={mx} y={(y1 + y2) / 2 - 6}
              textAnchor="middle" fill={style.color}
              fontSize={8} fontWeight={600} opacity={0.8}
            >
              {conditionType === 'on_success' ? 'SUCCESS' : 'FAILURE'}
            </text>
          )}
        </g>
      );
    });
  }, [edges, positions, hoveredId]);

  // Temporary edge drag line
  const dragEdgePath = useMemo(() => {
    if (!edgeDrag) return null;
    const src = positions[edgeDrag.fromId];
    if (!src) return null;
    const x1 = src.x + src.w;
    const y1 = src.y + src.h / 2;
    if (edgeDrag.targetId) {
      const dst = positions[edgeDrag.targetId];
      if (dst) {
        const tx = dst.x;
        const ty = dst.y + dst.h / 2;
        const mx = (x1 + tx) / 2;
        return (
          <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${ty}, ${tx} ${ty}`}
            fill="none" stroke="#A78BFA" strokeWidth={2} strokeDasharray="6,3"
            markerEnd="url(#arrowhead-drag)"
          />
        );
      }
    }
    const x2 = edgeDrag.cursorX;
    const y2 = edgeDrag.cursorY;
    const mx = (x1 + x2) / 2;
    return (
      <path
        d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
        fill="none" stroke="#6B7280" strokeWidth={1.5} strokeDasharray="6,3"
        opacity={0.6}
      />
    );
  }, [edgeDrag, positions]);

  return (
    <div ref={containerRef} className="overflow-auto rounded-lg border border-surface-700/30 bg-surface-900/50 relative">
      {/* Toolbar */}
      {onPositionsChange && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-surface-800/80 hover:bg-surface-700 text-surface-400 hover:text-surface-200 border border-surface-700/50 backdrop-blur-sm transition-colors"
            title="Auto-layout"
          >
            <LayoutGrid size={11} />
            Auto
          </button>
          {onAddDependency && (
            <span className="text-[9px] text-surface-600 px-1.5">Shift+drag = edge</span>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="min-w-full"
        style={{ cursor: nodeDrag ? 'grabbing' : edgeDrag ? 'crosshair' : undefined }}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
          </marker>
          <marker id="arrowhead-drag" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#A78BFA" />
          </marker>
          <marker id="arrowhead-on_success" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
          </marker>
          <marker id="arrowhead-on_failure" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#EF4444" />
          </marker>
        </defs>

        {/* Edges */}
        {edgePaths}

        {/* Drag edge */}
        {dragEdgePath}

        {/* Nodes */}
        {tasks.map(task => {
          const pos = positions[task.id];
          if (!pos) return null;
          const colors = STATUS_COLORS[task.status] || STATUS_COLORS.backlog;
          const isRunning = task.is_running || task.status === 'in_progress';
          const isTesting = task.is_running && task.status === 'testing';
          const isHovered = hoveredId === task.id;
          const isEdgeDragTarget = edgeDrag?.targetId === task.id;
          const isEdgeDragSource = edgeDrag?.fromId === task.id;
          const isMoving = nodeDrag?.id === task.id;

          return (
            <g
              key={task.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ cursor: onPositionsChange ? (isMoving ? 'grabbing' : 'grab') : 'pointer' }}
              onMouseEnter={() => { if (!isDragging) setHoveredId(task.id); }}
              onMouseLeave={() => { if (!isDragging) setHoveredId(null); }}
              onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
              onClick={() => { if (!isDragging && !justDraggedRef.current) onTaskClick?.(task); }}
              opacity={hoveredId && !isHovered && !isDragging ? 0.5 : 1}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={isEdgeDragTarget ? '#1E1B4B' : isMoving ? '#1C1917' : colors.fill}
                stroke={isEdgeDragTarget ? '#A78BFA' : isEdgeDragSource ? '#7C3AED' : isMoving ? '#D97706' : isHovered ? '#D97706' : colors.stroke}
                strokeWidth={isEdgeDragTarget || isEdgeDragSource || isMoving ? 2.5 : isHovered ? 2 : 1}
              />
              {isRunning && (
                <rect
                  y={NODE_H - 3}
                  width={NODE_W * 0.6}
                  height={3}
                  rx={1.5}
                  fill={isTesting ? '#A855F7' : '#D97706'}
                  opacity={0.8}
                >
                  <animate attributeName="width" values={`0;${NODE_W};0`} dur="2s" repeatCount="indefinite" />
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
              {/* Start button for backlog tasks */}
              {onStartTask && task.status === 'backlog' && isHovered && !isDragging && (
                <g
                  transform={`translate(${NODE_W - 28}, 12)`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onStartTask(task); }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect width={20} height={20} rx={4} fill="#065F46" stroke="#10B981" strokeWidth={1} />
                  <polygon points="7,5 7,15 16,10" fill="#10B981" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
