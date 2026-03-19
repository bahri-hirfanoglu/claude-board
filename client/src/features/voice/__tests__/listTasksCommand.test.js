import { describe, it, expect } from 'vitest';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

const listCmd = getAllCommands().find(c => c.id === 'list_tasks');

describe('listTasksCommand', () => {
  it('reports no tasks', () => {
    const result = listCmd.execute('list tasks', { flow: 'idle', tasks: [], refs: {} });
    expect(result.message).toContain('No tasks');
  });

  it('reports task counts by status', () => {
    const tasks = [
      { status: 'backlog' },
      { status: 'backlog' },
      { status: 'in_progress' },
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
    ];
    const result = listCmd.execute('list tasks', { flow: 'idle', tasks, refs: {} });
    expect(result.message).toContain('6 total');
    expect(result.message).toContain('Backlog: 2');
    expect(result.message).toContain('In Progress: 1');
    expect(result.message).toContain('Done: 3');
  });
});
