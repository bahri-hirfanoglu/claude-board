import { registerCommand } from './commandRegistry';
import { extractTaskType, extractPriority, priorityLabel } from '../intent/entityExtractors';

const FLOWS = {
  TITLE: 'create:title',
  DESC: 'create:desc',
  TYPE: 'create:type',
  PRIORITY: 'create:priority',
  CONFIRM: 'create:confirm',
};

registerCommand({
  id: 'create_task',
  patterns: [
    /görev (oluştur|aç|ekle|yarat)/i,
    /yeni (görev|task)/i,
    /task (oluştur|aç|ekle|create)/i,
    /create ?(a )?(new )?task/i,
    /new task/i,
  ],
  flowStates: Object.values(FLOWS),
  description: 'Yeni görev oluşturur — başlık, açıklama, tür ve öncelik sorar',
  hint: 'Görev oluştur',
  icon: 'plus-circle',

  execute(input, ctx) {
    const { flow, draft, intent } = ctx;

    // ─── Entry point ───
    if (flow === 'idle') {
      if (!ctx.currentProject) {
        return { flow: 'idle', message: 'Önce bir proje seçmelisin.' };
      }
      return { flow: FLOWS.TITLE, draft: {}, message: 'Görevin başlığı ne olsun?' };
    }

    // Cancel at any step
    if (intent?.id === 'cancel') {
      return { flow: 'idle', draft: {}, message: 'Görev oluşturma iptal edildi.' };
    }

    // ─── Title ───
    if (flow === FLOWS.TITLE) {
      return {
        flow: FLOWS.DESC,
        draft: { ...draft, title: input },
        message: 'Açıklama eklemek ister misin? İstemiyorsan "geç" de.',
      };
    }

    // ─── Description ───
    if (flow === FLOWS.DESC) {
      const skip = /^(geç|skip|yok|boş|pas)$/i.test(input);
      return {
        flow: FLOWS.TYPE,
        draft: { ...draft, description: skip ? '' : input },
        message: 'Görev türü? Feature, bugfix, refactor, docs, test veya chore.',
      };
    }

    // ─── Type ───
    if (flow === FLOWS.TYPE) {
      const type = extractTaskType(input) || 'feature';
      return {
        flow: FLOWS.PRIORITY,
        draft: { ...draft, task_type: type },
        message: `Tür: ${type}. Öncelik? Yok, düşük, orta veya yüksek.`,
      };
    }

    // ─── Priority ───
    if (flow === FLOWS.PRIORITY) {
      const priority = extractPriority(input) ?? 0;
      const d = { ...draft, priority };
      return {
        flow: FLOWS.CONFIRM,
        draft: d,
        message: `"${d.title}" — ${d.task_type}, ${priorityLabel(priority)}. Oluşturayım mı?`,
      };
    }

    // ─── Confirm ───
    if (flow === FLOWS.CONFIRM) {
      if (intent?.id === 'confirm') {
        return {
          flow: 'idle',
          draft: {},
          message: `Görev oluşturuldu: "${draft.title}"`,
          action: (handlers) => {
            handlers.onCreateTask?.({
              title: draft.title,
              description: draft.description || '',
              task_type: draft.task_type || 'feature',
              priority: draft.priority || 0,
              model: 'sonnet',
            });
          },
        };
      }
      if (intent?.id === 'deny') {
        return { flow: 'idle', draft: {}, message: 'İptal edildi.' };
      }
      return { flow: FLOWS.CONFIRM, message: 'Evet veya hayır de.' };
    }

    return null;
  },
});
