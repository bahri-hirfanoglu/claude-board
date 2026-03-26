import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X, ChevronRight, ChevronLeft, Sparkles, LayoutGrid, Plus, Brain, Settings,
  Rocket, Zap, GitBranch, FlaskConical, Workflow, Terminal, ArrowRight,
} from 'lucide-react';
import { useTranslation } from '../../i18n/I18nProvider';

const STORAGE_KEY = 'onboarding:completed';

// ─── Steps ───
function getSteps(t, hasProject) {
  const steps = [
    {
      id: 'welcome', position: 'center', target: null,
      icon: Rocket, accent: 'from-violet-500 to-blue-500',
      title: t('onboarding.welcomeTitle'),
      description: t('onboarding.welcomeDesc'),
      illustration: 'welcome',
    },
    {
      id: 'create-project', position: 'bottom-left',
      target: '[data-tour="project-selector"]',
      icon: Plus, accent: 'from-blue-500 to-cyan-400',
      title: t('onboarding.createProjectTitle'),
      description: t('onboarding.createProjectDesc'),
    },
    {
      id: 'new-task', position: 'bottom-left',
      target: '[data-tour="new-task"]', requireProject: true,
      icon: Zap, accent: 'from-amber-500 to-orange-400',
      title: t('onboarding.newTaskTitle'),
      description: t('onboarding.newTaskDesc'),
    },
    {
      id: 'board-views', position: 'bottom-left',
      target: '[data-tour="view-tabs"]', requireProject: true,
      icon: LayoutGrid, accent: 'from-emerald-500 to-teal-400',
      title: t('onboarding.boardViewsTitle'),
      description: t('onboarding.boardViewsDesc'),
    },
    {
      id: 'planning', position: 'bottom-left',
      target: '[data-tour="planning-btn"]', requireProject: true,
      icon: Brain, accent: 'from-purple-500 to-pink-400',
      title: t('onboarding.planningTitle'),
      description: t('onboarding.planningDesc'),
    },
    {
      id: 'settings', position: 'bottom-right',
      target: '[data-tour="project-selector"]',
      icon: Settings, accent: 'from-slate-400 to-zinc-500',
      title: t('onboarding.settingsTitle'),
      description: t('onboarding.settingsDesc'),
    },
    {
      id: 'done', position: 'center', target: null,
      icon: Sparkles, accent: 'from-amber-400 to-rose-400',
      title: t('onboarding.doneTitle'),
      description: t('onboarding.doneDesc'),
      illustration: 'done',
    },
  ];
  return hasProject ? steps : steps.filter(s => !s.requireProject);
}

function getTooltipPos(targetEl, position, tipWidth) {
  if (!targetEl || position === 'center') return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const r = targetEl.getBoundingClientRect();
  const gap = 14;
  const pad = 12;
  const w = tipWidth || 360;
  // Center tooltip horizontally under/above the target when possible
  const centerLeft = r.left + r.width / 2 - w / 2;
  const clampedLeft = Math.min(Math.max(pad, centerLeft), window.innerWidth - w - pad);
  switch (position) {
    case 'bottom-left': return { top: r.bottom + gap, left: clampedLeft };
    case 'bottom-right': return { top: r.bottom + gap, left: clampedLeft };
    case 'top-left': return { bottom: window.innerHeight - r.top + gap, left: clampedLeft };
    case 'top-right': return { bottom: window.innerHeight - r.top + gap, left: clampedLeft };
    default: return { top: r.bottom + gap, left: clampedLeft };
  }
}

// ─── Hook ───
export function useOnboarding() {
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');
  return {
    showOnboarding: active,
    startOnboarding: useCallback(() => setActive(true), []),
    completeOnboarding: useCallback(() => { localStorage.setItem(STORAGE_KEY, 'true'); setActive(false); }, []),
    resetOnboarding: useCallback(() => { localStorage.removeItem(STORAGE_KEY); setActive(true); }, []),
  };
}

// ─── Animated particles for welcome/done screens ───
function Particles({ count = 20, colors }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      dur: 3 + Math.random() * 4,
      delay: Math.random() * 3,
      color: colors[i % colors.length],
    })), [count, colors]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full opacity-0"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            animation: `onb-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Feature icon grid for welcome screen ───
function FeatureGrid() {
  const features = [
    { icon: Terminal, label: 'AI Agents', color: 'text-amber-400 bg-amber-500/10' },
    { icon: GitBranch, label: 'Orchestration', color: 'text-blue-400 bg-blue-500/10' },
    { icon: FlaskConical, label: 'Auto-Test', color: 'text-purple-400 bg-purple-500/10' },
    { icon: Workflow, label: 'Pipeline', color: 'text-emerald-400 bg-emerald-500/10' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {features.map((f, i) => (
        <div key={i}
          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] opacity-0"
          style={{ animation: `onb-pop 0.4s ease-out ${0.3 + i * 0.1}s forwards` }}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${f.color}`}>
            <f.icon size={15} />
          </div>
          <span className="text-[9px] text-surface-500 font-medium">{f.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───
export default function OnboardingTour({ active, onComplete, hasProject }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [tipStyle, setTipStyle] = useState({});
  const [hlStyle, setHlStyle] = useState(null);
  const [dir, setDir] = useState(1); // 1=forward, -1=back (for animation direction)
  const [animKey, setAnimKey] = useState(0);

  const steps = getSteps(t, hasProject);
  const cur = steps[step];

  useEffect(() => {
    if (!active || !cur) return;
    const update = () => {
      const el = cur.target ? document.querySelector(cur.target) : null;
      setTipStyle(getTooltipPos(el, cur.position));
      if (el) {
        const r = el.getBoundingClientRect();
        setHlStyle({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
      } else {
        setHlStyle(null);
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [active, step, cur]);

  const go = (delta) => {
    setDir(delta);
    setAnimKey(k => k + 1);
    if (delta > 0 && step >= steps.length - 1) { onComplete(); setStep(0); return; }
    if (delta < 0 && step <= 0) return;
    setStep(s => s + delta);
  };

  const skip = () => { onComplete(); setStep(0); };

  if (!active || !cur) return null;

  const Icon = cur.icon;
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const isCenter = cur.position === 'center';
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop with animated gradient */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, rgba(0,0,0,0.75) 70%)' }}
        onClick={skip}
      />

      {/* Highlight: subtle pulse ring around target, no full-screen shadow */}
      {hlStyle && (
        <div
          className="absolute rounded-lg z-[61] pointer-events-none transition-all duration-300 ease-out"
          style={{
            ...hlStyle,
            border: '2px solid rgba(99,102,241,0.6)',
            boxShadow: '0 0 12px 2px rgba(99,102,241,0.25), inset 0 0 8px rgba(99,102,241,0.1)',
            animation: 'onb-ring-pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip card — outer div for position, inner for animation */}
      <div
        className={`absolute z-[62] ${isCenter ? 'w-[420px]' : 'w-[360px]'}`}
        style={tipStyle}
      >
      <div
        key={animKey}
        style={{ animation: `${dir > 0 ? 'onb-enter-right' : 'onb-enter-left'} 0.35s cubic-bezier(0.16,1,0.3,1) both` }}
      >
        <div className="relative bg-[#111118]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top gradient accent bar */}
          <div className={`h-1 bg-gradient-to-r ${cur.accent}`} />

          {/* Particles on center screens */}
          {isCenter && (
            <Particles count={15} colors={['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#3b82f6']} />
          )}

          {/* Header */}
          <div className="relative px-6 pt-5 pb-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {isCenter && (
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cur.accent} flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-[15px] font-semibold text-white tracking-tight">{cur.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {steps.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
                        i < step ? 'w-3 bg-white/30' : i === step ? 'w-5 bg-white/70' : 'w-2 bg-white/10'
                      }`} />
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={skip} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-500 hover:text-surface-300 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-[13px] text-surface-400 leading-[1.7]">{cur.description}</p>
            {cur.illustration === 'welcome' && <FeatureGrid />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.05]">
            <button onClick={skip} className="text-[11px] text-surface-600 hover:text-surface-400 transition-colors">
              {t('onboarding.skip')}
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={() => go(-1)}
                  className="flex items-center gap-1 px-3.5 py-2 text-[12px] text-surface-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-all">
                  <ChevronLeft size={13} />
                  {t('onboarding.back')}
                </button>
              )}
              <button onClick={() => go(1)}
                className={`flex items-center gap-1.5 px-5 py-2 text-[12px] font-semibold text-white rounded-xl transition-all shadow-lg bg-gradient-to-r ${cur.accent} hover:brightness-110 active:scale-[0.97]`}>
                {isLast ? t('onboarding.finish') : t('onboarding.next')}
                {isLast ? <Sparkles size={13} /> : <ArrowRight size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow */}
        {!isCenter && cur.position?.startsWith('bottom') && hlStyle && (
          <div className="absolute -top-[7px] w-3.5 h-3.5 rotate-45 bg-[#111118]/95 border-l border-t border-white/[0.08]"
            style={{ left: Math.max(16, (hlStyle.left + hlStyle.width / 2) - (tipStyle.left || 0)) }}
          />
        )}
        {!isCenter && cur.position?.startsWith('top') && hlStyle && (
          <div className="absolute -bottom-[7px] w-3.5 h-3.5 rotate-45 bg-[#111118]/95 border-r border-b border-white/[0.08]"
            style={{ left: Math.max(16, (hlStyle.left + hlStyle.width / 2) - (tipStyle.left || 0)) }}
          />
        )}
      </div>{/* end animation wrapper */}
      </div>{/* end position wrapper */}

      {/* Global onboarding keyframes (injected once) */}
      <style>{`
        @keyframes onb-enter-right {
          from { opacity: 0; transform: translateX(20px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes onb-enter-left {
          from { opacity: 0; transform: translateX(-20px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes onb-float {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
          20% { opacity: 0.6; }
          50% { opacity: 0.4; transform: translateY(-20px) scale(1); }
          80% { opacity: 0.2; }
        }
        @keyframes onb-pop {
          from { opacity: 0; transform: scale(0.8) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes onb-ring-pulse {
          0%, 100% { border-color: rgba(99,102,241,0.6); box-shadow: 0 0 12px 2px rgba(99,102,241,0.25); }
          50% { border-color: rgba(99,102,241,0.3); box-shadow: 0 0 20px 4px rgba(99,102,241,0.15); }
        }
      `}</style>
    </div>
  );
}
