import { Cpu, Coins } from 'lucide-react';
import { MODEL_COSTS } from '../../lib/constants';

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export default function TokenEstimate({ title, description, acceptanceCriteria, model }) {
  const fullText = (title + ' ' + description + ' ' + acceptanceCriteria).trim();
  const tokens = estimateTokens(fullText);
  if (tokens < 10) return null;

  const cost = MODEL_COSTS[model];
  const inputCost = (tokens / 1e6) * cost.input;

  return (
    <div className="flex items-center gap-3 text-[11px] text-surface-500">
      <span className="flex items-center gap-1">
        <Cpu size={10} />~{tokens.toLocaleString()} tokens
      </span>
      <span className="flex items-center gap-1">
        <Coins size={10} />
        ~${inputCost < 0.001 ? '<0.001' : inputCost.toFixed(4)} input
      </span>
      <span className="text-surface-600">{description.length} chars</span>
    </div>
  );
}
