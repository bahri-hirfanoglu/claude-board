import { describe, it, expect } from 'vitest';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

const helpCmd = getAllCommands().find(c => c.id === 'help');
const cancelCmd = getAllCommands().find(c => c.id === 'cancel');

describe('helpCommand', () => {
  it('lists all commands', () => {
    const result = helpCmd.execute('help', { flow: 'idle', refs: {} });
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('Create task');
    expect(result.message).toContain('List tasks');
    expect(result.message).toContain('Change status');
    expect(result.message).toContain('cancel');
  });
});

describe('cancelCommand', () => {
  it('cancels active flow', () => {
    const result = cancelCmd.execute('cancel', { flow: 'create:title', refs: {} });
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('Cancelled');
  });

  it('acknowledges when already idle', () => {
    const result = cancelCmd.execute('cancel', { flow: 'idle', refs: {} });
    expect(result.flow).toBe('idle');
    expect(result.message).toBe('OK.');
  });
});
