/**
 * Intent detection engine.
 * Matches user text against registered command patterns.
 */

// Cross-cutting conversational intents (not tied to a specific command)
const CONVERSATIONAL = [
  { id: 'confirm', patterns: [/^(evet|yes|tamam|ok|okey|olur|onay|kabul|doğru|uygun)/i] },
  { id: 'deny', patterns: [/^(hayır|no|yok|istemiyorum|olmaz)/i] },
];

/**
 * Detect intent from user text.
 * First checks conversational signals, then registered command patterns.
 * @param {string} text - Raw user input
 * @param {import('../commands/commandRegistry').VoiceCommand[]} commands - Registered commands
 * @returns {{ id: string, text: string } | null}
 */
export function detectIntent(text, commands = []) {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();

  // Check conversational intents first
  for (const intent of CONVERSATIONAL) {
    for (const pattern of intent.patterns) {
      if (pattern.test(cleaned)) {
        return { id: intent.id, text: cleaned };
      }
    }
  }

  // Check command patterns
  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(cleaned)) {
        return { id: cmd.id, text: cleaned };
      }
    }
  }

  return { id: 'freetext', text: cleaned };
}
