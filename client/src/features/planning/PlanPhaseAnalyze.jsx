import {
  Clock, Zap, Terminal, Hash, ChevronDown, ChevronRight, Brain,
} from 'lucide-react';
import { formatElapsed } from './planningHelpers';
import { formatTokens } from '../../lib/formatters';
import { PlanLogFeed } from './PlanLogFeed';
import { SubPhaseIndicator } from './SubPhaseIndicator';
import MDEditor from '@uiw/react-md-editor';

function MdPreview({ content }) {
  if (!content) return null;
  return (
    <div data-color-mode="dark" className="md-preview-compact">
      <MDEditor.Markdown source={content} style={{ backgroundColor: 'transparent', color: '#a8a29e', fontSize: '11px', lineHeight: '1.5' }} />
    </div>
  );
}

export function PlanPhaseAnalyze({
  stats, topic, planPhase, logs, analysis,
  showAnalysis, setShowAnalysis, isActive, t,
}) {
  const totalTokens = stats.tokens.input + stats.tokens.output;

  return (
    <div className="space-y-3">

      {/* Stats Bar */}
      <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl px-4 py-2.5 flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Clock size={12} />
          <span className="font-medium">{formatElapsed(stats.elapsed)}</span>
        </div>
        {totalTokens > 0 && (
          <div className="flex items-center gap-1.5 text-surface-400">
            <Zap size={12} />
            <span>{formatTokens(totalTokens)}</span>
          </div>
        )}
        {stats.toolCalls > 0 && (
          <div className="flex items-center gap-1.5 text-surface-400">
            <Terminal size={12} />
            <span>{stats.toolCalls} {t('planning.tools')}</span>
          </div>
        )}
        {stats.turns > 0 && (
          <div className="flex items-center gap-1.5 text-surface-400">
            <Hash size={12} />
            <span>{stats.turns} {t('planning.turns')}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] text-surface-500">Active</span>
        </div>
      </div>

      {/* Topic Reminder */}
      {topic && (
        <div className="bg-surface-800/30 border border-surface-700/20 rounded-lg px-3.5 py-2.5">
          <p className="text-[10px] text-surface-600 font-medium uppercase tracking-wide">{t('planning.planning')}</p>
          <p className="text-xs text-surface-300 mt-1 line-clamp-2">{topic}</p>
        </div>
      )}

      {/* Sub-phase indicator */}
      <SubPhaseIndicator planPhase={planPhase} />

      {/* Live Activity Feed */}
      <div className="bg-surface-950/80 border border-surface-800/60 rounded-xl overflow-hidden">
        <div className="p-2.5 max-h-64 overflow-y-auto">
          <PlanLogFeed logs={logs} isActive={isActive} />
        </div>
      </div>

      {/* Analysis Preview */}
      {analysis && (
        <div>
          <button onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 mb-1.5 hover:text-surface-300 transition-colors">
            {showAnalysis ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Brain size={12} className="text-purple-400" />
            {t('planning.claudeOutput')}
          </button>
          {showAnalysis && (
            <div className="bg-surface-800/40 border border-surface-700/30 rounded-xl p-4 max-h-40 overflow-y-auto">
              <MdPreview content={analysis} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
