import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent/intentParser';
import { getAllCommands } from '../commands/commandRegistry';
import '../commands/index';

const commands = getAllCommands();

describe('intentParser', () => {
  it('detects confirm intent', () => {
    expect(detectIntent('yes', commands).id).toBe('confirm');
    expect(detectIntent('Yeah', commands).id).toBe('confirm');
    expect(detectIntent('sure', commands).id).toBe('confirm');
    expect(detectIntent('ok', commands).id).toBe('confirm');
  });

  it('detects deny intent', () => {
    expect(detectIntent('no', commands).id).toBe('deny');
    expect(detectIntent('Nope', commands).id).toBe('deny');
  });

  it('detects create_task intent', () => {
    expect(detectIntent('create task', commands).id).toBe('create_task');
    expect(detectIntent('create a new task', commands).id).toBe('create_task');
    expect(detectIntent('new task', commands).id).toBe('create_task');
    expect(detectIntent('add task', commands).id).toBe('create_task');
  });

  it('detects list_tasks intent', () => {
    expect(detectIntent('list tasks', commands).id).toBe('list_tasks');
    expect(detectIntent('show all tasks', commands).id).toBe('list_tasks');
    expect(detectIntent('how many tasks', commands).id).toBe('list_tasks');
  });

  it('detects change_status intent', () => {
    expect(detectIntent('change status', commands).id).toBe('change_status');
    expect(detectIntent('move task', commands).id).toBe('change_status');
    expect(detectIntent('mark as done', commands).id).toBe('change_status');
  });

  it('detects help intent', () => {
    expect(detectIntent('help', commands).id).toBe('help');
    expect(detectIntent('what can you do', commands).id).toBe('help');
  });

  it('detects cancel intent', () => {
    expect(detectIntent('cancel', commands).id).toBe('cancel');
    expect(detectIntent('nevermind', commands).id).toBe('cancel');
  });

  it('returns freetext for unknown input', () => {
    expect(detectIntent('hello world', commands).id).toBe('freetext');
  });

  it('returns null for empty input', () => {
    expect(detectIntent('', commands)).toBeNull();
    expect(detectIntent(null, commands)).toBeNull();
  });
});
