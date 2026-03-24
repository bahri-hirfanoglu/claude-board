import { X } from 'lucide-react';

export default function ModalShell({ title, subtitle, icon: Icon, iconClass = 'text-claude', onClose, maxWidth = 'max-w-lg', children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-surface-900 rounded-xl border border-surface-700 w-full ${maxWidth} shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              {Icon && <Icon size={16} className={iconClass} />}
              {title}
            </h2>
            {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
