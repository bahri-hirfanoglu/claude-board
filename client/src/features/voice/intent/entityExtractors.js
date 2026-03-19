/**
 * Entity extraction from Turkish/English voice input.
 * Maps spoken words to structured values.
 */

const TYPE_MAP = {
  feature: ['feature', 'özellik', 'yeni özellik', 'fıçır'],
  bugfix: ['bugfix', 'bug', 'hata', 'düzeltme', 'fix', 'bağ'],
  refactor: ['refactor', 'refaktör', 'düzenleme', 'iyileştirme'],
  docs: ['docs', 'doküman', 'dokümantasyon', 'belge'],
  test: ['test', 'testing'],
  chore: ['chore', 'bakım', 'temizlik'],
};

const PRIORITY_MAP = {
  0: ['yok', 'none', 'önceliksiz'],
  1: ['düşük', 'low', 'az'],
  2: ['orta', 'medium', 'normal'],
  3: ['yüksek', 'high', 'acil', 'kritik', 'urgent'],
};

const MODEL_MAP = {
  haiku: ['haiku', 'haikü'],
  sonnet: ['sonnet', 'sonet'],
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
  return ['Yok', 'Düşük', 'Orta', 'Yüksek'][priority] || 'Yok';
}
