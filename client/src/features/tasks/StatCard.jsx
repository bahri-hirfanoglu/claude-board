export function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/30">
      <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5"><Icon size={9} />{label}</div>
      <div className="text-sm font-semibold text-surface-200">{value}</div>
      {sub && <div className="text-[9px] text-surface-600">{sub}</div>}
    </div>
  );
}
