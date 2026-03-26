import { registerCommand } from './commandRegistry';
import { t } from '../i18n/t';
import { CHANGE_STATUS_PATTERNS, STATUS_PATTERNS } from '../i18n/patterns';

const STATUS_NEXT = {
  backlog: 'in_progress',
  in_progress: 'testing',
  testing: 'done',
};

const FLOWS = {
  WHICH: 'status:which',
  TO: 'status:to',
};

registerCommand({
  id: 'change_status',
  patterns: CHANGE_STATUS_PATTERNS,
  flowStates: Object.values(FLOWS),
  description: "Changes a task's status",
  hint: 'Change status',
  icon: 'arrow-right',

  execute(input, ctx) {
    const { flow, intent, tasks, refs, lang } = ctx;

    if (flow === 'idle') {
      if (!tasks || tasks.length === 0) {
        return { flow: 'idle', message: t('status.empty', lang) };
      }
      return { flow: FLOWS.WHICH, message: t('status.which', lang) };
    }

    if (intent?.id === 'cancel') {
      return { flow: 'idle', message: t('cancel.done', lang) };
    }

    if (flow === FLOWS.WHICH) {
      const lower = input.toLowerCase();
      const match = tasks.find(
        (task) =>
          task.title.toLowerCase().includes(lower) || task.task_key?.toLowerCase() === lower || `#${task.id}` === input,
      );

      if (!match) {
        return { flow: FLOWS.WHICH, message: t('status.notFound', lang) };
      }

      refs.statusTarget = match;
      const next = STATUS_NEXT[match.status];
      if (!next) {
        return { flow: 'idle', message: t('status.alreadyDone', lang, { title: match.title }) };
      }

      return {
        flow: FLOWS.TO,
        message: t('status.confirm', lang, {
          title: match.title,
          current: t('status.' + match.status, lang),
          next: t('status.' + next, lang),
        }),
      };
    }

    if (flow === FLOWS.TO) {
      const task = refs.statusTarget;
      if (!task) return { flow: 'idle', message: t('status.error', lang) };

      if (intent?.id === 'confirm') {
        const next = STATUS_NEXT[task.status];
        if (next) {
          return {
            flow: 'idle',
            message: t('status.moved', lang, { title: task.title, target: t('status.' + next, lang) }),
            action: (h) => h.onStatusChange?.(task.id, next),
          };
        }
        return { flow: 'idle', message: t('status.cannotMove', lang) };
      }

      // Try to detect a specific status from input
      let target = null;
      for (const [status, pattern] of Object.entries(STATUS_PATTERNS)) {
        if (pattern.test(input)) {
          target = status;
          break;
        }
      }

      if (target && target !== task.status) {
        return {
          flow: 'idle',
          message: t('status.moved', lang, { title: task.title, target: t('status.' + target, lang) }),
          action: (h) => h.onStatusChange?.(task.id, target),
        };
      }

      return { flow: FLOWS.TO, message: t('status.pickStatus', lang) };
    }

    return null;
  },
});
