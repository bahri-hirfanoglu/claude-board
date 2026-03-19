import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function useVoiceInput({ lang = 'tr-TR', continuous = false, onResult, onEnd } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(!!SpeechRecognition);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  // Keep latest callbacks in refs to avoid stale closures
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    manualStopRef.current = false;

    recognition.onstart = () => {
      setIsListening(true);
      setInterim('');
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      setInterim(interimText);

      if (finalText) {
        onResultRef.current?.(finalText);
        setInterim('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
      setInterim('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
      onEndRef.current?.();
      // Auto-restart if continuous and not manually stopped
      if (continuous && !manualStopRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 100);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start error:', e);
      setIsListening(false);
    }
  }, [lang, continuous]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  return { isListening, isSupported, interim, start, stop, toggle };
}
