import { useEffect, useState, useMemo } from 'react';

// ─── Particle generation ───
function generateParticles(count, color, spread = 80) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * spread - spread / 2,
    y: -(Math.random() * spread + 20),
    rotation: Math.random() * 360,
    scale: 0.4 + Math.random() * 0.8,
    delay: Math.random() * 0.3,
    duration: 0.6 + Math.random() * 0.6,
    color,
  }));
}

function generateConfetti(count) {
  const colors = ['#34d399', '#6ee7b7', '#a7f3d0', '#fbbf24', '#f59e0b', '#60a5fa', '#c084fc', '#f472b6'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 160 - 80,
    y: -(Math.random() * 120 + 30),
    rotation: Math.random() * 720 - 360,
    scale: 0.3 + Math.random() * 0.7,
    delay: Math.random() * 0.4,
    duration: 0.8 + Math.random() * 0.8,
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    wobble: Math.random() * 30 - 15,
  }));
}

// ─── Spark particles (for in_progress) ───
function SparkEffect() {
  const sparks = useMemo(() => generateParticles(12, '#fbbf24', 100), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {sparks.map(s => (
        <div
          key={s.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `spark-fly ${s.duration}s ease-out ${s.delay}s both`,
            '--tx': `${s.x}px`,
            '--ty': `${s.y}px`,
            '--rot': `${s.rotation}deg`,
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: s.color,
              boxShadow: `0 0 6px ${s.color}, 0 0 12px ${s.color}50`,
              transform: `scale(${s.scale})`,
            }}
          />
        </div>
      ))}
      {/* Center glow pulse */}
      <div className="absolute inset-0 rounded-lg animate-[glow-pulse_0.8s_ease-out_both]"
        style={{ boxShadow: '0 0 20px rgba(251,191,36,0.4), inset 0 0 20px rgba(251,191,36,0.1)' }}
      />
    </div>
  );
}

// ─── Shimmer wave (for testing) ───
function ShimmerEffect() {
  const dots = useMemo(() => generateParticles(8, '#D97706', 70), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {/* Shimmer wave */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <div className="absolute inset-0 animate-[shimmer-wave_1s_ease-out_both]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.15), rgba(217,119,6,0.3), rgba(217,119,6,0.15), transparent)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
      {/* Floating dots */}
      {dots.map(d => (
        <div
          key={d.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `float-up ${d.duration}s ease-out ${d.delay}s both`,
            '--tx': `${d.x}px`,
            '--ty': `${d.y}px`,
          }}
        >
          <div
            className="w-1 h-1 rounded-full"
            style={{
              backgroundColor: d.color,
              boxShadow: `0 0 4px ${d.color}`,
              transform: `scale(${d.scale})`,
            }}
          />
        </div>
      ))}
      {/* Border glow */}
      <div className="absolute inset-0 rounded-lg animate-[glow-pulse_0.8s_ease-out_both]"
        style={{ boxShadow: '0 0 16px rgba(217,119,6,0.3), inset 0 0 16px rgba(217,119,6,0.08)' }}
      />
    </div>
  );
}

// ─── Confetti burst (for done) ───
function ConfettiEffect() {
  const confetti = useMemo(() => generateConfetti(24), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute left-1/2 top-1/2"
          style={{
            animation: `confetti-burst ${c.duration}s ease-out ${c.delay}s both`,
            '--tx': `${c.x}px`,
            '--ty': `${c.y}px`,
            '--rot': `${c.rotation}deg`,
            '--wobble': `${c.wobble}px`,
          }}
        >
          {c.shape === 'rect' ? (
            <div
              className="w-2 h-1 rounded-sm"
              style={{
                backgroundColor: c.color,
                transform: `scale(${c.scale})`,
              }}
            />
          ) : (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: c.color,
                transform: `scale(${c.scale})`,
              }}
            />
          )}
        </div>
      ))}
      {/* Success glow */}
      <div className="absolute inset-0 rounded-lg animate-[glow-pulse_1s_ease-out_both]"
        style={{ boxShadow: '0 0 24px rgba(52,211,153,0.5), inset 0 0 24px rgba(52,211,153,0.1)' }}
      />
      {/* Checkmark flash */}
      <div className="absolute inset-0 flex items-center justify-center animate-[check-pop_0.6s_ease-out_0.1s_both]">
        <div className="text-2xl opacity-80 drop-shadow-lg">✓</div>
      </div>
    </div>
  );
}

// ─── Rewind effect (backward transitions) ───
function RewindEffect() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        <div className="absolute inset-0 animate-[rewind-sweep_0.6s_ease-out_both]"
          style={{
            background: 'linear-gradient(270deg, transparent, rgba(148,163,184,0.2), transparent)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
      <div className="absolute inset-0 rounded-lg animate-[glow-pulse_0.5s_ease-out_both]"
        style={{ boxShadow: '0 0 12px rgba(148,163,184,0.2), inset 0 0 12px rgba(148,163,184,0.05)' }}
      />
    </div>
  );
}

// ─── Main component ───
const STATUS_ORDER = { backlog: 0, in_progress: 1, testing: 2, done: 3, failed: -1 };

export default function StatusTransitionEffect({ from, to }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  if (to === 'failed') return <RewindEffect />;

  const fromIdx = STATUS_ORDER[from] ?? 0;
  const toIdx = STATUS_ORDER[to] ?? 0;
  const isForward = toIdx > fromIdx;

  if (!isForward) return <RewindEffect />;
  if (to === 'done') return <ConfettiEffect />;
  if (to === 'testing') return <ShimmerEffect />;
  if (to === 'in_progress') return <SparkEffect />;

  return null;
}
