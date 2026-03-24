import { useState, useEffect, useCallback } from 'react';

export function useTerminalTabs(tasks) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [layout, setLayout] = useState('bottom');
  const [bottomHeight, setBottomHeight] = useState(300);
  const [splitMode, setSplitMode] = useState(null); // null | 'vertical' | 'horizontal'
  const [splitTabId, setSplitTabId] = useState(null);

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
      if (taskId === splitTabId) {
        setSplitTabId(null);
        setSplitMode(null);
      }
      return remaining;
    });
  }, [activeTabId, splitTabId]);

  const closeAll = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    setSplitTabId(null);
    setSplitMode(null);
  }, []);

  const toggleSplit = useCallback((mode) => {
    if (splitMode === mode) {
      setSplitMode(null);
      setSplitTabId(null);
    } else {
      setSplitMode(mode);
      // Auto-select a second tab if not set
      if (!splitTabId) {
        const other = tabs.find(t => t.id !== activeTabId);
        if (other) setSplitTabId(other.id);
      }
    }
  }, [splitMode, splitTabId, tabs, activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const splitTab = tabs.find(t => t.id === splitTabId) || null;
  const hasOpenTabs = tabs.length > 0;

  return {
    tabs, activeTabId, activeTab, hasOpenTabs,
    layout, bottomHeight,
    splitMode, splitTabId, splitTab,
    setActiveTabId, setLayout, setBottomHeight,
    setSplitTabId, setSplitMode, toggleSplit,
    openTab, closeTab, closeAll,
  };
}
