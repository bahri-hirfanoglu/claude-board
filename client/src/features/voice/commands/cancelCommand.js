import { registerCommand } from './commandRegistry';

registerCommand({
  id: 'cancel',
  patterns: [
    /^(iptal|vazgeç|cancel|kapat)$/i,
    /^(boşver|bırak)$/i,
  ],
  flowStates: [],
  description: 'Aktif işlemi iptal eder',
  hint: 'İptal',
  icon: 'x-circle',

  execute(_input, ctx) {
    if (ctx.flow !== 'idle') {
      return { flow: 'idle', draft: {}, message: 'İptal edildi.' };
    }
    return { flow: 'idle', message: 'Tamam.' };
  },
});
