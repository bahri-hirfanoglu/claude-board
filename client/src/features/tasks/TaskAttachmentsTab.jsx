import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';
import InlineDeleteConfirm from '../../components/InlineDeleteConfirm';

export function TaskAttachmentsTab({ attachments, setAttachments }) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {attachments.map((a) => {
          const isImage = a.mime_type?.startsWith('image/');
          return (
            <div
              key={a.id}
              className="bg-surface-800/40 rounded-lg overflow-hidden group relative border border-surface-700/30"
            >
              {isImage ? (
                <a href={`/uploads/${a.filename}`} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={`/uploads/${a.filename}`} alt={a.original_name} className="w-full h-28 object-cover" />
                  <div className="px-2.5 py-2">
                    <p className="text-[10px] text-surface-300 truncate">{a.original_name}</p>
                  </div>
                </a>
              ) : (
                <a
                  href={`/uploads/${a.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-3"
                >
                  <FileText size={16} className="text-surface-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-surface-300 truncate">{a.original_name}</p>
                    <p className="text-[10px] text-surface-600">{(a.size / 1024).toFixed(1)}KB</p>
                  </div>
                </a>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDeleting(a.id);
                }}
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
              {deleting === a.id && (
                <InlineDeleteConfirm
                  message="Delete this attachment?"
                  onConfirm={async () => {
                    try {
                      await api.deleteAttachment(a.id);
                      setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                    } catch {}
                    setDeleting(null);
                  }}
                  onCancel={() => setDeleting(null)}
                />
              )}
            </div>
          );
        })}
      </div>
      {attachments.length === 0 && (
        <div className="text-center text-surface-600 text-xs py-8">{t('detail.noAttachments')}</div>
      )}
    </div>
  );
}
