import { useState, useEffect, useCallback } from 'react';

export function useTerminalTabs(tasks) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [layout, setLayout] = useState('side');
  const [bottomHeight, setBottomHeight] = useState(300);

  // Keep tabs in sync with task data
  useEffect(() => {
    setTabs(prev => prev.map(tab => {
      const updated = tasks.find(t => t.id === tab.id);
      return updated ? { ...tab, ...updated } : tab;
    }));
  }, [tasks]);

  const openTab = useCallback((task) => {
    setTabs(prev => prev.find(t => t.id === task.id) ? prev : [...prev, task]);
    setActiveTabId(task.id);
  }, []);

  const closeTab = useCallback((taskId) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== taskId);
      if (taskId === activeTabId) {
        const next = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        setActiveTabId(next?.id || null);
      }
      return remaining;
    });
  }, [activeTabId]);

  const closeAll = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const hasOpenTabs = tabs.length > 0;

  return {
    tabs, activeTabId, activeTab, hasOpenTabs,
    layout, bottomHeight,
    setActiveTabId, setLayout, setBottomHeight,
    openTab, closeTab, closeAll,
  };
}
