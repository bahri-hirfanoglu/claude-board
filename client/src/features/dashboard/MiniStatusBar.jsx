export function MiniStatusBar({ backlog, active, testing, done, total }) {
  if (total === 0) return null;
  const segments = [
    { count: done, color: 'bg-emerald-400', label: 'Done' },
    { count: testing, color: 'bg-claude', label: 'Testing' },
    { count: active, color: 'bg-amber-400', label: 'Active' },
    { count: backlog, color: 'bg-surface-500', label: 'Backlog' },
  ];
  return (
    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-surface-700">
      {segments.map((s, i) => s.count > 0 && (
        <div
          key={i}
          className={`${s.color} transition-all duration-500`}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
}
