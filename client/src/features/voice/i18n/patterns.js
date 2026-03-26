/**
 * Multi-language patterns for intent detection and entity extraction.
 * English patterns are always included as fallback.
 */

// ─── Conversational intents ───
export const CONFIRM_PATTERNS = [
  /^(yes|yeah|yep|sure|ok|okay|confirm|correct|right|do it|go ahead)/i,
  /^(evet|tamam|olur|onay|doğru|yap|devam)/i, // tr
  /^(ja|jawohl|klar|richtig|genau|mach es)/i, // de
  /^(oui|ouais|bien sûr|d'accord|exact|confirmer)/i, // fr
  /^(sí|si|claro|vale|correcto|adelante|confirmar)/i, // es
  /^(sim|claro|certo|confirmar|isso)/i, // pt
  /^(sì|certo|esatto|conferma|vai)/i, // it
  /^(да|конечно|верно|подтвердить|давай)/i, // ru
  /^(ja|zeker|goed|klopt|bevestig)/i, // nl
  /^(tak|jasne|dobrze|potwierdź)/i, // pl
  /^(はい|うん|そうです|確認)/i, // ja
  /^(네|예|맞아|확인)/i, // ko
  /^(是|好|对|确认|没问题)/i, // zh
  /^(نعم|أكيد|صحيح|موافق)/i, // ar
  /^(हाँ|हां|ठीक|सही|पक्का)/i, // hi
];

export const DENY_PATTERNS = [
  /^(no|nope|nah|don't|negative)/i,
  /^(hayır|yok|istemiyorum|vazgeç)/i, // tr
  /^(nein|nicht|negativ|abbrechen)/i, // de
  /^(non|pas|annuler)/i, // fr
  /^(no|nada|cancelar)/i, // es
  /^(não|nao|cancelar)/i, // pt
  /^(no|niente|annulla)/i, // it
  /^(нет|не|отмена)/i, // ru
  /^(nee|niet|annuleer)/i, // nl
  /^(nie|anuluj)/i, // pl
  /^(いいえ|ちがう|キャンセル)/i, // ja
  /^(아니|아니요|취소)/i, // ko
  /^(不|不是|取消)/i, // zh
  /^(لا|إلغاء)/i, // ar
  /^(नहीं|रद्द)/i, // hi
];

// ─── Command trigger patterns ───
export const CREATE_TASK_PATTERNS = [
  /create ?(a )?(new )?task/i,
  /new task/i,
  /add ?(a )?(new )?task/i,
  /open ?(a )?task/i,
  /görev oluştur/i,
  /yeni görev/i,
  /görev ekle/i,
  /görev aç/i, // tr
  /aufgabe erstellen/i,
  /neue aufgabe/i, // de
  /créer ?(une )?tâche/i,
  /nouvelle tâche/i, // fr
  /crear ?(una )?tarea/i,
  /nueva tarea/i, // es
  /criar ?(uma )?tarefa/i,
  /nova tarefa/i, // pt
  /crea(re)? ?(un )?attività/i,
  /nuova attività/i, // it
  /создать задачу/i,
  /новая задача/i, // ru
  /taak (aan)?maken/i,
  /nieuwe taak/i, // nl
  /utwórz zadanie/i,
  /nowe zadanie/i, // pl
  /タスク(を)?作成/i,
  /新しいタスク/i, // ja
  /태스크 (생성|만들기)/i,
  /새 태스크/i, // ko
  /(创建|新建)任务/i, // zh
  /إنشاء مهمة/i,
  /مهمة جديدة/i, // ar
  /टास्क बनाए/i,
  /नया टास्क/i, // hi
];

export const LIST_TASKS_PATTERNS = [
  /(list|show|display) ?(all )?(the )?tasks/i,
  /how many tasks/i,
  /what('s| is) in (the )?backlog/i,
  /task (summary|overview|count)/i,
  /what do we have/i,
  /görevleri (listele|göster)/i,
  /kaç görev/i,
  /görev özeti/i, // tr
  /aufgaben (auflisten|anzeigen)/i,
  /wie viele aufgaben/i, // de
  /(lister|afficher|montrer) ?(les )?tâches/i, // fr
  /(listar|mostrar) ?(las )?tareas/i,
  /cuántas tareas/i, // es
  /(listar|mostrar) ?(as )?tarefas/i,
  /quantas tarefas/i, // pt
  /(lista|mostra) ?(le )?attività/i, // it
  /(показать|список) задач/i,
  /сколько задач/i, // ru
  /taken (weergeven|tonen)/i,
  /hoeveel taken/i, // nl
  /(lista|pokaż) zada(nia|ń)/i,
  /ile zada/i, // pl
  /タスク(を)?(一覧|表示|リスト)/i, // ja
  /태스크 (목록|보기)/i, // ko
  /(列出|显示|查看)任务/i,
  /多少任务/i, // zh
  /(عرض|قائمة) المهام/i, // ar
  /टास्क (सूची|दिखाओ)/i, // hi
];

export const CHANGE_STATUS_PATTERNS = [
  /change ?(the )?(task )?status/i,
  /move ?(a )?task/i,
  /update ?(the )?(task )?status/i,
  /(start|begin) ?(a )?task/i,
  /mark ?(as )?(done|complete)/i,
  /send to (testing|test)/i,
  /durum(u)? (değiştir|güncelle)/i,
  /görevi taşı/i,
  /görevi başlat/i,
  /tamamlandı (olarak )?işaretle/i, // tr
  /status ändern/i,
  /aufgabe (verschieben|starten)/i, // de
  /changer ?(le )?statut/i,
  /déplacer ?(une )?tâche/i, // fr
  /cambiar ?(el )?estado/i,
  /mover ?(una )?tarea/i, // es
  /(mudar|alterar) ?(o )?status/i,
  /mover ?(uma )?tarefa/i, // pt
  /cambia(re)? ?(lo )?stato/i,
  /sposta(re)? ?(un )?attività/i, // it
  /(изменить|обновить) статус/i,
  /переместить задачу/i, // ru
  /status (wijzigen|veranderen)/i,
  /taak verplaatsen/i, // nl
  /(zmień|aktualizuj) status/i,
  /przenieś zadanie/i, // pl
  /ステータス(を)?変更/i,
  /タスク(を)?移動/i, // ja
  /상태 (변경|바꾸기)/i,
  /태스크 이동/i, // ko
  /(更改|变更)状态/i,
  /移动任务/i, // zh
  /تغيير (الحالة|حالة)/i,
  /نقل مهمة/i, // ar
  /स्थिति बदल/i,
  /टास्क (ले जाओ|शुरू करो)/i, // hi
];

export const HELP_PATTERNS = [
  /^help$/i,
  /what can you do/i,
  /commands/i,
  /how (do|to) (I )?use/i,
  /^yardım$/i,
  /ne yapabilirsin/i,
  /komutlar/i, // tr
  /^hilfe$/i,
  /was kannst du/i,
  /befehle/i, // de
  /^aide$/i,
  /que (peux|pouvez)/i,
  /commandes/i, // fr
  /^ayuda$/i,
  /qué puedes/i,
  /comandos/i, // es
  /^ajuda$/i,
  /o que (você )?pode/i,
  /comandos/i, // pt
  /^aiuto$/i,
  /cosa puoi/i,
  /comandi/i, // it
  /^помощь$/i,
  /что (ты )?умеешь/i,
  /команды/i, // ru
  /^help$/i,
  /wat kun je/i,
  /commando/i, // nl
  /^pomoc$/i,
  /co (możesz|potrafisz)/i,
  /komendy/i, // pl
  /^ヘルプ$/i,
  /何ができ/i,
  /コマンド/i, // ja
  /^도움말$/i,
  /뭐 할 수 있/i,
  /명령어/i, // ko
  /^帮助$/i,
  /你能做什么/i,
  /命令/i, // zh
  /^مساعدة$/i,
  /ماذا يمكنك/i,
  /الأوامر/i, // ar
  /^मदद$/i,
  /क्या कर सकत/i,
  /कमांड/i, // hi
];

export const CANCEL_PATTERNS = [
  /^(cancel|stop|abort|quit|close|nevermind)$/i,
  /^(never ?mind)$/i,
  /^(iptal|dur|kapat|vazgeç|boşver)$/i, // tr
  /^(abbrechen|stopp|beenden)$/i, // de
  /^(annuler|arrêter|fermer)$/i, // fr
  /^(cancelar|parar|cerrar)$/i, // es
  /^(cancelar|parar|fechar)$/i, // pt
  /^(annulla|ferma|chiudi)$/i, // it
  /^(отмена|стоп|закрыть)$/i, // ru
  /^(annuleren|stop|sluiten)$/i, // nl
  /^(anuluj|stop|zamknij)$/i, // pl
  /^(キャンセル|やめる|中止)$/i, // ja
  /^(취소|중지|닫기)$/i, // ko
  /^(取消|停止|关闭)$/i, // zh
  /^(إلغاء|توقف|أغلق)$/i, // ar
  /^(रद्द|बंद|रुको)$/i, // hi
];

// ─── Entity extraction: skip/pass ───
export const SKIP_PATTERN =
  /^(skip|no|none|empty|pass|geç|hayır|yok|überspringen|nein|passer|non|saltar|pular|não|salta|overslaan|pomiń|スキップ|건너뛰기|跳过|تخطي|छोड़ें|пропустить)$/i;

// ─── Entity extraction: task types ───
export const TYPE_MAP = {
  feature: [
    'feature',
    'new feature',
    'özellik',
    'yeni özellik',
    'fonctionnalité',
    'funcionalidad',
    'funcionalidade',
    'funzionalità',
    'funktionalität',
    'функция',
    'feature',
    'funkcja',
    '機能',
    '기능',
    '功能',
    'ميزة',
    'फीचर',
  ],
  bugfix: [
    'bugfix',
    'bug',
    'bug fix',
    'fix',
    'hata',
    'hata düzeltme',
    'düzeltme',
    'correction',
    'corrección',
    'correção',
    'correzione',
    'fehler',
    'fehlerbehebung',
    'исправление',
    'баг',
    'poprawka',
    'バグ',
    '버그',
    '修复',
    'إصلاح',
    'बग',
  ],
  refactor: [
    'refactor',
    'refactoring',
    'cleanup',
    'refaktör',
    'yeniden düzenleme',
    'refactoring',
    'refactorización',
    'refatoração',
    'refaktoryzacja',
    'рефакторинг',
    'リファクタリング',
    '리팩토링',
    '重构',
    'إعادة هيكلة',
    'रीफैक्टर',
  ],
  docs: [
    'docs',
    'documentation',
    'document',
    'doküman',
    'dokümantasyon',
    'documentation',
    'documentación',
    'documentação',
    'documentazione',
    'dokumentation',
    'документация',
    'dokumentacja',
    'ドキュメント',
    '문서',
    '文档',
    'توثيق',
    'डॉक्स',
  ],
  test: ['test', 'testing', 'teste', 'тест', 'テスト', '테스트', '测试', 'اختبار', 'टेस्ट'],
  chore: [
    'chore',
    'maintenance',
    'bakım',
    'wartung',
    'maintenance',
    'mantenimiento',
    'manutenção',
    'manutenzione',
    'обслуживание',
    'konserwacja',
    'メンテナンス',
    '유지보수',
    '维护',
    'صيانة',
    'मेंटेनेंस',
  ],
};

// ─── Entity extraction: priorities ───
export const PRIORITY_MAP = {
  0: [
    'none',
    'no priority',
    'skip',
    'yok',
    'keine',
    'aucune',
    'ninguna',
    'nenhuma',
    'nessuna',
    'нет',
    'brak',
    'geen',
    'なし',
    '없음',
    '无',
    'بدون',
    'कोई नहीं',
  ],
  1: [
    'low',
    'düşük',
    'niedrig',
    'basse',
    'baja',
    'baixa',
    'bassa',
    'низкий',
    'niski',
    'laag',
    '低',
    '낮음',
    '低',
    'منخفضة',
    'कम',
  ],
  2: [
    'medium',
    'normal',
    'moderate',
    'orta',
    'mittel',
    'moyenne',
    'media',
    'média',
    'средний',
    'średni',
    'gemiddeld',
    '中',
    '보통',
    '中',
    'متوسطة',
    'मध्यम',
  ],
  3: [
    'high',
    'urgent',
    'critical',
    'important',
    'yüksek',
    'acil',
    'hoch',
    'haute',
    'alta',
    'высокий',
    'wysoki',
    'hoog',
    '高',
    '높음',
    '高',
    'عالية',
    'उच्च',
  ],
};

// ─── Entity extraction: statuses (for change-status command) ───
export const STATUS_PATTERNS = {
  backlog:
    /backlog|beklemede|warteschlange|pendiente|pendente|бэклог|oczekuje|wachtlijst|バックログ|백로그|待办|قائمة الانتظار|बैकलॉग/i,
  in_progress:
    /progress|start|devam|başla|bearbeitung|en cours|progreso|progresso|в работе|w toku|uitvoering|進行中|진행중|进行中|قيد التنفيذ|चल रहा/i,
  testing: /test|teste|тест|テスト|테스트|测试|اختبار|टेस्ट/i,
  done: /done|complete|finish|tamamlandı|bitti|erledigt|terminé|completada|concluído|completata|готово|ukończone|voltooid|完了|완료|完成|مكتمل|पूरा/i,
};
