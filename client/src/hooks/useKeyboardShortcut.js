import { useEffect, useRef } from 'react';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Keyboard shortcut hook for voice activation.
 * @param {{ key: string, onActivate: () => void, onDeactivate?: () => void, mode?: 'hold'|'toggle', enabled?: boolean }} opts
 */
export function useKeyboardShortcut({ key = 'v', onActivate, onDeactivate, mode = 'toggle', enabled = true }) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      return INPUT_TAGS.has(el.tagName) || el.contentEditable === 'true';
    }

    function handleKeyDown(e) {
      if (isInputFocused()) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (e.repeat) return;

      // Require Alt+key for single-letter keys to avoid conflicts
      if (key.length === 1 && !e.altKey) return;

      e.preventDefault();

      if (mode === 'hold') {
        if (!activeRef.current) {
          activeRef.current = true;
          onActivate();
        }
      } else {
        // toggle
        if (activeRef.current) {
          activeRef.current = false;
          onDeactivate?.();
        } else {
          activeRef.current = true;
          onActivate();
        }
      }
    }

    function handleKeyUp(e) {
      if (mode !== 'hold') return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (activeRef.current) {
        activeRef.current = false;
        onDeactivate?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [key, onActivate, onDeactivate, mode, enabled]);
}
