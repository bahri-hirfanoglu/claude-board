import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

// ─── Elapsed time counter ───
export function ElapsedTime({ startedAt, isRunning, workDurationMs = 0, lastResumedAt = null }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      let diff;
      if (workDurationMs > 0 || lastResumedAt) {
        diff = workDurationMs || 0;
        if (lastResumedAt) {
          diff += Date.now() - new Date(lastResumedAt).getTime();
        }
      } else {
        diff = Date.now() - new Date(startedAt).getTime();
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };
    update();
    if (isRunning || lastResumedAt) {
      const iv = setInterval(update, 1000);
      return () => clearInterval(iv);
    }
  }, [startedAt, isRunning, workDurationMs, lastResumedAt]);

  if (!elapsed) return null;
  return (
    <span className="flex items-center gap-0.5" title="Elapsed time">
      <Timer size={9} />
      {elapsed}
    </span>
  );
}
