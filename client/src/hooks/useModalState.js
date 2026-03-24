import { useState, useCallback } from 'react';

export function useModalState(initial = {}) {
  const [modals, setModals] = useState(initial);

  const openModal = useCallback((name, data = true) => {
    setModals(prev => ({ ...prev, [name]: data }));
  }, []);

  const closeModal = useCallback((name) => {
    setModals(prev => ({ ...prev, [name]: null }));
  }, []);

  return { modals, openModal, closeModal };
}
