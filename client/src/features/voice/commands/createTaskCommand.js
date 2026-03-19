import { registerCommand } from './commandRegistry';
import { extractTaskType, extractPriority, priorityLabel } from '../intent/entityExtractors';

const FLOWS = {
  TITLE: 'create:title',
  DESC: 'create:desc',
  TYPE: 'create:type',
  PRIORITY: 'create:priority',
  CONFIRM: 'create:confirm',
};

registerCommand({
  id: 'create_task',
  patterns: [
    /create ?(a )?(new )?task/i,
    /new task/i,
    /add ?(a )?(new )?task/i,
    /open ?(a )?task/i,
  ],
  flowStates: Object.values(FLOWS),
  description: 'Creates a new task — asks for title, description, type, and priority',
  hint: 'Create task',
  icon: 'plus-circle',

  execute(input, ctx) {
    const { flow, draft, intent } = ctx;

    if (flow === 'idle') {
      if (!ctx.currentProject) {
        return { flow: 'idle', message: 'Please select a project first.' };
      }
      return { flow: FLOWS.TITLE, draft: {}, message: 'What should the task title be?' };
    }

    if (intent?.id === 'cancel') {
      return { flow: 'idle', draft: {}, message: 'Task creation cancelled.' };
    }

    if (flow === FLOWS.TITLE) {
      return {
        flow: FLOWS.DESC,
        draft: { ...draft, title: input },
        message: 'Would you like to add a description? Say "skip" if not.',
      };
    }

    if (flow === FLOWS.DESC) {
      const skip = /^(skip|no|none|empty|pass)$/i.test(input);
      return {
        flow: FLOWS.TYPE,
        draft: { ...draft, description: skip ? '' : input },
        message: 'What type? Feature, bugfix, refactor, docs, test, or chore.',
      };
    }

    if (flow === FLOWS.TYPE) {
      const type = extractTaskType(input) || 'feature';
      return {
        flow: FLOWS.PRIORITY,
        draft: { ...draft, task_type: type },
        message: `Type: ${type}. Priority? None, low, medium, or high.`,
      };
    }

    if (flow === FLOWS.PRIORITY) {
      const priority = extractPriority(input) ?? 0;
      const d = { ...draft, priority };
      return {
        flow: FLOWS.CONFIRM,
        draft: d,
        message: `"${d.title}" — ${d.task_type}, ${priorityLabel(priority)}. Shall I create it?`,
      };
    }

    if (flow === FLOWS.CONFIRM) {
      if (intent?.id === 'confirm') {
        return {
          flow: 'idle',
          draft: {},
          message: `Task created: "${draft.title}"`,
          action: (handlers) => {
            handlers.onCreateTask?.({
              title: draft.title,
              description: draft.description || '',
              task_type: draft.task_type || 'feature',
              priority: draft.priority || 0,
              model: 'sonnet',
            });
          },
        };
      }
      if (intent?.id === 'deny') {
        return { flow: 'idle', draft: {}, message: 'Cancelled.' };
      }
      return { flow: FLOWS.CONFIRM, message: 'Say yes or no.' };
    }

    return null;
  },
});
