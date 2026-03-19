/**
 * Entity extraction from voice input.
 */

const TYPE_MAP = {
  feature: ['feature', 'new feature'],
  bugfix: ['bugfix', 'bug', 'bug fix', 'fix'],
  refactor: ['refactor', 'refactoring', 'cleanup'],
  docs: ['docs', 'documentation', 'document'],
  test: ['test', 'testing'],
  chore: ['chore', 'maintenance'],
};

const PRIORITY_MAP = {
  0: ['none', 'no priority', 'skip'],
  1: ['low'],
  2: ['medium', 'normal', 'moderate'],
  3: ['high', 'urgent', 'critical', 'important'],
};

const MODEL_MAP = {
  haiku: ['haiku'],
  sonnet: ['sonnet'],
  opus: ['opus'],
};

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
  for (const [model, keywords] of Object.entries(MODEL_MAP)) {
    if (keywords.some(k => lower.includes(k))) return model;
  }
  return null;
}

/** @param {number} priority @returns {string} */
export function priorityLabel(priority) {
  return ['None', 'Low', 'Medium', 'High'][priority] || 'None';
}
