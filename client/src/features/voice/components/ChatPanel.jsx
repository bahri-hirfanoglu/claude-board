import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Keyboard } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import CommandHints from './CommandHints';

export default function ChatPanel({ state, dispatch, voice, processInput, flowLabel, getAnalyser, commands }) {
  const [textInput, setTextInput] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // Focus input when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    processInput(textInput);
    setTextInput('');
  };

  return (
    <div
      className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[calc(100vw-40px)] bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-slide-up"
      style={{ maxHeight: 'min(560px, calc(100vh - 140px))' }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-800 flex-shrink-0">
        <div className="relative">
          <Mic size={16} className="text-claude" />
          {voice.isListening && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-surface-200 flex-1">Voice Assistant</span>

        {flowLabel && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-claude/15 text-claude font-medium animate-pulse">
            {flowLabel}
          </span>
        )}

        <button
          onClick={() => dispatch({ type: 'TOGGLE_TTS' })}
          className="p-1 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          title={state.ttsEnabled ? 'Mute voice' : 'Unmute voice'}
        >
          {state.ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <button
          onClick={() => dispatch({ type: 'CLEAR' })}
          className="p-1 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          title="Clear chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ─── Visualizer ─── */}
      {voice.isListening && (
        <div className="px-4 py-2 border-b border-surface-800/50 bg-surface-900/50">
          <AudioVisualizer getAnalyser={getAnalyser} isActive={voice.isListening} className="w-full" />
        </div>
      )}

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {state.messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${
              msg.role === 'user'
                ? 'bg-claude/20 text-surface-100 rounded-br-md'
                : 'bg-surface-800 text-surface-300 rounded-bl-md'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Interim voice text */}
        {voice.interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-claude/10 text-surface-400 text-[13px] italic border border-dashed border-claude/20">
              {voice.interim}...
            </div>
          </div>
        )}

        {/* Speaking indicator */}
        {state.isSpeaking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl rounded-bl-md bg-surface-800 text-surface-500 text-[11px]">
              <Volume2 size={11} className="animate-pulse" />
              Speaking...
            </div>
          </div>
        )}

        {/* Command hints when idle and no active flow */}
        {state.flow === 'idle' && state.messages.length > 0 && !voice.isListening && !state.isSpeaking && (
          <CommandHints commands={commands} onSelect={processInput} />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ─── Input bar ─── */}
      <div className="border-t border-surface-800 px-3 py-2.5 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={voice.toggle}
            disabled={!voice.isSupported || state.isSpeaking}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              voice.isListening
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse'
                : 'bg-surface-800 text-surface-400 hover:text-claude hover:bg-surface-700'
            } ${(!voice.isSupported || state.isSpeaking) ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={voice.isListening ? 'Stop listening (Alt+V)' : 'Voice command (Alt+V)'}
          >
            {voice.isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <input
            ref={inputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={voice.isListening ? 'Listening...' : 'Type a command...'}
            className="flex-1 min-w-0 px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-[13px] text-surface-200 focus:outline-none focus:ring-1 focus:ring-claude focus:border-claude placeholder-surface-600"
            disabled={state.isSpeaking}
          />

          <button
            type="submit"
            disabled={!textInput.trim() || state.isSpeaking}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-claude hover:bg-claude-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </form>

        {/* Keyboard hint */}
        <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-surface-600">
          <Keyboard size={10} />
          <span>Press Alt+V to toggle microphone</span>
        </div>
      </div>
    </div>
  );
}
