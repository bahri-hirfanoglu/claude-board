import { registerCommand } from './commandRegistry';
import { t } from '../i18n/t';
import { CANCEL_PATTERNS } from '../i18n/patterns';

registerCommand({
  id: 'cancel',
  patterns: CANCEL_PATTERNS,
  flowStates: [],
  description: 'Cancels the current operation',
  hint: 'Cancel',
  icon: 'x-circle',

  execute(_input, ctx) {
    const { lang } = ctx;
    if (ctx.flow !== 'idle') {
      return { flow: 'idle', draft: {}, message: t('cancel.done', lang) };
    }
    return { flow: 'idle', message: t('cancel.ok', lang) };
  },
});
