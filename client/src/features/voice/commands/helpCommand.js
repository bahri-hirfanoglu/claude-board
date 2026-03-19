import { registerCommand, getAllCommands } from './commandRegistry';

registerCommand({
  id: 'help',
  patterns: [
    /yardım|help/i,
    /ne yapabilirsin/i,
    /komutlar|commands/i,
    /nasıl kullan/i,
  ],
  flowStates: [],
  description: 'Kullanılabilir komutları listeler',
  hint: 'Yardım',
  icon: 'help-circle',

  execute() {
    const commands = getAllCommands().filter(c => c.id !== 'help' && c.id !== 'cancel');
    const lines = commands.map(c => `• "${c.hint}" — ${c.description}`);
    const message = `Şunları yapabilirim:\n${lines.join('\n')}\n\n"İptal" diyerek herhangi bir işlemi durdurabilirsin.`;
    return { flow: 'idle', message };
  },
});
