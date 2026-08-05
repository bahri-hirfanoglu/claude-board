import { useState, useCallback } from 'react';
import { TOAST_TIMEOUT_MS } from '../lib/constants';

// Monotonic counter rather than a timestamp: several toasts can be queued in the
// same millisecond (e.g. a burst of API errors), and duplicate ids would collide
// as React keys and let one toast's expiry timer remove its siblings.
let nextToastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++nextToastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_TIMEOUT_MS);
  }, []);

  return { toasts, addToast };
}
