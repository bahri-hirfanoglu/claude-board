/**
 * Text-to-Speech engine with Chrome workarounds.
 * Returns promises so callers can await speech completion.
 */

let _cachedVoices = [];

function loadVoices() {
  if (!window.speechSynthesis) return;
  _cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/** Cancel + resume to unstick Chrome's synthesis engine */
function unstick() {
  const s = window.speechSynthesis;
  s.cancel();
  s.resume();
}

/**
 * Speak text aloud. Resolves when utterance finishes.
 * @param {string} text
 * @param {string} [lang='en-US']
 * @returns {Promise<void>}
 */
export function speak(text, lang = 'en-US') {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();

  unstick();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    loadVoices();
    const voice = _cachedVoices.find(v => v.lang.startsWith('en'))
      || _cachedVoices.find(v => v.lang.startsWith('en'));
    if (voice) utterance.voice = voice;

    // Chrome pauses long utterances after ~15s — keep-alive workaround
    let keepAlive;

    utterance.onend = () => { clearInterval(keepAlive); resolve(); };
    utterance.onerror = () => { clearInterval(keepAlive); resolve(); };

    setTimeout(() => {
      synth.speak(utterance);
      keepAlive = setInterval(() => {
        if (!synth.speaking) { clearInterval(keepAlive); return; }
        synth.pause();
        synth.resume();
      }, 10000);
    }, 80);
  });
}

/** Immediately cancel any ongoing speech */
export function cancelSpeech() {
  window.speechSynthesis?.cancel();
}

/** @returns {boolean} Whether TTS is supported */
export function isTtsSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}
