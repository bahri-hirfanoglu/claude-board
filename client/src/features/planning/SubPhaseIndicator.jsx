import { SUB_PHASES } from './planningConstants';

export function SubPhaseIndicator({ planPhase }) {
  const currentIdx = SUB_PHASES.findIndex(p => p.key === planPhase);

  return (
    <div className="flex items-center gap-2 justify-center py-2">
      {SUB_PHASES.map((sp, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={sp.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isComplete
                  ? 'bg-emerald-400'
                  : isCurrent
                    ? 'bg-claude animate-[pulse_1.5s_ease-in-out_infinite]'
                    : 'bg-surface-700'
              }`} />
              <span className={`text-[10px] font-medium transition-colors duration-200 ${
                isComplete ? 'text-emerald-400' : isCurrent ? 'text-claude' : 'text-surface-600'
              }`}>{sp.label}</span>
            </div>
            {i < SUB_PHASES.length - 1 && (
              <div className={`w-4 h-px ${isComplete ? 'bg-emerald-500/40' : 'bg-surface-700/50'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
