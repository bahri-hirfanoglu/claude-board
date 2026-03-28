import { useState, useRef, useEffect } from 'react';

export default function Tooltip({ children, text, position = 'bottom', delay = 300, shortcut }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    let top, left;

    switch (position) {
      case 'top':
        top = trigger.top - tip.height - 6;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case 'left':
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.left - tip.width - 6;
        break;
      case 'right':
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.right + 6;
        break;
      default:
        // bottom
        top = trigger.bottom + 6;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
    }

    // Keep within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 4) left = 4;
    if (left + tip.width > vw - 4) left = vw - tip.width - 4;
    if (top < 4) top = 4;
    if (top + tip.height > vh - 4) top = vh - tip.height - 4;

    setCoords({ top, left });
  }, [visible, position]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!text) return children;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] px-2.5 py-1.5 rounded-lg bg-surface-950 border border-surface-700 shadow-xl text-xs text-surface-200 whitespace-nowrap pointer-events-none animate-[fade-tooltip_0.15s_ease-out_both]"
          style={{ top: coords.top, left: coords.left }}
        >
          <span>{text}</span>
          {shortcut && (
            <kbd className="ml-2 px-1 py-0.5 text-[10px] bg-surface-800 text-surface-400 rounded border border-surface-700 font-mono">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </>
  );
}
