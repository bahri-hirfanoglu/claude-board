/**
 * Entity extraction from voice input (multi-language).
 */

import { TYPE_MAP, PRIORITY_MAP } from '../i18n/patterns';
import { t } from '../i18n/t';

/** @param {string} text @returns {string|null} */
export function extractTaskType(text) {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_MAP)) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return null;
}

/** @param {string} text @returns {number|null} */
export function extractPriority(text) {
  const lower = text.toLowerCase();
  for (const [priority, keywords] of Object.entries(PRIORITY_MAP)) {
    if (keywords.some(k => lower.includes(k))) return Number(priority);
  }
  return null;
}

/** @param {string} text @returns {string|null} */
export function extractModel(text) {
  const lower = text.toLowerCase();
  const MODEL_MAP = {
    haiku: ['haiku'],
    sonnet: ['sonnet'],
    opus: ['opus'],
  };
  for (const [model, keywords] of Object.entries(MODEL_MAP)) {
    if (keywords.some(k => lower.includes(k))) return model;
  }
  return null;
}

/** @param {number} priority @param {string} lang @returns {string} */
export function priorityLabel(priority, lang = 'en-US') {
  return t(`priority.${priority}`, lang) || t('priority.0', lang);
}
