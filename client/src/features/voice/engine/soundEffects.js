/**
 * Minimal sound effects using Web Audio API OscillatorNode.
 * No audio files needed.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx && typeof AudioContext !== 'undefined') {
    _ctx = new AudioContext();
  }
  return _ctx;
}

function beep(freq, duration = 0.08, startTime = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.15, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration + 0.01);
}

/** Rising two-tone — listening started */
export function playStartBeep() {
  beep(520, 0.07, 0);
  beep(780, 0.09, 0.08);
}

/** Falling tone — listening stopped */
export function playStopBeep() {
  beep(660, 0.07, 0);
  beep(440, 0.09, 0.08);
}

/** Short low buzz — error */
export function playErrorBeep() {
  beep(220, 0.15, 0);
}
