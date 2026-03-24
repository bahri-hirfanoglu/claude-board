import { useState, useCallback } from 'react';
import { TOAST_TIMEOUT_MS } from '../lib/constants';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_TIMEOUT_MS);
  }, []);

  return { toasts, addToast };
}
