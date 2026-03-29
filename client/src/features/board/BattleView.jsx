import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Swords, Trophy, Skull, Zap, Heart, Shield, Flame } from 'lucide-react';
import Avatar from 'boring-avatars';
import { AVATAR_COLORS } from '../../lib/constants';
import { formatTokens } from '../../lib/formatters';
import { IS_TAURI, tauriListen } from '../../lib/tauriEvents';
import { api } from '../../lib/api';

const ARENA_POSITIONS = [
  { x: 18, y: 30 },
  { x: 82, y: 30 },
  { x: 18, y: 72 },
  { x: 82, y: 72 },
  { x: 50, y: 18 },
  { x: 50, y: 84 },
];

const ATTACK_TYPES = [
  { name: 'fireball', emoji: '\uD83D\uDD25', trail: '#ef4444', glow: 'rgba(239,68,68,0.6)' },
  { name: 'lightning', emoji: '\u26A1', trail: '#facc15', glow: 'rgba(250,204,21,0.6)' },
  { name: 'plasma', emoji: '\uD83D\uDCAB', trail: '#a855f7', glow: 'rgba(168,85,247,0.6)' },
  { name: 'ice', emoji: '\u2744\uFE0F', trail: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },
  { name: 'poison', emoji: '\u2620\uFE0F', trail: '#22c55e', glow: 'rgba(34,197,94,0.6)' },
  { name: 'bomb', emoji: '\uD83D\uDCA3', trail: '#f97316', glow: 'rgba(249,115,22,0.6)' },
];

// ─── Fireball / projectile with emoji + trail particles ───
function Projectile({ fromX, fromY, toX, toY, size, attack, onDone }) {
  const ref = useRef(null);
  const [trails, setTrails] = useState([]);

  useEffect(() => {
    if (!ref.current) return;
    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 12 - Math.random() * 8;
    ref.current.animate(
      [
        { left: `${fromX}%`, top: `${fromY}%`, transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.5 },
        {
          left: `${midX}%`,
          top: `${midY}%`,
          transform: `translate(-50%,-50%) scale(${size > 10 ? 2.2 : 1.4})`,
          opacity: 1,
          offset: 0.4,
        },
        { left: `${toX}%`, top: `${toY}%`, transform: 'translate(-50%,-50%) scale(0.8)', opacity: 0.8 },
      ],
      { duration: 550, easing: 'ease-in', fill: 'forwards' },
    );

    // Spawn trail particles along the path
    let frame = 0;
    const trailInterval = setInterval(() => {
      frame++;
      const t = Math.min(frame / 12, 1);
      const cx = fromX + (toX - fromX) * t;
      const cy = fromY + (toY - fromY) * t - Math.sin(t * Math.PI) * 15;
      setTrails((prev) => [
        ...prev.slice(-8),
        { id: frame, x: cx + (Math.random() - 0.5) * 4, y: cy + (Math.random() - 0.5) * 4 },
      ]);
      if (t >= 1) clearInterval(trailInterval);
    }, 40);

    const timer = setTimeout(onDone, 600);
    return () => {
      clearTimeout(timer);
      clearInterval(trailInterval);
    };
  }, [fromX, fromY, toX, toY, size, onDone]);

  return (
    <>
      {/* Trail particles */}
      {trails.map((tr) => (
        <div
          key={tr.id}
          className="absolute pointer-events-none z-25 -translate-x-1/2 -translate-y-1/2 animate-[trail-fade_0.4s_ease-out_both]"
          style={{ left: `${tr.x}%`, top: `${tr.y}%` }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: attack.trail, boxShadow: `0 0 4px ${attack.trail}` }}
          />
        </div>
      ))}
      {/* Main projectile */}
      <div ref={ref} className="absolute pointer-events-none z-30" style={{ left: `${fromX}%`, top: `${fromY}%` }}>
        <span
          className="block"
          style={{ fontSize: size > 10 ? 28 : 20, filter: `drop-shadow(0 0 ${size}px ${attack.glow})`, lineHeight: 1 }}
        >
          {attack.emoji}
        </span>
      </div>
    </>
  );
}

// ─── Explosion at impact point ───
function Explosion({ x, y, attack, isCrit }) {
  const count = isCrit ? 12 : 6;
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        angle: (i / count) * 360 + Math.random() * 30,
        dist: 20 + Math.random() * (isCrit ? 40 : 20),
        size: 2 + Math.random() * (isCrit ? 4 : 2),
        delay: Math.random() * 0.1,
      })),
    [count, isCrit],
  );

  return (
    <div
      className="absolute pointer-events-none z-35 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Flash */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full animate-[explosion-flash_0.3s_ease-out_both]"
        style={{
          width: isCrit ? 60 : 36,
          height: isCrit ? 60 : 36,
          left: '50%',
          top: '50%',
          background: `radial-gradient(circle, ${attack.trail}80, transparent)`,
        }}
      />
      {/* Shrapnel */}
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <div
            key={p.id}
            className="absolute left-1/2 top-1/2 animate-[shrapnel-fly_0.5s_ease-out_both]"
            style={{ '--tx': `${tx}px`, '--ty': `${ty}px`, animationDelay: `${p.delay}s` }}
          >
            <div
              className="rounded-full"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: attack.trail,
                boxShadow: `0 0 3px ${attack.trail}`,
              }}
            />
          </div>
        );
      })}
      {/* Emoji burst */}
      {isCrit && (
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[check-pop_0.5s_ease-out_both]"
          style={{ fontSize: 32, filter: `drop-shadow(0 0 12px ${attack.glow})` }}
        >
          {attack.emoji}
        </span>
      )}
    </div>
  );
}

// ─── Floating damage number ───
function DmgNumber({ value, x, y, color, isCrit }) {
  return (
    <div
      className="absolute pointer-events-none z-40 -translate-x-1/2 animate-[damage-float_1s_ease-out_both]"
      style={{ left: `${x}%`, top: `${y - 2}%` }}
    >
      <span
        className={`font-black ${isCrit ? 'text-xl' : 'text-sm'}`}
        style={{ color, textShadow: `0 0 10px ${color}80, 0 2px 4px rgba(0,0,0,0.6)` }}
      >
        {isCrit ? 'CRIT! ' : ''}-{value}
      </span>
    </div>
  );
}

// ─── Agent on the map ───
function AgentSprite({ task, x, y, hp, maxHp, isHit, lastAction, isVictory, isDefeat }) {
  const agentName = task.agent_name || `Agent ${task.id}`;
  const totalTokens = (task.input_tokens || 0) + (task.output_tokens || 0);
  const hpPct = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 100;
  const hpColor = hpPct > 60 ? '#34d399' : hpPct > 30 ? '#fbbf24' : '#ef4444';
  const isActive = task.status === 'in_progress' && task.is_running;

  // Idle bob animation
  const [bob, setBob] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    let frame = Math.random() * 100;
    const iv = setInterval(() => {
      frame += 0.08;
      setBob(Math.sin(frame) * 3);
    }, 50);
    return () => clearInterval(iv);
  }, [isActive]);

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-200 ${
        isHit ? 'animate-[damage-shake_0.25s_ease-in-out]' : ''
      } ${isVictory ? 'animate-[victory-bounce_0.8s_ease-out_both]' : ''} ${isDefeat ? 'opacity-40 grayscale' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: 10,
        transform: `translate(-50%, calc(-50% + ${isActive ? bob : 0}px))`,
      }}
    >
      {isVictory && (
        <Trophy
          size={20}
          className="text-amber-400 mb-0.5 animate-[check-pop_0.6s_ease-out_both]"
          style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))' }}
        />
      )}
      {isDefeat && <Skull size={18} className="text-red-400 mb-0.5 animate-[check-pop_0.4s_ease-out_both]" />}

      <span className="text-[9px] font-bold text-claude mb-1 whitespace-nowrap bg-surface-900/90 px-1.5 py-0.5 rounded shadow-md">
        {agentName}
      </span>

      <div
        className={`rounded-xl overflow-hidden ring-2 transition-all ${
          isVictory
            ? 'ring-emerald-400 shadow-lg shadow-emerald-500/50'
            : isDefeat
              ? 'ring-red-500/60'
              : isHit
                ? 'ring-red-400 shadow-lg shadow-red-500/40'
                : 'ring-claude/60'
        }`}
        style={isHit ? { filter: 'brightness(2) saturate(0.3)' } : {}}
      >
        <Avatar size={48} name={agentName} variant="beam" colors={AVATAR_COLORS} />
        {isActive && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-surface-900" />
        )}
      </div>

      {/* HP Bar */}
      <div className="w-16 mt-1.5">
        <div className="h-2 rounded-full bg-surface-900/80 overflow-hidden border border-surface-700/50 shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.max(hpPct, 3)}%`, backgroundColor: hpColor, boxShadow: `0 0 6px ${hpColor}80` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <Heart size={7} style={{ color: hpColor }} />
          <span className="text-[7px] font-mono text-surface-400">
            {Math.round(hp)}/{maxHp}
          </span>
        </div>
      </div>

      {/* Power level */}
      <div className="flex items-center gap-0.5 mt-1 bg-surface-900/90 px-1.5 py-0.5 rounded shadow">
        <Zap size={7} className="text-amber-400" />
        <span className="text-[8px] text-surface-300 font-mono">{formatTokens(totalTokens)}</span>
      </div>

      {/* Speech bubble */}
      {lastAction && isActive && (
        <div className="mt-1.5 relative max-w-[90px]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface-900/90 border-l border-t border-surface-700/50 rotate-45" />
          <div className="bg-surface-900/90 border border-surface-700/50 rounded-md px-2 py-0.5 shadow">
            <span className="text-[8px] text-amber-300 truncate block">{lastAction}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ARENA ───
export default function BattleView({ tasks, projectId }) {
  const [conflicts, setConflicts] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [damages, setDamages] = useState([]);
  const [hitMap, setHitMap] = useState({});
  const [hpMap, setHpMap] = useState({});
  const [actionMap, setActionMap] = useState({});
  const [completions, setCompletions] = useState([]);
  const [failures, setFailures] = useState([]);
  const nextId = useRef(0);

  const runningTasks = useMemo(() => tasks.filter((t) => t.status === 'in_progress' && t.is_running), [tasks]);
  const doneTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'done' || t.status === 'testing')
        .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
        .slice(0, 3),
    [tasks],
  );
  const failedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'failed')
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
        .slice(0, 2),
    [tasks],
  );

  const arenaAgents = useMemo(() => {
    const agents = [];
    runningTasks.forEach((t, i) =>
      agents.push({ ...t, _pos: ARENA_POSITIONS[i % ARENA_POSITIONS.length], _state: 'active' }),
    );
    doneTasks.forEach((t, i) => {
      if (!agents.find((a) => a.id === t.id)) {
        agents.push({
          ...t,
          _pos: ARENA_POSITIONS[(runningTasks.length + i) % ARENA_POSITIONS.length],
          _state: 'victory',
        });
      }
    });
    failedTasks.forEach((t, i) => {
      if (!agents.find((a) => a.id === t.id)) {
        agents.push({
          ...t,
          _pos: ARENA_POSITIONS[(runningTasks.length + doneTasks.length + i) % ARENA_POSITIONS.length],
          _state: 'defeat',
        });
      }
    });
    return agents;
  }, [runningTasks, doneTasks, failedTasks]);

  // Init HP
  useEffect(() => {
    setHpMap((prev) => {
      const next = { ...prev };
      for (const a of arenaAgents) {
        if (next[a.id] === undefined) {
          const tokens = (a.input_tokens || 0) + (a.output_tokens || 0);
          next[a.id] = Math.max(0, 200 - Math.min(200, Math.round(tokens / 1000)));
        }
      }
      return next;
    });
  }, [arenaAgents]);

  // Poll conflicts
  useEffect(() => {
    if (!IS_TAURI || !projectId) return;
    const load = () =>
      api
        .getAgentActivity(projectId)
        .then((d) => setConflicts(d.conflicts || []))
        .catch(() => {});
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [projectId]);

  // Tool call → update action bubble
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:log', (payload) => {
      if (payload.logType === 'tool') {
        let meta = {};
        try {
          meta = payload.meta ? (typeof payload.meta === 'string' ? JSON.parse(payload.meta) : payload.meta) : {};
        } catch {}
        setActionMap((prev) => ({ ...prev, [payload.taskId]: meta.toolName || 'Working...' }));
      }
    });
  }, []);

  // Usage update → FIRE projectile at enemy
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:usage', (payload) => {
      const attackerId = payload.taskId;
      const actives = arenaAgents.filter((a) => a._state === 'active');
      if (actives.length < 2) return;
      const attacker = actives.find((a) => a.id === attackerId);
      const others = actives.filter((a) => a.id !== attackerId);
      if (!attacker || others.length === 0) return;

      const target = others[Math.floor(Math.random() * others.length)];
      const tokens = (payload.input_tokens || 0) + (payload.output_tokens || 0);
      const power = Math.min(20, Math.max(4, Math.round(tokens / 15000)));
      const dmg = Math.min(40, Math.max(1, Math.round(tokens / 8000)));
      const isCrit = power >= 14;
      const attack = ATTACK_TYPES[attackerId % ATTACK_TYPES.length];
      const pid = ++nextId.current;

      setProjectiles((prev) => [
        ...prev,
        {
          id: pid,
          fromX: attacker._pos.x,
          fromY: attacker._pos.y,
          toX: target._pos.x,
          toY: target._pos.y,
          size: power,
          attack,
        },
      ]);

      // Impact after flight
      setTimeout(() => {
        // Hit flash
        setHitMap((prev) => ({ ...prev, [target.id]: true }));
        setTimeout(() => setHitMap((prev) => ({ ...prev, [target.id]: false })), 350);

        // HP decrease
        setHpMap((prev) => ({ ...prev, [target.id]: Math.max(0, (prev[target.id] ?? 200) - dmg) }));

        // Explosion
        const eid = ++nextId.current;
        setExplosions((prev) => [...prev, { id: eid, x: target._pos.x, y: target._pos.y, attack, isCrit }]);
        setTimeout(() => setExplosions((prev) => prev.filter((e) => e.id !== eid)), 600);

        // Damage number
        const did = ++nextId.current;
        setDamages((prev) => [
          ...prev,
          {
            id: did,
            value: dmg,
            x: target._pos.x + (Math.random() * 8 - 4),
            y: target._pos.y - 6,
            color: attack.trail,
            isCrit,
          },
        ]);
        setTimeout(() => setDamages((prev) => prev.filter((d) => d.id !== did)), 1200);
      }, 500);
    });
  }, [arenaAgents]);

  const removeProjectile = useCallback((id) => setProjectiles((prev) => prev.filter((p) => p.id !== id)), []);

  // Victory/defeat
  useEffect(() => {
    if (!IS_TAURI) return;
    return tauriListen('task:updated', (payload) => {
      const tid = payload.id || payload.taskId;
      if (payload.status === 'done' || payload.status === 'testing') {
        setCompletions((prev) => [...prev, tid].slice(-5));
        setTimeout(() => setCompletions((prev) => prev.filter((id) => id !== tid)), 5000);
      }
      if (payload.status === 'failed') {
        setFailures((prev) => [...prev, tid].slice(-5));
        setTimeout(() => setFailures((prev) => prev.filter((id) => id !== tid)), 5000);
      }
    });
  }, []);

  if (arenaAgents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-2xl bg-surface-800/60 flex items-center justify-center mb-4 ring-2 ring-surface-700">
          <Swords size={32} className="text-surface-600" />
        </div>
        <h3 className="text-sm font-bold text-surface-400 mb-1">The Arena Awaits</h3>
        <p className="text-xs text-surface-600">Start tasks to send agents into battle</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-900/40 to-transparent" />
        <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-red-950/50 via-surface-800/90 to-red-950/50 border border-red-900/30 shadow-lg">
          <Swords size={16} className="text-red-400 animate-[attack-swing_1s_ease-in-out_infinite]" />
          <span className="text-sm font-black text-surface-100 uppercase tracking-widest">Battle Arena</span>
          {runningTasks.length > 0 && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
              {runningTasks.length} fighting
            </span>
          )}
          {conflicts.length > 0 && (
            <span className="text-[10px] font-black text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse">
              {conflicts.length} CLASH
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-red-900/40 to-transparent" />
      </div>

      {/* Arena */}
      <div className="flex-1 relative min-h-[420px] rounded-2xl border border-surface-700/30 bg-surface-950/60 overflow-hidden shadow-inner">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(218,119,86,0.05) 0%, transparent 50%)' }}
        />

        {/* Conflict lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
          {conflicts.map((c, i) => {
            const ids = c.taskIds || [];
            return ids.slice(1).map((tid, j) => {
              const a1 = arenaAgents.find((a) => a.id === ids[0]);
              const a2 = arenaAgents.find((a) => a.id === tid);
              if (!a1 || !a2) return null;
              return (
                <g key={`${i}-${j}`}>
                  <line
                    x1={`${a1._pos.x}%`}
                    y1={`${a1._pos.y}%`}
                    x2={`${a2._pos.x}%`}
                    y2={`${a2._pos.y}%`}
                    stroke="rgba(239,68,68,0.15)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  >
                    <animate attributeName="stroke-dashoffset" from="0" to="10" dur="0.4s" repeatCount="indefinite" />
                  </line>
                  {/* VS marker at midpoint */}
                  <text
                    x={`${(a1._pos.x + a2._pos.x) / 2}%`}
                    y={`${(a1._pos.y + a2._pos.y) / 2}%`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(239,68,68,0.5)"
                    fontSize="10"
                    fontWeight="900"
                  >
                    VS
                  </text>
                </g>
              );
            });
          })}
        </svg>

        {/* Projectiles */}
        {projectiles.map((p) => (
          <Projectile
            key={p.id}
            fromX={p.fromX}
            fromY={p.fromY}
            toX={p.toX}
            toY={p.toY}
            size={p.size}
            attack={p.attack}
            onDone={() => removeProjectile(p.id)}
          />
        ))}

        {/* Explosions */}
        {explosions.map((e) => (
          <Explosion key={e.id} x={e.x} y={e.y} attack={e.attack} isCrit={e.isCrit} />
        ))}

        {/* Damage numbers */}
        {damages.map((d) => (
          <DmgNumber key={d.id} value={d.value} x={d.x} y={d.y} color={d.color} isCrit={d.isCrit} />
        ))}

        {/* Agents */}
        {arenaAgents.map((agent) => (
          <AgentSprite
            key={agent.id}
            task={agent}
            x={agent._pos.x}
            y={agent._pos.y}
            hp={hpMap[agent.id] ?? 200}
            maxHp={200}
            isHit={!!hitMap[agent.id]}
            lastAction={actionMap[agent.id]}
            isVictory={agent._state === 'victory' || completions.includes(agent.id)}
            isDefeat={agent._state === 'defeat' || failures.includes(agent.id)}
          />
        ))}
      </div>

      {/* Battle log */}
      {conflicts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <Flame size={11} className="text-red-400 animate-pulse" />
          {conflicts.map((c, i) => (
            <span
              key={i}
              className="text-[9px] text-red-300 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20"
            >
              <Swords size={8} className="inline mr-1" />
              {c.filePath?.split('/').pop()} ({c.taskIds?.length})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
