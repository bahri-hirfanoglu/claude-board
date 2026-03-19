import { registerCommand } from './commandRegistry';

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  testing: 'Testing',
  done: 'Done',
};

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
  patterns: [
    /change ?(the )?(task )?status/i,
    /move ?(a )?task/i,
    /update ?(the )?(task )?status/i,
    /(start|begin) ?(a )?task/i,
    /mark ?(as )?(done|complete)/i,
    /send to (testing|test)/i,
  ],
  flowStates: Object.values(FLOWS),
  description: 'Changes a task\'s status',
  hint: 'Change status',
  icon: 'arrow-right',

  execute(input, ctx) {
    const { flow, intent, tasks, refs } = ctx;

    if (flow === 'idle') {
      if (!tasks || tasks.length === 0) {
        return { flow: 'idle', message: 'No tasks yet.' };
      }
      return { flow: FLOWS.WHICH, message: 'Which task do you want to update?' };
    }

    if (intent?.id === 'cancel') {
      return { flow: 'idle', message: 'Cancelled.' };
    }

    if (flow === FLOWS.WHICH) {
      const lower = input.toLowerCase();
      const match = tasks.find(t =>
        t.title.toLowerCase().includes(lower) ||
        t.task_key?.toLowerCase() === lower ||
        `#${t.id}` === input
      );

      if (!match) {
        return { flow: FLOWS.WHICH, message: 'Couldn\'t find that task. Try again with the task title or key.' };
      }

      refs.statusTarget = match;
      const next = STATUS_NEXT[match.status];
      if (!next) {
        return { flow: 'idle', message: `"${match.title}" is already done.` };
      }

      return {
        flow: FLOWS.TO,
        message: `"${match.title}" is currently ${STATUS_LABELS[match.status]}. Move to ${STATUS_LABELS[next]}?`,
      };
    }

    if (flow === FLOWS.TO) {
      const task = refs.statusTarget;
      if (!task) return { flow: 'idle', message: 'Something went wrong.' };

      if (intent?.id === 'confirm') {
        const next = STATUS_NEXT[task.status];
        if (next) {
          return {
            flow: 'idle',
            message: `"${task.title}" moved to ${STATUS_LABELS[next]}.`,
            action: (h) => h.onStatusChange?.(task.id, next),
          };
        }
        return { flow: 'idle', message: 'Cannot move further.' };
      }

      const lower = input.toLowerCase();
      let target = null;
      if (/backlog/i.test(lower)) target = 'backlog';
      else if (/progress|start/i.test(lower)) target = 'in_progress';
      else if (/test/i.test(lower)) target = 'testing';
      else if (/done|complete|finish/i.test(lower)) target = 'done';

      if (target && target !== task.status) {
        return {
          flow: 'idle',
          message: `"${task.title}" moved to ${STATUS_LABELS[target]}.`,
          action: (h) => h.onStatusChange?.(task.id, target),
        };
      }

      return { flow: FLOWS.TO, message: 'Say backlog, in progress, testing, or done.' };
    }

    return null;
  },
});
