import { registerCommand } from './commandRegistry';

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'Devam Ediyor',
  testing: 'Test',
  done: 'Tamamlandı',
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
    /durumu? (değiştir|güncelle)/i,
    /status (değiştir|change)/i,
    /(başlat|start)/i,
    /done'?a (taşı|geçir|al)/i,
    /test'?e (taşı|geçir|al|gönder)/i,
    /tamamla|bitir/i,
  ],
  flowStates: Object.values(FLOWS),
  description: 'Bir görevin durumunu değiştirir',
  hint: 'Durum değiştir',
  icon: 'arrow-right',

  execute(input, ctx) {
    const { flow, intent, tasks, refs } = ctx;

    // ─── Entry ───
    if (flow === 'idle') {
      if (!tasks || tasks.length === 0) {
        return { flow: 'idle', message: 'Henüz görev yok.' };
      }
      return { flow: FLOWS.WHICH, message: 'Hangi görevin durumunu değiştirmek istiyorsun?' };
    }

    if (intent?.id === 'cancel') {
      return { flow: 'idle', message: 'İptal edildi.' };
    }

    // ─── Select task ───
    if (flow === FLOWS.WHICH) {
      const lower = input.toLowerCase();
      const match = tasks.find(t =>
        t.title.toLowerCase().includes(lower) ||
        t.task_key?.toLowerCase() === lower ||
        `#${t.id}` === input
      );

      if (!match) {
        return { flow: FLOWS.WHICH, message: 'Bu isimde görev bulamadım. Tekrar dener misin?' };
      }

      refs.statusTarget = match;
      const next = STATUS_NEXT[match.status];
      if (!next) {
        return { flow: 'idle', message: `"${match.title}" zaten tamamlanmış.` };
      }

      return {
        flow: FLOWS.TO,
        message: `"${match.title}" şu an ${STATUS_LABELS[match.status]}. ${STATUS_LABELS[next]}'a taşıyayım mı?`,
      };
    }

    // ─── Select target status ───
    if (flow === FLOWS.TO) {
      const task = refs.statusTarget;
      if (!task) return { flow: 'idle', message: 'Bir hata oluştu.' };

      // Confirm → next in flow
      if (intent?.id === 'confirm') {
        const next = STATUS_NEXT[task.status];
        if (next) {
          return {
            flow: 'idle',
            message: `"${task.title}" ${STATUS_LABELS[next]} durumuna taşındı.`,
            action: (h) => h.onStatusChange?.(task.id, next),
          };
        }
        return { flow: 'idle', message: 'Taşınamıyor.' };
      }

      // Parse specific status name
      const lower = input.toLowerCase();
      let target = null;
      if (/backlog/i.test(lower)) target = 'backlog';
      else if (/devam|progress|başla/i.test(lower)) target = 'in_progress';
      else if (/test/i.test(lower)) target = 'testing';
      else if (/done|tamam|bitir|tamamla/i.test(lower)) target = 'done';

      if (target && target !== task.status) {
        return {
          flow: 'idle',
          message: `"${task.title}" ${STATUS_LABELS[target]} durumuna taşındı.`,
          action: (h) => h.onStatusChange?.(task.id, target),
        };
      }

      return { flow: FLOWS.TO, message: 'Backlog, devam ediyor, test veya tamamlandı diyebilirsin.' };
    }

    return null;
  },
});
