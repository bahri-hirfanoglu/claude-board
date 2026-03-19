import { describe, it, expect } from 'vitest';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

describe('English-only validation', () => {
  it('all command hints are in English', () => {
    const commands = getAllCommands();
    const turkishPattern = /[çşğüöıİÇŞĞÜÖ]/;
    for (const cmd of commands) {
      expect(cmd.hint).not.toMatch(turkishPattern);
      expect(cmd.description).not.toMatch(turkishPattern);
    }
  });

  it('all command messages use English', () => {
    const commands = getAllCommands();
    const turkishWords = /görev|oluştur|iptal|yardım|listele|değiştir|bekleniyor|anlamadım/i;

    for (const cmd of commands) {
      // Test idle entry messages
      const result = cmd.execute('test', {
        flow: 'idle',
        draft: {},
        intent: { id: cmd.id, text: 'test' },
        tasks: [{ id: 1, title: 'T', status: 'backlog' }],
        currentProject: { id: 1 },
        refs: {},
      });
      if (result?.message) {
        expect(result.message).not.toMatch(turkishWords);
      }
    }
  });

  it('useVoiceInput defaults to en-US', async () => {
    const mod = await import('../../../hooks/useVoiceInput');
    // Check the source has en-US default
    expect(mod.useVoiceInput.toString()).toContain('en-US');
  });
});
