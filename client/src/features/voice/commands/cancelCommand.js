import { registerCommand } from './commandRegistry';

registerCommand({
  id: 'cancel',
  patterns: [
    /^(cancel|stop|abort|quit|close|nevermind)$/i,
    /^(never ?mind)$/i,
  ],
  flowStates: [],
  description: 'Cancels the current operation',
  hint: 'Cancel',
  icon: 'x-circle',

  execute(_input, ctx) {
    if (ctx.flow !== 'idle') {
      return { flow: 'idle', draft: {}, message: 'Cancelled.' };
    }
    return { flow: 'idle', message: 'OK.' };
  },
});
