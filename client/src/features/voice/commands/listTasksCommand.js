import { registerCommand } from './commandRegistry';

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  testing: 'Testing',
  done: 'Done',
};

registerCommand({
  id: 'list_tasks',
  patterns: [
    /(list|show|display) ?(all )?(the )?tasks/i,
    /how many tasks/i,
    /what('s| is) in (the )?backlog/i,
    /task (summary|overview|count)/i,
    /what do we have/i,
  ],
  flowStates: [],
  description: 'Shows task count by status',
  hint: 'List tasks',
  icon: 'list',

  execute(_input, ctx) {
    const { tasks } = ctx;
    if (!tasks || tasks.length === 0) {
      return { flow: 'idle', message: 'No tasks yet.' };
    }

    const byStatus = {};
    tasks.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    const parts = Object.entries(byStatus)
      .map(([s, c]) => `${STATUS_LABELS[s] || s}: ${c}`)
      .join(', ');

    return {
      flow: 'idle',
      message: `${tasks.length} total tasks. ${parts}.`,
    };
  },
});
