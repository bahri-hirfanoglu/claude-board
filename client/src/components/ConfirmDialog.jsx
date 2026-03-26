import { useTranslation } from '../i18n/I18nProvider';

export default function ConfirmDialog({ title, message, danger, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-sm mx-4 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-medium mb-2">{title}</h3>
        <p className="text-sm text-surface-400 mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-claude hover:bg-claude-light text-white'
            }`}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
