import { useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useVoiceAssistant } from './VoiceAssistantProvider';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { t } from './i18n/t';
import ChatPanel from './components/ChatPanel';

/**
 * Slim UI shell — floating mic FAB + chat panel.
 * All logic lives in VoiceAssistantProvider.
 */
export default function VoiceAssistant() {
  const { state, dispatch, processInput, voice, flowLabel, getAnalyser, commands, voiceLang, changeLang } = useVoiceAssistant();

  // Welcome message on first open
  useEffect(() => {
    if (state.open && state.messages.length === 0) {
      dispatch({
        type: 'ADD_MESSAGE',
        msg: {
          role: 'assistant',
          text: t('welcome', voiceLang),
          ts: Date.now(),
        },
      });
    }
  }, [state.open, state.messages.length, dispatch, voiceLang]);

  // Alt+V keyboard shortcut
  useKeyboardShortcut({
    key: 'v',
    mode: 'toggle',
    enabled: state.open,
    onActivate: () => { if (!voice.isListening) voice.start(); },
    onDeactivate: () => { if (voice.isListening) voice.stop(); },
  });

  return (
    <>
      {/* ─── Floating Action Button ─── */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_OPEN' })}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          voice.isListening
            ? 'bg-red-500 shadow-red-500/30 scale-110'
            : state.open
              ? 'bg-surface-700 hover:bg-surface-600 shadow-black/30'
              : 'bg-claude hover:bg-claude-light shadow-claude/30'
        }`}
        title={state.open ? 'Close assistant' : 'Voice Assistant'}
      >
        {voice.isListening ? (
          <div className="relative">
            <Mic size={22} className="text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative rounded-full h-3 w-3 bg-red-200" />
            </span>
          </div>
        ) : state.open ? (
          <X size={22} className="text-surface-200" />
        ) : (
          <Mic size={22} className="text-white" />
        )}

        {/* Pulse rings when listening */}
        {voice.isListening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <span className="absolute -inset-2 rounded-full border-2 border-red-400/20 animate-pulse" />
          </>
        )}
      </button>

      {/* ─── Chat Panel ─── */}
      {state.open && (
        <ChatPanel
          state={state}
          dispatch={dispatch}
          voice={voice}
          processInput={processInput}
          flowLabel={flowLabel}
          getAnalyser={getAnalyser}
          commands={commands}
          voiceLang={voiceLang}
          changeLang={changeLang}
        />
      )}
    </>
  );
}
