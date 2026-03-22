import { registerCommand, getAllCommands } from './commandRegistry';
import { t } from '../i18n/t';
import { HELP_PATTERNS } from '../i18n/patterns';

registerCommand({
  id: 'help',
  patterns: HELP_PATTERNS,
  flowStates: [],
  description: 'Lists available commands',
  hint: 'Help',
  icon: 'help-circle',

  execute(_input, ctx) {
    const { lang } = ctx;
    const commands = getAllCommands().filter(c => c.id !== 'help' && c.id !== 'cancel');
    const lines = commands.map(c => `• "${t('hint.' + c.id, lang)}" — ${t('desc.' + c.id, lang)}`);
    const message = `${t('help.header', lang)}\n${lines.join('\n')}\n\n${t('help.footer', lang)}`;
    return { flow: 'idle', message };
  },
});
