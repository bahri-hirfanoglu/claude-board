import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { getTagColor } from '../../lib/constants';

export default function TagInput({ value = [], onChange, suggestions = [], placeholder = 'Add tag...' }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const filtered = suggestions
    .filter(s => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 8);

  const addTag = (tag) => {
    const trimmed = tag.trim().toLowerCase().replace(/[^\p{L}\p{N}\-:_]/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center bg-surface-800/50 border border-surface-700/30 rounded-lg px-2 py-1.5 min-h-[32px]"
        onClick={() => inputRef.current?.focus()}>
        {value.map(tag => {
          const color = getTagColor(tag);
          return (
            <span key={tag} className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
              {tag}
              <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                className="hover:text-white ml-0.5">
                <X size={8} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="bg-transparent text-xs text-surface-300 outline-none flex-1 min-w-[60px] placeholder:text-surface-600"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-700 rounded-lg py-1 shadow-xl z-20 max-h-[160px] overflow-y-auto">
          {filtered.map(tag => (
            <button key={tag}
              onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors">
              <Plus size={10} className="text-surface-500" />
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTagColor(tag)}`}>{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
