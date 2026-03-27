import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Copy,
  Search,
  AlertTriangle,
  History,
  Check,
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

function estimateTime(fileCount) {
  if (fileCount <= 100) return '~30s';
  if (fileCount <= 500) return '~1 min';
  if (fileCount <= 2000) return '~2 min';
  if (fileCount <= 5000) return '~3 min';
  return '~5+ min';
}

const SCAN_TYPES = [
  { key: 'quick', icon: '⚡' },
  { key: 'detailed', icon: '🔍' },
  { key: 'apiDocs', icon: '📡' },
  { key: 'architecture', icon: '🏗️' },
  { key: 'custom', icon: '✏️' },
];

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

  // Scan type
  const [scanType, setScanType] = useState('detailed');
  const [customPrompt, setCustomPrompt] = useState('');

  // Pre-scan stats
  const [prescan, setPrescan] = useState(null);
  const [prescanLoading, setPrescanLoading] = useState(false);

  // Progress phase text
  const [progressText, setProgressText] = useState('');

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  // Copy
  const [copied, setCopied] = useState(false);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null);
  const [diffMode, setDiffMode] = useState(false);

  const textareaRef = useRef(null);

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

  // Load pre-scan stats on mount
  useEffect(() => {
    if (phase !== 'idle') return;
    setPrescanLoading(true);
    (api.prescanStats ? api.prescanStats(projectId) : Promise.resolve(null))
      .then((data) => {
        if (data) setPrescan(data);
      })
      .catch(() => {})
      .finally(() => setPrescanLoading(false));
  }, [projectId, phase]);

  // Listen for scan events
  useEffect(() => {
    const unsubs = [
      tauriListen('scan:started', (data) => {
        if (data.projectId !== projectId) return;
        setProgressText(t('scan.analyzing'));
      }),
      tauriListen('scan:stats', (data) => {
        if (data.projectId !== projectId) return;
        setPrescan((prev) => ({
          ...prev,
          fileCount: data.fileCount,
          projectTypes: data.projectTypes || prev?.projectTypes,
        }));
      }),
      tauriListen('scan:progress', (data) => {
        if (data.projectId !== projectId) return;
        setProgressText(data.message || data.phase || '');
      }),
      tauriListen('scan:completed', (data) => {
        if (data.projectId !== projectId) return;
        clearInterval(timerRef.current);
        if (data.result) {
          setResult(data.result);
          setPhase('preview');
          setProgressText('');
        }
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [projectId, t]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && (phase === 'preview' || phase === 'saved')) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, showSearch]);

  const handleStart = async () => {
    setPhase('scanning');
    setResult('');
    setError(null);
    setElapsed(0);
    setProgressText(t('scan.collectingStats'));
    startRef.current = Date.now();
    setViewingHistoryItem(null);
    setDiffMode(false);
    try {
      const text = await api.scanCodebase(projectId, scanType, scanType === 'custom' ? customPrompt : null);
      clearInterval(timerRef.current);
      setResult(text);
      setPhase('preview');
      setProgressText('');
    } catch (e) {
      clearInterval(timerRef.current);
      setError(e.message);
      setPhase('error');
      setProgressText('');
    }
  };

  const handleCancel = async () => {
    clearInterval(timerRef.current);
    setPhase('idle');
    setProgressText('');
    setElapsed(0);
    startRef.current = null;
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
    setViewingHistoryItem(null);
    setDiffMode(false);
  };

  const handleRescan = () => {
    handleStart();
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  // History
  const loadHistory = useCallback(async () => {
    if (!api.getScanHistory) return;
    setHistoryLoading(true);
    try {
      const data = await api.getScanHistory(projectId);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
    setHistoryLoading(false);
  }, [projectId]);

  const handleToggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  };

  const handleDeleteScan = async (id) => {
    if (!api.deleteScan) return;
    try {
      await api.deleteScan(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (viewingHistoryItem?.id === id) {
        setViewingHistoryItem(null);
        setDiffMode(false);
      }
    } catch {}
  };

  const handleViewHistoryItem = async (item) => {
    if (viewingHistoryItem?.id === item.id) {
      setViewingHistoryItem(null);
      setDiffMode(false);
      return;
    }
    if (api.getScanDetail && !item.content) {
      try {
        const detail = await api.getScanDetail(item.id);
        setViewingHistoryItem(detail);
      } catch {
        setViewingHistoryItem(item);
      }
    } else {
      setViewingHistoryItem(item);
    }
  };

  const handleCompare = () => {
    setDiffMode(!diffMode);
  };

  // Word count
  const wordCount = useMemo(() => {
    if (!result) return 0;
    return result
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }, [result]);

  // Search highlight logic
  const highlightedResult = useMemo(() => {
    if (!searchQuery || !result) return null;
    const parts = [];
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(result)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: result.slice(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[1], highlight: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < result.length) {
      parts.push({ text: result.slice(lastIndex), highlight: false });
    }
    return parts.length > 0 ? parts : null;
  }, [searchQuery, result]);

  const searchMatchCount = useMemo(() => {
    if (!searchQuery || !result) return 0;
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (result.match(regex) || []).length;
  }, [searchQuery, result]);

  const isScanning = phase === 'scanning';
  const isLargeCodebase = prescan?.fileCount > 5000;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={isScanning ? undefined : onClose}
    >
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
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
          <div className="flex items-center gap-2 ml-auto">
            {phase !== 'idle' && (
              <div className="flex items-center gap-3 text-[10px] text-surface-500 mr-1">
                <span className="flex items-center gap-1">
                  <Clock size={10} className={isScanning ? 'text-amber-400' : ''} />
                  {formatElapsed(elapsed)}
                </span>
                {isScanning && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
              </div>
            )}
            <button
              onClick={handleToggleHistory}
              className={`p-1 rounded-lg hover:bg-surface-800 transition-colors ${showHistory ? 'text-blue-400' : 'text-surface-400'}`}
              title={t('scan.history')}
            >
              <History size={16} />
            </button>
            <button
              onClick={onClose}
              disabled={isScanning}
              className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 disabled:opacity-30"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Scan Type Presets — show in idle */}
          {phase === 'idle' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {SCAN_TYPES.map(({ key, icon }) => (
                  <button
                    key={key}
                    onClick={() => setScanType(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      scanType === key
                        ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                        : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
                    }`}
                  >
                    <span className="text-sm">{icon}</span>
                    {t(`scan.${key}`)}
                  </button>
                ))}
              </div>

              {/* Custom prompt textarea */}
              {scanType === 'custom' && (
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t('scan.customPromptPlaceholder')}
                  className="w-full h-24 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-200 placeholder-surface-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              )}

              {/* Pre-scan stats */}
              {prescanLoading ? (
                <div className="flex items-center gap-2 text-xs text-surface-500 py-2">
                  <Loader2 size={12} className="animate-spin" />
                  {t('scan.collectingStats')}
                </div>
              ) : prescan ? (
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-surface-300">
                      <FileText size={12} className="text-blue-400" />
                      {prescan.fileCount != null
                        ? t('scan.filesDetected', { count: prescan.fileCount })
                        : t('scan.prescanInfo')}
                    </span>
                    {prescan.projectTypes && prescan.projectTypes.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {prescan.projectTypes.map((type) => (
                          <span
                            key={type}
                            className="px-1.5 py-0.5 rounded bg-surface-700 text-surface-300 text-[10px] font-medium"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {prescan.fileCount != null && (
                    <div className="flex items-center gap-1.5 text-[11px] text-surface-500">
                      <Clock size={10} />
                      {t('scan.estimatedTime')}: {estimateTime(prescan.fileCount)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <ScanSearch size={28} className="text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-surface-200 font-medium">{t('scan.idleTitle')}</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-sm">{t('scan.idleDesc')}</p>
                  </div>
                </div>
              )}

              {/* Large codebase warning */}
              {isLargeCodebase && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-400 font-medium">
                      {t('scan.largeCodebaseWarning', { count: prescan?.fileCount })}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scanning */}
          {isScanning && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Loader2 size={32} className="text-blue-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm text-surface-200 font-medium">{t('scan.scanning')}</p>
                <p className="text-xs text-surface-500 mt-1">{progressText || t('scan.scanningDesc')}</p>
              </div>
              {/* Indeterminate progress bar */}
              <div className="w-full max-w-xs h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-scan-progress" />
              </div>
              <p className="text-[10px] text-surface-600">{formatElapsed(elapsed)}</p>
            </div>
          )}

          {/* Preview */}
          {(phase === 'preview' || phase === 'saved') && result && (
            <div className="space-y-3">
              {/* Search bar */}
              {showSearch && (
                <div className="flex items-center gap-2 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5">
                  <Search size={12} className="text-surface-500" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('scan.searchPlaceholder')}
                    className="flex-1 bg-transparent text-xs text-surface-200 placeholder-surface-600 outline-none"
                  />
                  {searchQuery && (
                    <span className="text-[10px] text-surface-500">
                      {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="p-0.5 rounded hover:bg-surface-700 text-surface-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-surface-400">{t('scan.editPreview')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-600">
                    {t('scan.wordCount')}: {wordCount}
                  </span>
                  <button
                    onClick={() => {
                      setShowSearch(true);
                      setTimeout(() => searchRef.current?.focus(), 50);
                    }}
                    className="p-1 rounded hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
                    title={t('scan.search')}
                  >
                    <Search size={12} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors"
                    title={t('scan.copyToClipboard')}
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* Diff view */}
              {diffMode && viewingHistoryItem?.content ? (
                <div className="grid grid-cols-2 gap-2 max-h-[45vh]">
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 font-medium">{t('scan.history')} (old)</p>
                    <pre className="text-xs text-surface-400 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-3 border border-surface-700/50 leading-relaxed overflow-y-auto h-full max-h-[40vh]">
                      {viewingHistoryItem.content}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-surface-500 font-medium">Current</p>
                    <pre className="text-xs text-surface-300 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-3 border border-surface-700/50 leading-relaxed overflow-y-auto h-full max-h-[40vh]">
                      {result}
                    </pre>
                  </div>
                </div>
              ) : searchQuery && highlightedResult ? (
                <div className="text-xs text-surface-300 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-4 border border-surface-700/50 leading-relaxed max-h-[50vh] overflow-y-auto">
                  {highlightedResult.map((part, i) =>
                    part.highlight ? (
                      <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="w-full text-xs text-surface-300 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-4 border border-surface-700/50 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  style={{ minHeight: '200px', maxHeight: '50vh' }}
                  readOnly={phase === 'saved'}
                />
              )}

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

          {/* History Panel */}
          {showHistory && (
            <div className="border-t border-surface-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-surface-400 flex items-center gap-1.5">
                  <History size={12} />
                  {t('scan.history')}
                  {history.length > 0 && <span className="text-[10px] text-surface-600">({history.length})</span>}
                </h3>
              </div>
              {historyLoading ? (
                <div className="flex items-center gap-2 text-xs text-surface-500 py-3 justify-center">
                  <Loader2 size={12} className="animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-surface-600 py-3 text-center">{t('scan.noHistory')}</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        viewingHistoryItem?.id === item.id
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-surface-800/50 hover:bg-surface-800 border border-transparent'
                      }`}
                      onClick={() => handleViewHistoryItem(item)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-surface-300">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : item.date || 'Unknown'}
                        </span>
                        {item.scanType && <span className="ml-2 text-surface-500">- {item.scanType}</span>}
                        {item.fileCount != null && (
                          <span className="ml-1 text-surface-600">({item.fileCount} files)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {result && viewingHistoryItem?.id === item.id && viewingHistoryItem?.content && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompare();
                            }}
                            className={`p-1 rounded hover:bg-surface-700 transition-colors ${diffMode ? 'text-blue-400' : 'text-surface-500'}`}
                            title="Compare"
                          >
                            <FileText size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScan(item.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Viewing history item content (not in diff mode) */}
              {viewingHistoryItem?.content && !diffMode && !(phase === 'preview' || phase === 'saved') && (
                <pre className="text-xs text-surface-400 whitespace-pre-wrap bg-surface-800/30 rounded-lg p-3 border border-surface-700/30 leading-relaxed max-h-48 overflow-y-auto mt-2">
                  {viewingHistoryItem.content}
                </pre>
              )}
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
                disabled={scanType === 'custom' && !customPrompt.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ScanSearch size={14} /> {t('scan.startScan')}
              </button>
            </>
          )}
          {isScanning && (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              {t('scan.cancel')}
            </button>
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
                onClick={handleRescan}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <RefreshCw size={14} /> {t('scan.rescan')}
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

      {/* Inline animation style */}
      <style>{`
        @keyframes scan-progress {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 40%; margin-left: 30%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-scan-progress {
          animation: scan-progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
