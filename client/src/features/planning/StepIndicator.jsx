import { Check } from 'lucide-react';
import { STEPS } from './planningConstants';
import { getStepIndex } from './planningHelpers';

export function StepIndicator({ phase, t }) {
  const activeStep = getStepIndex(phase);

  return (
    <div className="flex items-center w-full px-6 py-4">
      {STEPS.map((step, i) => {
        const isComplete = i < activeStep;
        const isCurrent = i === activeStep;
        const isFuture = i > activeStep;

        return (
          <div key={step.num} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
                ${
                  isComplete
                    ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30'
                    : isCurrent
                      ? 'bg-claude/15 text-claude ring-2 ring-claude/40 animate-[pulse_2s_ease-in-out_infinite]'
                      : 'bg-surface-800/60 text-surface-600 ring-1 ring-surface-700/30'
                }
              `}
              >
                {isComplete ? <Check size={14} className="text-emerald-400" /> : step.num}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  isComplete ? 'text-emerald-400' : isCurrent ? 'text-claude' : 'text-surface-600'
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-3 rounded-full transition-colors duration-300 ${
                  isComplete ? 'bg-emerald-500/40' : 'bg-surface-800'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
