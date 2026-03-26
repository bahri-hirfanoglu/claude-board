import { registerCommand } from './commandRegistry';
import { t } from '../i18n/t';
import { LIST_TASKS_PATTERNS } from '../i18n/patterns';

registerCommand({
  id: 'list_tasks',
  patterns: LIST_TASKS_PATTERNS,
  flowStates: [],
  description: 'Shows task count by status',
  hint: 'List tasks',
  icon: 'list',

  execute(_input, ctx) {
    const { tasks, lang } = ctx;
    if (!tasks || tasks.length === 0) {
      return { flow: 'idle', message: t('list.empty', lang) };
    }

    const byStatus = {};
    tasks.forEach((task) => {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    });

    const parts = Object.entries(byStatus)
      .map(([s, c]) => `${t('status.' + s, lang) || s}: ${c}`)
      .join(', ');

    return {
      flow: 'idle',
      message: t('list.summary', lang, { count: tasks.length, breakdown: parts }),
    };
  },
});
