import { registerCommand } from './commandRegistry';
import { extractTaskType, extractPriority, priorityLabel } from '../intent/entityExtractors';
import { t } from '../i18n/t';
import { CREATE_TASK_PATTERNS, SKIP_PATTERN } from '../i18n/patterns';

const FLOWS = {
  TITLE: 'create:title',
  DESC: 'create:desc',
  TYPE: 'create:type',
  PRIORITY: 'create:priority',
  CONFIRM: 'create:confirm',
};

registerCommand({
  id: 'create_task',
  patterns: CREATE_TASK_PATTERNS,
  flowStates: Object.values(FLOWS),
  description: 'Creates a new task — asks for title, description, type, and priority',
  hint: 'Create task',
  icon: 'plus-circle',

  execute(input, ctx) {
    const { flow, draft, intent, lang } = ctx;

    if (flow === 'idle') {
      if (!ctx.currentProject) {
        return { flow: 'idle', message: t('create.noProject', lang) };
      }
      return { flow: FLOWS.TITLE, draft: {}, message: t('create.askTitle', lang) };
    }

    if (intent?.id === 'cancel') {
      return { flow: 'idle', draft: {}, message: t('create.cancelled', lang) };
    }

    if (flow === FLOWS.TITLE) {
      return {
        flow: FLOWS.DESC,
        draft: { ...draft, title: input },
        message: t('create.askDesc', lang),
      };
    }

    if (flow === FLOWS.DESC) {
      const skip = SKIP_PATTERN.test(input);
      return {
        flow: FLOWS.TYPE,
        draft: { ...draft, description: skip ? '' : input },
        message: t('create.askType', lang),
      };
    }

    if (flow === FLOWS.TYPE) {
      const type = extractTaskType(input) || 'feature';
      return {
        flow: FLOWS.PRIORITY,
        draft: { ...draft, task_type: type },
        message: t('create.typeSet', lang, { type }),
      };
    }

    if (flow === FLOWS.PRIORITY) {
      const priority = extractPriority(input) ?? 0;
      const d = { ...draft, priority };
      return {
        flow: FLOWS.CONFIRM,
        draft: d,
        message: t('create.confirm', lang, {
          title: d.title,
          type: d.task_type,
          priority: priorityLabel(priority, lang),
        }),
      };
    }

    if (flow === FLOWS.CONFIRM) {
      if (intent?.id === 'confirm') {
        return {
          flow: 'idle',
          draft: {},
          message: t('create.done', lang, { title: draft.title }),
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
        return { flow: 'idle', draft: {}, message: t('create.denied', lang) };
      }
      return { flow: FLOWS.CONFIRM, message: t('create.yesOrNo', lang) };
    }

    return null;
  },
});
