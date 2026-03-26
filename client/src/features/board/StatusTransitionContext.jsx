import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';

const StatusTransitionContext = createContext(null);

// Module-level event bus for recording transitions from outside React tree
let _recordFn = null;
export function emitStatusTransition(taskId, fromStatus, toStatus) {
  _recordFn?.(taskId, fromStatus, toStatus);
}

export function StatusTransitionProvider({ children }) {
  const [transitions, setTransitions] = useState({});
  const timeoutsRef = useRef({});

  const recordTransition = useCallback((taskId, fromStatus, toStatus) => {
    setTransitions((prev) => ({
      ...prev,
      [taskId]: { from: fromStatus, to: toStatus, timestamp: Date.now() },
    }));

    if (timeoutsRef.current[taskId]) {
      clearTimeout(timeoutsRef.current[taskId]);
    }
    timeoutsRef.current[taskId] = setTimeout(() => {
      setTransitions((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      delete timeoutsRef.current[taskId];
    }, 2000);
  }, []);

  // Register the record function for external use
  useEffect(() => {
    _recordFn = recordTransition;
    return () => {
      _recordFn = null;
    };
  }, [recordTransition]);

  const getTransition = useCallback(
    (taskId) => {
      return transitions[taskId] || null;
    },
    [transitions],
  );

  return (
    <StatusTransitionContext.Provider value={{ recordTransition, getTransition }}>
      {children}
    </StatusTransitionContext.Provider>
  );
}

export function useStatusTransition() {
  return useContext(StatusTransitionContext);
}
