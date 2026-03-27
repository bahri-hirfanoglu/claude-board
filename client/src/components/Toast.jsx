import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

const STYLES = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  info: 'bg-claude/10 border-claude/30 text-claude-light',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
};

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

export default function Toast({ toasts }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg border text-sm shadow-lg animate-slide-up flex items-center gap-2 ${STYLES[t.type] || STYLES.info}`}
        >
          {(() => {
            const Icon = ICONS[t.type] || ICONS.info;
            return <Icon size={16} className="flex-shrink-0" />;
          })()}
          {t.message}
        </div>
      ))}
    </div>
  );
}
