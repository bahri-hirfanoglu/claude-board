import { describe, it, expect, vi } from 'vitest';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

const createCmd = getAllCommands().find((c) => c.id === 'create_task');

function ctx(overrides = {}) {
  return {
    flow: 'idle',
    draft: {},
    intent: null,
    tasks: [],
    currentProject: { id: 1, name: 'Test' },
    refs: {},
    ...overrides,
  };
}

describe('createTaskCommand', () => {
  it('starts flow when project is selected', () => {
    const result = createCmd.execute('create task', ctx());
    expect(result.flow).toBe('create:title');
    expect(result.message).toContain('title');
  });

  it('rejects when no project selected', () => {
    const result = createCmd.execute('create task', ctx({ currentProject: null }));
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('project');
  });

  it('accepts title and moves to description', () => {
    const result = createCmd.execute('Fix login page', ctx({ flow: 'create:title' }));
    expect(result.flow).toBe('create:desc');
    expect(result.draft.title).toBe('Fix login page');
    expect(result.message).toContain('description');
  });

  it('accepts skip for description', () => {
    const result = createCmd.execute('skip', ctx({ flow: 'create:desc', draft: { title: 'Test' } }));
    expect(result.flow).toBe('create:type');
    expect(result.draft.description).toBe('');
  });

  it('accepts description text', () => {
    const result = createCmd.execute('Users cannot log in', ctx({ flow: 'create:desc', draft: { title: 'Test' } }));
    expect(result.flow).toBe('create:type');
    expect(result.draft.description).toBe('Users cannot log in');
  });

  it('extracts task type', () => {
    const result = createCmd.execute('bugfix', ctx({ flow: 'create:type', draft: { title: 'Test' } }));
    expect(result.flow).toBe('create:priority');
    expect(result.draft.task_type).toBe('bugfix');
  });

  it('defaults to feature for unknown type', () => {
    const result = createCmd.execute('something', ctx({ flow: 'create:type', draft: { title: 'Test' } }));
    expect(result.draft.task_type).toBe('feature');
  });

  it('extracts priority and shows confirm', () => {
    const result = createCmd.execute(
      'high',
      ctx({
        flow: 'create:priority',
        draft: { title: 'Test', task_type: 'bugfix' },
      }),
    );
    expect(result.flow).toBe('create:confirm');
    expect(result.draft.priority).toBe(3);
    expect(result.message).toContain('Test');
  });

  it('creates task on confirm', () => {
    const onCreateTask = vi.fn();
    const draft = { title: 'Fix it', description: 'desc', task_type: 'bugfix', priority: 2 };
    const result = createCmd.execute(
      'yes',
      ctx({
        flow: 'create:confirm',
        draft,
        intent: { id: 'confirm', text: 'yes' },
      }),
    );
    expect(result.flow).toBe('idle');
    expect(result.message).toContain('Fix it');
    expect(result.action).toBeDefined();

    result.action({ onCreateTask });
    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fix it',
        description: 'desc',
        task_type: 'bugfix',
        priority: 2,
      }),
    );
  });

  it('cancels on deny', () => {
    const result = createCmd.execute(
      'no',
      ctx({
        flow: 'create:confirm',
        draft: { title: 'X' },
        intent: { id: 'deny', text: 'no' },
      }),
    );
    expect(result.flow).toBe('idle');
  });

  it('cancels at any step', () => {
    for (const flow of ['create:title', 'create:desc', 'create:type', 'create:priority']) {
      const result = createCmd.execute('cancel', ctx({ flow, intent: { id: 'cancel', text: 'cancel' } }));
      expect(result.flow).toBe('idle');
    }
  });
});
