import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { speak, cancelSpeech } from './engine/ttsEngine';
import { playStartBeep, playStopBeep } from './engine/soundEffects';
import { startAudioCapture, stopAudioCapture, getAnalyser } from './engine/sttEngine';
import { detectIntent } from './intent/intentParser';
import { resolveCommand, getAllCommands } from './commands/commandRegistry';
import './commands/index'; // register all commands

// ─── State ───
const initial = {
  open: false,
  messages: [],
  flow: 'idle',
  draft: {},
  ttsEnabled: true,
  isSpeaking: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_OPEN':
      return { ...state, open: !state.open };
    case 'SET_OPEN':
      return { ...state, open: action.value };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.msg] };
    case 'SET_FLOW':
      return { ...state, flow: action.flow, draft: action.draft ?? state.draft };
    case 'TOGGLE_TTS':
      return { ...state, ttsEnabled: !state.ttsEnabled };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.value };
    case 'CLEAR':
      return { ...state, messages: [], flow: 'idle', draft: {}, isSpeaking: false };
    default:
      return state;
  }
}

// ─── Context ───
const VoiceCtx = createContext(null);

export function VoiceAssistantProvider({ children, tasks, currentProject, onCreateTask, onStatusChange }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // Refs for latest values (avoid stale closures)
  const stateRef = useRef(state);
  const tasksRef = useRef(tasks);
  const projectRef = useRef(currentProject);
  const handlersRef = useRef({ onCreateTask, onStatusChange });
  const commandRefsRef = useRef({}); // mutable refs for commands (e.g., statusTarget)

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { projectRef.current = currentProject; }, [currentProject]);
  useEffect(() => { handlersRef.current = { onCreateTask, onStatusChange }; }, [onCreateTask, onStatusChange]);

  // ─── Process input ───
  const processInput = useCallback(async (rawText) => {
    if (!rawText?.trim()) return;
    const text = rawText.trim();
    const cur = stateRef.current;

    // Add user message
    dispatch({ type: 'ADD_MESSAGE', msg: { role: 'user', text, ts: Date.now() } });

    // Detect intent
    const commands = getAllCommands();
    const intent = detectIntent(text, commands);

    // Build context
    const ctx = {
      flow: cur.flow,
      draft: cur.draft,
      intent,
      tasks: tasksRef.current,
      currentProject: projectRef.current,
      refs: commandRefsRef.current,
    };

    // Resolve command
    let result = null;
    const command = resolveCommand(intent, cur.flow);

    if (command) {
      result = command.execute(text, ctx);
    }

    // Fallback
    if (!result) {
      result = {
        flow: cur.flow === 'idle' ? 'idle' : cur.flow,
        message: cur.flow === 'idle'
          ? 'Anlamadım. "Yardım" diyerek yapabileceklerimi görebilirsin.'
          : 'Anlamadım. "İptal" diyerek çıkabilirsin.',
      };
    }

    // Update state
    dispatch({ type: 'SET_FLOW', flow: result.flow, draft: result.draft });

    // Add assistant message
    if (result.message) {
      dispatch({ type: 'ADD_MESSAGE', msg: { role: 'assistant', text: result.message, ts: Date.now() } });

      // TTS
      if (stateRef.current.ttsEnabled) {
        dispatch({ type: 'SET_SPEAKING', value: true });
        voice.stop();
        await speak(result.message);
        dispatch({ type: 'SET_SPEAKING', value: false });
      }
    }

    // Execute side-effect action
    if (result.action) {
      result.action(handlersRef.current);
    }
  }, []);

  // ─── Voice input ───
  const voice = useVoiceInput({
    lang: 'tr-TR',
    continuous: false,
    onResult: processInput,
  });

  // Sound effects on listen state changes
  const prevListening = useRef(false);
  useEffect(() => {
    if (voice.isListening && !prevListening.current) {
      playStartBeep();
      startAudioCapture();
    }
    if (!voice.isListening && prevListening.current) {
      playStopBeep();
      stopAudioCapture();
    }
    prevListening.current = voice.isListening;
  }, [voice.isListening]);

  // ─── Flow label ───
  const flowLabel = {
    'create:title': 'Başlık bekleniyor...',
    'create:desc': 'Açıklama bekleniyor...',
    'create:type': 'Tür bekleniyor...',
    'create:priority': 'Öncelik bekleniyor...',
    'create:confirm': 'Onay bekleniyor...',
    'status:which': 'Görev seçimi...',
    'status:to': 'Hedef durum...',
  }[state.flow] || null;

  const value = {
    state,
    dispatch,
    processInput,
    voice,
    flowLabel,
    getAnalyser,
    commands: getAllCommands(),
  };

  return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>;
}

/** @returns {{ state, dispatch, processInput, voice, flowLabel, getAnalyser, commands }} */
export function useVoiceAssistant() {
  const ctx = useContext(VoiceCtx);
  if (!ctx) throw new Error('useVoiceAssistant must be inside VoiceAssistantProvider');
  return ctx;
}
