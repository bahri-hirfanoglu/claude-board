import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

export default function ReviewModal({ task, onApprove, onRequestChanges, onClose }) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // null = choose, 'reject' = writing feedback
  const textareaRef = useRef(null);

  useEffect(() => {
    api
      .getRevisions(task.id)
      .then(setRevisions)
      .catch(() => {});
  }, [task.id]);

  useEffect(() => {
    if (mode === 'reject' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  const handleSubmitChanges = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    try {
      await onRequestChanges(task.id, feedback.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(task.id);
    } finally {
      setLoading(false);
    }
  };

  const revisionCount = task.revision_count || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-lg shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-sm font-semibold text-surface-100">{t('review.title')}</h2>
            <p className="text-xs text-surface-500 mt-0.5 truncate max-w-[360px]">{task.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Revision history */}
        {revisions.length > 0 && (
          <div className="px-5 py-3 border-b border-surface-800 max-h-[200px] overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-surface-500" />
              <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wider">
                {t('review.revisionHistory')} ({revisions.length})
              </span>
            </div>
            <div className="space-y-2">
              {revisions.map((rev) => (
                <div key={rev.id} className="bg-surface-800/50 rounded-lg p-2.5 border border-surface-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Rev #{rev.revision_number}
                    </span>
                    <span className="text-[10px] text-surface-600">{new Date(rev.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-surface-300 whitespace-pre-wrap">{rev.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action area */}
        <div className="px-5 py-4">
          {mode === null ? (
            <div className="space-y-3">
              <p className="text-xs text-surface-400">
                {revisionCount > 0 ? t('review.revisedTimes', { count: revisionCount }) : t('review.reviewPrompt')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={15} />
                  {t('review.approve')}
                </button>
                <button
                  onClick={() => setMode('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
                >
                  <RotateCcw size={15} />
                  {t('review.requestChanges')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-amber-400" />
                <span className="text-xs font-medium text-surface-300">
                  {t('review.feedbackLabel', { num: revisionCount + 1 })}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t('review.feedbackPlaceholder')}
                className="w-full h-32 px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-600 resize-none focus:outline-none focus:border-claude/50 focus:ring-1 focus:ring-claude/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMode(null);
                    setFeedback('');
                  }}
                  className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 text-sm transition-colors"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={handleSubmitChanges}
                  disabled={!feedback.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  {loading ? t('review.sending') : t('review.sendBack')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
