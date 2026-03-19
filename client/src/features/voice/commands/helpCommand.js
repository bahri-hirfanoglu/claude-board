import { registerCommand, getAllCommands } from './commandRegistry';

registerCommand({
  id: 'help',
  patterns: [
    /^help$/i,
    /what can you do/i,
    /commands/i,
    /how (do|to) (I )?use/i,
  ],
  flowStates: [],
  description: 'Lists available commands',
  hint: 'Help',
  icon: 'help-circle',

  execute() {
    const commands = getAllCommands().filter(c => c.id !== 'help' && c.id !== 'cancel');
    const lines = commands.map(c => `• "${c.hint}" — ${c.description}`);
    const message = `Here's what I can do:\n${lines.join('\n')}\n\nSay "cancel" to stop any active operation.`;
    return { flow: 'idle', message };
  },
});
