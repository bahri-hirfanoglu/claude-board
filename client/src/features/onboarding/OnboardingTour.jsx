import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, LayoutGrid, GitBranch, Workflow, TrendingUp, Plus, Brain, Settings } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nProvider';

const STORAGE_KEY = 'onboarding:completed';

// Tour step definitions. `target` is a CSS selector or data attribute.
// Steps shown depend on app state (hasProject, etc.)
function getSteps(t, hasProject) {
  const steps = [
    {
      id: 'welcome',
      title: t('onboarding.welcomeTitle'),
      description: t('onboarding.welcomeDesc'),
      icon: Sparkles,
      position: 'center',
      target: null,
    },
    {
      id: 'create-project',
      title: t('onboarding.createProjectTitle'),
      description: t('onboarding.createProjectDesc'),
      icon: Plus,
      position: 'bottom-left',
      target: '[data-tour="project-selector"]',
    },
    {
      id: 'new-task',
      title: t('onboarding.newTaskTitle'),
      description: t('onboarding.newTaskDesc'),
      icon: Plus,
      position: 'bottom-left',
      target: '[data-tour="new-task"]',
      requireProject: true,
    },
    {
      id: 'board-views',
      title: t('onboarding.boardViewsTitle'),
      description: t('onboarding.boardViewsDesc'),
      icon: LayoutGrid,
      position: 'bottom-left',
      target: '[data-tour="view-tabs"]',
      requireProject: true,
    },
    {
      id: 'planning',
      title: t('onboarding.planningTitle'),
      description: t('onboarding.planningDesc'),
      icon: Brain,
      position: 'bottom-left',
      target: '[data-tour="planning-btn"]',
      requireProject: true,
    },
    {
      id: 'settings',
      title: t('onboarding.settingsTitle'),
      description: t('onboarding.settingsDesc'),
      icon: Settings,
      position: 'bottom-right',
      target: '[data-tour="project-selector"]',
    },
    {
      id: 'done',
      title: t('onboarding.doneTitle'),
      description: t('onboarding.doneDesc'),
      icon: Sparkles,
      position: 'center',
      target: null,
    },
  ];

  return hasProject ? steps : steps.filter(s => !s.requireProject);
}

function getTooltipPosition(targetEl, position) {
  if (!targetEl || position === 'center') return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const rect = targetEl.getBoundingClientRect();
  const pad = 12;

  switch (position) {
    case 'bottom-left':
      return { top: rect.bottom + pad, left: Math.max(pad, rect.left), transform: 'none' };
    case 'bottom-right':
      return { top: rect.bottom + pad, left: 'auto', right: Math.max(pad, window.innerWidth - rect.right), transform: 'none' };
    case 'top-left':
      return { bottom: window.innerHeight - rect.top + pad, left: Math.max(pad, rect.left), transform: 'none' };
    case 'top-right':
      return { bottom: window.innerHeight - rect.top + pad, right: Math.max(pad, window.innerWidth - rect.right), transform: 'none' };
    default:
      return { top: rect.bottom + pad, left: rect.left, transform: 'none' };
  }
}

export function useOnboarding() {
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');

  const start = useCallback(() => setActive(true), []);
  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
  }, []);
  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActive(true);
  }, []);

  return { showOnboarding: active, startOnboarding: start, completeOnboarding: complete, resetOnboarding: reset };
}

export default function OnboardingTour({ active, onComplete, hasProject }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [highlightStyle, setHighlightStyle] = useState(null);
  const tooltipRef = useRef(null);

  const steps = getSteps(t, hasProject);
  const current = steps[step];

  // Position tooltip and highlight target
  useEffect(() => {
    if (!active || !current) return;

    const update = () => {
      const targetEl = current.target ? document.querySelector(current.target) : null;
      setTooltipStyle(getTooltipPosition(targetEl, current.position));

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        setHighlightStyle({
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        });
      } else {
        setHighlightStyle(null);
      }
    };

    update();
    // Recalculate on resize/scroll
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, step, current]);

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else { onComplete(); setStep(0); }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const skip = () => {
    onComplete();
    setStep(0);
  };

  if (!active || !current) return null;

  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const isCenter = current.position === 'center';

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={skip} />

      {/* Highlight cutout */}
      {highlightStyle && (
        <div
          className="absolute rounded-lg ring-2 ring-claude ring-offset-2 ring-offset-transparent z-[61] pointer-events-none"
          style={{
            top: highlightStyle.top,
            left: highlightStyle.left,
            width: highlightStyle.width,
            height: highlightStyle.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`absolute z-[62] ${isCenter ? 'w-[380px]' : 'w-[340px]'} animate-slide-up`}
        style={tooltipStyle}
      >
        <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-800">
            <div className="w-8 h-8 rounded-lg bg-claude/15 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-claude" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-surface-100">{current.title}</h3>
              <span className="text-[10px] text-surface-600">{step + 1} / {steps.length}</span>
            </div>
            <button onClick={skip} className="p-1 rounded-lg hover:bg-surface-800 text-surface-500 flex-shrink-0">
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <p className="text-xs text-surface-400 leading-relaxed">{current.description}</p>
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-2">
            <div className="h-1 bg-surface-800 rounded-full overflow-hidden">
              <div className="h-full bg-claude rounded-full transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-800">
            <button onClick={skip} className="text-[11px] text-surface-600 hover:text-surface-400 transition-colors">
              {t('onboarding.skip')}
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={prev} className="flex items-center gap-1 px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
                  <ChevronLeft size={12} />
                  {t('onboarding.back')}
                </button>
              )}
              <button onClick={next} className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-claude hover:bg-claude-light rounded-lg transition-colors">
                {isLast ? t('onboarding.finish') : t('onboarding.next')}
                {!isLast && <ChevronRight size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointer (when targeting an element) */}
        {!isCenter && current.position?.startsWith('bottom') && (
          <div className="absolute -top-2 left-8 w-4 h-4 rotate-45 bg-surface-900 border-l border-t border-surface-700" />
        )}
      </div>
    </div>
  );
}
