import { describe, it, expect, vi } from 'vitest';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

const statusCmd = getAllCommands().find(c => c.id === 'change_status');

function ctx(overrides = {}) {
  return {
    flow: 'idle',
    draft: {},
    intent: null,
    tasks: [
      { id: 1, title: 'Fix login', status: 'backlog', task_key: 'BUG-CB-1001' },
      { id: 2, title: 'Add search', status: 'in_progress', task_key: 'FTR-CB-1002' },
      { id: 3, title: 'Done task', status: 'done', task_key: 'FTR-CB-1003' },
    ],
    refs: {},
    ...overrides,
  };
}

describe('changeStatusCommand', () => {
  it('starts flow', () => {
    const result = statusCmd.execute('change status', ctx());
    expect(result.flow).toBe('status:which');
    expect(result.message).toContain('Which task');
  });

  it('reports no tasks', () => {
    const result = statusCmd.execute('change status', ctx({ tasks: [] }));
    expect(result.message).toContain('No tasks');
  });

  it('finds task by title', () => {
    const c = ctx({ flow: 'status:which' });
    const result = statusCmd.execute('fix login', c);
    expect(result.flow).toBe('status:to');
    expect(result.message).toContain('Fix login');
    expect(result.message).toContain('Backlog');
  });

  it('finds task by key', () => {
    const c = ctx({ flow: 'status:which' });
    const result = statusCmd.execute('BUG-CB-1001', c);
    expect(result.flow).toBe('status:to');
  });

  it('reports not found', () => {
    const result = statusCmd.execute('nonexistent', ctx({ flow: 'status:which' }));
    expect(result.flow).toBe('status:which');
    expect(result.message).toContain('find');
  });

  it('reports already done', () => {
    const c = ctx({ flow: 'status:which' });
    const result = statusCmd.execute('done task', c);
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('already done');
  });

  it('moves to next status on confirm', () => {
    const c = ctx({ flow: 'status:to', intent: { id: 'confirm', text: 'yes' } });
    c.refs.statusTarget = { id: 1, title: 'Fix login', status: 'backlog' };
    const result = statusCmd.execute('yes', c);
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('In Progress');

    const onStatusChange = vi.fn();
    result.action({ onStatusChange });
    expect(onStatusChange).toHaveBeenCalledWith(1, 'in_progress');
  });

  it('moves to specific status by name', () => {
    const c = ctx({ flow: 'status:to' });
    c.refs.statusTarget = { id: 2, title: 'Add search', status: 'in_progress' };
    const result = statusCmd.execute('done', c);
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('Done');

    const onStatusChange = vi.fn();
    result.action({ onStatusChange });
    expect(onStatusChange).toHaveBeenCalledWith(2, 'done');
  });

  it('cancels at any step', () => {
    for (const flow of ['status:which', 'status:to']) {
      const result = statusCmd.execute('cancel', ctx({ flow, intent: { id: 'cancel', text: 'cancel' } }));
      expect(result.flow).toBe('idle');
    }
  });
});
