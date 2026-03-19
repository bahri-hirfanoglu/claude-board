/**
 * Intent detection engine.
 * Matches user text against registered command patterns.
 */

const CONVERSATIONAL = [
  { id: 'confirm', patterns: [/^(yes|yeah|yep|sure|ok|okay|confirm|correct|right|do it|go ahead)/i] },
  { id: 'deny', patterns: [/^(no|nope|nah|don't|negative)/i] },
];

/**
 * Detect intent from user text.
 * @param {string} text
 * @param {import('../commands/commandRegistry').VoiceCommand[]} commands
 * @returns {{ id: string, text: string } | null}
 */
export function detectIntent(text, commands = []) {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();

  for (const intent of CONVERSATIONAL) {
    for (const pattern of intent.patterns) {
      if (pattern.test(cleaned)) {
        return { id: intent.id, text: cleaned };
      }
    }
  }

  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(cleaned)) {
        return { id: cmd.id, text: cleaned };
      }
    }
  }

  return { id: 'freetext', text: cleaned };
}
