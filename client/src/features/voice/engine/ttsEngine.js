/**
 * Text-to-Speech engine — robust voice selection for Tauri/WebView2 on Windows.
 */

let _voices = [];
let _voicesReady = false;

// Language name keywords for fallback voice matching by name
const LANG_NAME_KEYWORDS = {
  en: ['english', 'david', 'zira', 'mark', 'james', 'jenny'],
  tr: ['turkish', 'tolga', 'emel'],
  de: ['german', 'deutsch', 'hedda', 'katja', 'stefan'],
  fr: ['french', 'français', 'hortense', 'paul', 'denise'],
  es: ['spanish', 'español', 'helena', 'pablo', 'laura'],
  pt: ['portuguese', 'português', 'daniel', 'francisca'],
  it: ['italian', 'italiano', 'cosimo', 'elsa'],
  nl: ['dutch', 'nederlands'],
  pl: ['polish', 'polski', 'paulina'],
  ru: ['russian', 'русский', 'irina', 'pavel'],
  ja: ['japanese', '日本語', 'haruka', 'ichiro', 'nanami'],
  ko: ['korean', '한국어', 'heami', 'sunhi'],
  zh: ['chinese', '中文', 'huihui', 'kangkang', 'xiaoxiao'],
  ar: ['arabic', 'العربية', 'hoda', 'naayf'],
  hi: ['hindi', 'हिन्दी', 'hemant', 'kalpana'],
};

function refreshVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) {
    _voices = v;
    _voicesReady = true;
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function ensureVoices() {
  if (_voicesReady) return Promise.resolve();
  return new Promise((resolve) => {
    refreshVoices();
    if (_voicesReady) { resolve(); return; }
    let attempts = 0;
    const check = setInterval(() => {
      refreshVoices();
      attempts++;
      if (_voicesReady || attempts > 20) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

/**
 * Find best voice for target language using 3 strategies:
 * 1. Lang code match (v.lang === 'en-US' or starts with 'en')
 * 2. Voice name keyword match ("Microsoft David - English")
 * 3. Give up → return null (browser will use system default)
 */
function findVoice(targetLang) {
  if (_voices.length === 0) return null;

  const target = targetLang.toLowerCase().replace('_', '-');
  const prefix = target.split('-')[0];

  // Strategy 1: Match by lang code
  let best = null;
  let bestScore = -1;

  for (const v of _voices) {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    const vPrefix = vLang.split('-')[0];

    if (vPrefix !== prefix) continue;

    let score = 1;
    if (vLang === target) score += 10;
    if (v.localService) score += 2;

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  if (best) return best;

  // Strategy 2: Match by voice name keywords
  const keywords = LANG_NAME_KEYWORDS[prefix];
  if (keywords) {
    for (const v of _voices) {
      const name = (v.name || '').toLowerCase();
      if (keywords.some(kw => name.includes(kw))) {
        return v;
      }
    }
  }

  return null;
}

function unstick() {
  const s = window.speechSynthesis;
  s.cancel();
  s.resume();
}

/**
 * Speak text aloud in the specified language.
 */
export async function speak(text, lang = 'en-US') {
  const synth = window.speechSynthesis;
  if (!synth) return;

  await ensureVoices();
  unstick();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = lang;

    const voice = findVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    let keepAlive;
    utterance.onend = () => { clearInterval(keepAlive); resolve(); };
    utterance.onerror = () => { clearInterval(keepAlive); resolve(); };

    synth.speak(utterance);
    keepAlive = setInterval(() => {
      if (!synth.speaking) { clearInterval(keepAlive); return; }
      synth.pause();
      synth.resume();
    }, 10000);
  });
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel();
}

export function isTtsSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/** Debug: log all available voices to console */
export function debugVoices() {
  refreshVoices();
  console.table(_voices.map(v => ({ name: v.name, lang: v.lang, local: v.localService, default: v.default })));
  return _voices.length;
}
