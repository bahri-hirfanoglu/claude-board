import { registerCommand } from './commandRegistry';

const STATUS_LABELS = {
  backlog: 'Backlog',
  in_progress: 'Devam Ediyor',
  testing: 'Test',
  done: 'Tamamlandı',
};

registerCommand({
  id: 'list_tasks',
  patterns: [
    /görevleri? (listele|göster|say|getir)/i,
    /(kaç|ne kadar) görev var/i,
    /task(lar|ler)ı? (listele|göster)/i,
    /(list|show) tasks/i,
    /backlog'?da ne var/i,
    /neler var/i,
  ],
  flowStates: [],
  description: 'Görevlerin duruma göre dağılımını gösterir',
  hint: 'Görevleri listele',
  icon: 'list',

  execute(_input, ctx) {
    const { tasks } = ctx;
    if (!tasks || tasks.length === 0) {
      return { flow: 'idle', message: 'Henüz görev yok.' };
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
      message: `Toplam ${tasks.length} görev var. ${parts}.`,
    };
  },
});
