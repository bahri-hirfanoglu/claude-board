import { describe, it, expect } from 'vitest';
import { extractTaskType, extractPriority, extractModel, priorityLabel } from '../intent/entityExtractors';

describe('entityExtractors', () => {
  describe('extractTaskType', () => {
    it('extracts feature', () => {
      expect(extractTaskType('feature')).toBe('feature');
      expect(extractTaskType('new feature')).toBe('feature');
    });

    it('extracts bugfix', () => {
      expect(extractTaskType('bug fix')).toBe('bugfix');
      expect(extractTaskType('bugfix')).toBe('bugfix');
      expect(extractTaskType('fix')).toBe('bugfix');
    });

    it('extracts refactor', () => {
      expect(extractTaskType('refactor')).toBe('refactor');
    });

    it('extracts docs', () => {
      expect(extractTaskType('documentation')).toBe('docs');
    });

    it('extracts test', () => {
      expect(extractTaskType('test')).toBe('test');
    });

    it('extracts chore', () => {
      expect(extractTaskType('chore')).toBe('chore');
      expect(extractTaskType('maintenance')).toBe('chore');
    });

    it('returns null for unknown', () => {
      expect(extractTaskType('something random')).toBeNull();
    });
  });

  describe('extractPriority', () => {
    it('extracts none', () => {
      expect(extractPriority('none')).toBe(0);
    });

    it('extracts low', () => {
      expect(extractPriority('low')).toBe(1);
    });

    it('extracts medium', () => {
      expect(extractPriority('medium')).toBe(2);
      expect(extractPriority('normal')).toBe(2);
    });

    it('extracts high', () => {
      expect(extractPriority('high')).toBe(3);
      expect(extractPriority('urgent')).toBe(3);
      expect(extractPriority('critical')).toBe(3);
    });

    it('returns null for unknown', () => {
      expect(extractPriority('whatever')).toBeNull();
    });
  });

  describe('extractModel', () => {
    it('extracts haiku', () => {
      expect(extractModel('haiku')).toBe('haiku');
    });

    it('extracts sonnet', () => {
      expect(extractModel('sonnet')).toBe('sonnet');
    });

    it('extracts opus', () => {
      expect(extractModel('opus')).toBe('opus');
    });

    it('returns null for unknown', () => {
      expect(extractModel('gpt')).toBeNull();
    });
  });

  describe('priorityLabel', () => {
    it('returns correct labels', () => {
      expect(priorityLabel(0)).toBe('None');
      expect(priorityLabel(1)).toBe('Low');
      expect(priorityLabel(2)).toBe('Medium');
      expect(priorityLabel(3)).toBe('High');
    });
  });
});
