/**
 * Intent detection engine.
 * Matches user text against registered command patterns.
 * Supports multi-language conversational intents.
 */

import { CONFIRM_PATTERNS, DENY_PATTERNS } from '../i18n/patterns';

const CONVERSATIONAL = [
  { id: 'confirm', patterns: CONFIRM_PATTERNS },
  { id: 'deny', patterns: DENY_PATTERNS },
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
