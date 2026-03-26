import { Hash } from 'lucide-react';
import { getTagColor } from '../../lib/constants';

export default function TagBadge({ tag, size = 'sm', onClick, className = '' }) {
  const color = getTagColor(tag);
  const isPlan = tag.startsWith('plan:');
  const sizeClass = size === 'xs' ? 'text-[8px] px-1 py-0' : 'text-[9px] px-1.5 py-0.5';

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 rounded font-medium ${sizeClass} ${color} ${onClick ? 'cursor-pointer hover:brightness-125' : ''} ${className}`}
    >
      {isPlan ? <Hash size={size === 'xs' ? 7 : 8} /> : null}
      {tag}
    </span>
  );
}

export function parseTags(tagsField) {
  if (!tagsField) return [];
  if (Array.isArray(tagsField)) return tagsField;
  try {
    return JSON.parse(tagsField);
  } catch {
    return [];
  }
}

export function TagList({ tags, max = 3, size = 'sm', onTagClick }) {
  const parsed = parseTags(tags);
  if (parsed.length === 0) return null;
  const shown = parsed.slice(0, max);
  const extra = parsed.length - max;
  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap">
      {shown.map((tag) => (
        <TagBadge key={tag} tag={tag} size={size} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
      ))}
      {extra > 0 && <span className="text-[8px] text-surface-600">+{extra}</span>}
    </span>
  );
}
