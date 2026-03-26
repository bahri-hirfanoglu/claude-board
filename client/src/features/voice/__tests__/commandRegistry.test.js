import { describe, it, expect, beforeEach } from 'vitest';
import { registerCommand, resolveCommand, getAllCommands } from '../commands/commandRegistry';

// Commands auto-register via barrel import
import '../commands/index';

describe('commandRegistry', () => {
  it('registers all built-in commands', () => {
    const commands = getAllCommands();
    const ids = commands.map((c) => c.id);
    expect(ids).toContain('create_task');
    expect(ids).toContain('list_tasks');
    expect(ids).toContain('change_status');
    expect(ids).toContain('help');
    expect(ids).toContain('cancel');
  });

  it('each command has required fields', () => {
    const commands = getAllCommands();
    for (const cmd of commands) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.patterns.length).toBeGreaterThan(0);
      expect(cmd.description).toBeTruthy();
      expect(cmd.hint).toBeTruthy();
      expect(typeof cmd.execute).toBe('function');
    }
  });

  it('resolves command by intent id', () => {
    const cmd = resolveCommand({ id: 'create_task', text: 'create task' }, 'idle');
    expect(cmd).not.toBeNull();
    expect(cmd.id).toBe('create_task');
  });

  it('resolves flow owner when in active flow', () => {
    const cmd = resolveCommand({ id: 'freetext', text: 'my task title' }, 'create:title');
    expect(cmd).not.toBeNull();
    expect(cmd.id).toBe('create_task');
  });

  it('returns null for unknown freetext when idle', () => {
    const cmd = resolveCommand({ id: 'freetext', text: 'random stuff' }, 'idle');
    expect(cmd).toBeNull();
  });
});
