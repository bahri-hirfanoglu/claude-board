import { useRef, useEffect } from 'react';

/**
 * Canvas-based audio waveform visualizer.
 * Reads frequency data from an AnalyserNode and draws bars.
 */
export default function AudioVisualizer({ getAnalyser, isActive, className = '' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = getAnalyser?.();

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!analyser) {
        // Fallback: animated sine wave when no analyser available
        const t = Date.now() / 200;
        const barCount = 24;
        const barW = w / barCount - 1;
        for (let i = 0; i < barCount; i++) {
          const val = (Math.sin(t + i * 0.4) + 1) * 0.3 + 0.1;
          const barH = val * h;
          const x = i * (barW + 1);
          ctx.fillStyle = `rgba(218, 119, 86, ${0.4 + val * 0.5})`;
          ctx.beginPath();
          ctx.roundRect(x, h - barH, barW, barH, 1.5);
          ctx.fill();
        }
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(data);

      const barCount = Math.min(32, bufferLength);
      const barW = w / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        const val = data[i] / 255;
        const barH = Math.max(2, val * h);
        const x = i * (barW + 1);
        const alpha = 0.3 + val * 0.7;
        ctx.fillStyle = `rgba(218, 119, 86, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, h - barH, barW, barH, 1.5);
        ctx.fill();
      }
    }

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, getAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={28}
      className={`${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
