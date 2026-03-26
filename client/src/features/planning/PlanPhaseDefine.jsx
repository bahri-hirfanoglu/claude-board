import { Sparkles, Cpu, AlertCircle, Zap, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { GRANULARITIES } from './planningConstants';
import { MODEL_OPTIONS, EFFORT_OPTIONS } from '../../lib/constants';
import MDEditor from '@uiw/react-md-editor';

function MdPreview({ content }) {
  if (!content) return null;
  return (
    <div data-color-mode="dark" className="md-preview-compact">
      <MDEditor.Markdown
        source={content}
        style={{ backgroundColor: 'transparent', color: '#a8a29e', fontSize: '11px', lineHeight: '1.5' }}
      />
    </div>
  );
}

const MODELS = MODEL_OPTIONS;
const EFFORTS = EFFORT_OPTIONS;

export function PlanPhaseDefine({
  topic,
  setTopic,
  context,
  setContext,
  model,
  setModel,
  effort,
  setEffort,
  granularity,
  setGranularity,
  error,
  analysis,
  showAnalysis,
  setShowAnalysis,
  showContext,
  setShowContext,
  t,
}) {
  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-400 font-medium">{t('planning.planningFailed')}</p>
              <p className="text-[11px] text-red-400/70 mt-0.5">{error}</p>
            </div>
          </div>
          {/* Show Claude's output so user can see what went wrong */}
          {analysis && (
            <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-1.5 w-full text-left px-4 py-2.5 text-xs font-medium text-surface-400 hover:text-surface-300 transition-colors"
              >
                {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Brain size={12} /> Claude Output
              </button>
              {showAnalysis && (
                <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                  <MdPreview content={analysis} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Topic Card */}
      <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4">
        <label className="flex items-center gap-2 text-xs font-medium text-surface-300 mb-2.5">
          <Sparkles size={13} className="text-claude" />
          {t('planning.whatToBuild')}
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('planning.topicPlaceholder')}
          rows={3}
          autoFocus
          className="w-full px-3.5 py-2.5 bg-surface-900/60 border border-surface-700/40 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude/50 focus:border-claude/30 placeholder-surface-600 resize-none transition-all duration-200"
        />
      </div>

      {/* Context Toggle */}
      <div>
        <button
          onClick={() => setShowContext(!showContext)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
        >
          {showContext ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {t('planning.context')}
          <span className="text-surface-600 font-normal">({t('common.optional')})</span>
        </button>
        {showContext && (
          <div className="mt-2 bg-surface-800/40 border border-surface-700/30 rounded-xl p-4">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t('planning.contextPlaceholder')}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-surface-900/60 border border-surface-700/40 rounded-lg text-xs text-surface-300 focus:outline-none focus:ring-1 focus:ring-claude/50 focus:border-claude/30 placeholder-surface-600 resize-none transition-all duration-200"
            />
          </div>
        )}
      </div>

      {/* Configuration Cards — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Granularity Card */}
        <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
          <label className="block text-[11px] font-medium text-surface-400 mb-2">{t('planning.taskBreakdown')}</label>
          <div className="space-y-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                onClick={() => setGranularity(g.value)}
                className={`w-full px-2.5 py-2 rounded-lg text-left transition-all duration-200 border ${
                  granularity === g.value
                    ? `${g.color} ring-1 ring-current/30 border-current/20`
                    : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                }`}
              >
                <div className="text-[11px] font-semibold">{g.label}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model Card */}
        <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
          <label className="flex items-center gap-1 text-[11px] font-medium text-surface-400 mb-2">
            <Cpu size={11} /> {t('planning.model')}
          </label>
          <div className="space-y-1">
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-semibold text-left transition-all duration-200 border ${
                  model === m.value
                    ? `${m.color} ring-1 ring-current/30 border-current/20`
                    : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Effort Card */}
        <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-3">
          <label className="flex items-center gap-1 text-[11px] font-medium text-surface-400 mb-2">
            <Zap size={11} /> {t('planning.effort')}
          </label>
          <div className="space-y-1">
            {EFFORTS.map((e) => (
              <button
                key={e.value}
                onClick={() => setEffort(e.value)}
                className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-semibold text-left transition-all duration-200 border ${
                  effort === e.value
                    ? `${e.color} ring-1 ring-current/30 border-current/20`
                    : 'bg-transparent text-surface-500 hover:text-surface-300 border-transparent hover:bg-surface-800/60'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
