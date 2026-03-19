/**
 * Speech-to-text audio analyser for waveform visualization.
 * Provides an AnalyserNode that AudioVisualizer can read from.
 */

let _audioCtx = null;
let _analyser = null;
let _stream = null;

/**
 * Start capturing microphone audio for visualization.
 * @returns {Promise<AnalyserNode|null>}
 */
export async function startAudioCapture() {
  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _audioCtx = new AudioContext();
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 256;
    _analyser.smoothingTimeConstant = 0.7;

    const source = _audioCtx.createMediaStreamSource(_stream);
    source.connect(_analyser);

    return _analyser;
  } catch {
    return null;
  }
}

/** Stop capturing and release the microphone stream */
export function stopAudioCapture() {
  if (_stream) {
    _stream.getTracks().forEach(t => t.stop());
    _stream = null;
  }
  if (_audioCtx) {
    _audioCtx.close().catch(() => {});
    _audioCtx = null;
  }
  _analyser = null;
}

/** @returns {AnalyserNode|null} */
export function getAnalyser() {
  return _analyser;
}
