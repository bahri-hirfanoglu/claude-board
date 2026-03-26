import { useState, useEffect, useRef } from 'react';
import {
  X,
  ScanSearch,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  FileText,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { tauriListen } from '../../lib/tauriEvents';
import { useTranslation } from '../../i18n/I18nProvider';

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Module-level cache — survives open/close
const scanCache = {};
function getCache(pid) {
  if (!scanCache[pid]) scanCache[pid] = { phase: 'idle', result: '', error: null, elapsed: 0 };
  return scanCache[pid];
}

export default function ScanModal({ projectId, onClose }) {
  const { t } = useTranslation();
  const c = getCache(projectId);
  const [phase, setPhase] = useState(c.phase); // idle | scanning | preview | saved | error
  const [result, setResult] = useState(c.result);
  const [error, setError] = useState(c.error);
  const [elapsed, setElapsed] = useState(c.elapsed);
  const [mode, setMode] = useState('overwrite');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  // Sync cache
  useEffect(() => {
    Object.assign(getCache(projectId), { phase, result, error, elapsed });
  });

  // Timer
  useEffect(() => {
    if (phase === 'scanning') {
      if (!startRef.current) startRef.current = Date.now() - (elapsed || 0);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // Listen for scan events
  useEffect(() => {
    const unsubs = [
      tauriListen('scan:completed', (data) => {
        if (data.projectId !== projectId) return;
        clearInterval(timerRef.current);
        if (data.result) {
          setResult(data.result);
          setPhase('preview');
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [projectId]);

  const handleStart = async () => {
    setPhase('scanning');
    setResult('');
    setError(null);
    setElapsed(0);
    startRef.current = Date.now();
    try {
      const text = await api.scanCodebase(projectId);
      clearInterval(timerRef.current);
      setResult(text);
      setPhase('preview');
    } catch (e) {
      clearInterval(timerRef.current);
      setError(e.message);
      setPhase('error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveScanResult(projectId, result, mode);
      setPhase('saved');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    setPhase('idle');
    setResult('');
    setError(null);
    setElapsed(0);
    startRef.current = null;
  };

  const handleRescan = () => {
    handleStart();
  };

  const isScanning = phase === 'scanning';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={isScanning ? undefined : onClose}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ScanSearch size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold">{t('scan.title')}</h2>
            {phase === 'preview' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                {t('scan.review')}
              </span>
            )}
            {phase === 'saved' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                {t('scan.saved')}
              </span>
            )}
          </div>
          {phase !== 'idle' && (
            <div className="flex items-center gap-3 text-[10px] text-surface-500 ml-auto mr-3">
              <span className="flex items-center gap-1">
                <Clock size={10} className={isScanning ? 'text-amber-400' : ''} />
                {formatElapsed(elapsed)}
              </span>
              {isScanning && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
            </div>
          )}
          <button
            onClick={onClose}
            disabled={isScanning}
            className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Idle — start scan */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <ScanSearch size={32} className="text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-surface-200 font-medium">{t('scan.idleTitle')}</p>
                <p className="text-xs text-surface-500 mt-1 max-w-sm">{t('scan.idleDesc')}</p>
              </div>
            </div>
          )}

          {/* Scanning */}
          {isScanning && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Loader2 size={32} className="text-blue-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm text-surface-200 font-medium">{t('scan.scanning')}</p>
                <p className="text-xs text-surface-500 mt-1">{t('scan.scanningDesc')}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {(phase === 'preview' || phase === 'saved') && result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-surface-400">{t('scan.resultPreview')}</label>
                <span className="text-[10px] text-surface-600">{result.length} chars</span>
              </div>
              <pre className="text-xs text-surface-300 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-4 border border-surface-700/50 leading-relaxed max-h-[50vh] overflow-y-auto">
                {result}
              </pre>

              {/* Mode selector — only in preview */}
              {phase === 'preview' && (
                <div>
                  <label className="text-xs font-medium text-surface-400 mb-1.5 block">{t('scan.writeMode')}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('overwrite')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'overwrite' ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30' : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}
                    >
                      <FileText size={12} />
                      {t('scan.overwrite')}
                    </button>
                    <button
                      onClick={() => setMode('append')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'append' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-surface-800 text-surface-500 hover:text-surface-300'}`}
                    >
                      <Plus size={12} />
                      {t('scan.append')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-medium">{t('scan.failed')}</p>
                <p className="text-[11px] text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-surface-800 flex-shrink-0">
          {phase === 'idle' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <ScanSearch size={14} /> {t('scan.startScan')}
              </button>
            </>
          )}
          {isScanning && (
            <div className="flex-1 text-center text-xs text-surface-500 py-2">{t('scan.cannotClose')}</div>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={handleDiscard}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> {t('scan.discard')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? t('common.saving') : t('scan.saveToClaudeMd')}
              </button>
            </>
          )}
          {phase === 'saved' && (
            <>
              <button
                onClick={handleRescan}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <RefreshCw size={14} /> {t('scan.rescan')}
              </button>
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                <CheckCircle2 size={14} /> {t('common.close')}
              </button>
            </>
          )}
          {phase === 'error' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <RefreshCw size={14} /> {t('scan.retry')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
