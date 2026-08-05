import { describe, it, expect } from 'vitest';
import { modelFamilyColor } from '../useModels';

describe('modelFamilyColor', () => {
  it('maps each family to its badge classes', () => {
    expect(modelFamilyColor('claude-opus-4-8')).toBe('bg-purple-500/20 text-purple-300');
    expect(modelFamilyColor('opus')).toBe('bg-purple-500/20 text-purple-300');
    expect(modelFamilyColor('claude-sonnet-5')).toBe('bg-blue-500/20 text-blue-300');
    expect(modelFamilyColor('claude-haiku-4-5')).toBe('bg-green-500/20 text-green-300');
    expect(modelFamilyColor('claude-fable-5')).toBe('bg-amber-500/20 text-amber-300');
  });

  it('handles 1M variants and unknown ids without throwing', () => {
    expect(modelFamilyColor('claude-opus-4-8[1m]')).toBe('bg-purple-500/20 text-purple-300');
    expect(modelFamilyColor('some-local-model')).toBe('bg-surface-700/50 text-surface-300');
    expect(modelFamilyColor(null)).toBe('bg-surface-700/50 text-surface-300');
  });
});
