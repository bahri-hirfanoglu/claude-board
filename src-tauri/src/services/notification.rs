use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;
use crate::db::{self, settings};

// ─── i18n strings ───

struct Strings {
    task_started: &'static str,
    task_completed: &'static str,
    task_failed: &'static str,
    test_passed: &'static str,
    test_failed: &'static str,
    revision_requested: &'static str,
    queue_started: &'static str,
    body_started: &'static str,
    body_completed: &'static str,
    body_failed: &'static str,
    body_test_passed: &'static str,
    body_test_failed: &'static str,
    body_revision: &'static str,
    body_queue: &'static str,
    body_unknown_error: &'static str,
}

fn strings(lang: &str) -> Strings {
    match lang {
        "tr" => Strings {
            task_started:       "G\u{00f6}rev Ba\u{015f}lad\u{0131}",
            task_completed:     "G\u{00f6}rev Tamamland\u{0131}",
            task_failed:        "G\u{00f6}rev Ba\u{015f}ar\u{0131}s\u{0131}z",
            test_passed:        "Test Ge\u{00e7}ti",
            test_failed:        "Test Ba\u{015f}ar\u{0131}s\u{0131}z",
            revision_requested: "Revizyon \u{0130}stendi",
            queue_started:      "Kuyruktan Ba\u{015f}lat\u{0131}ld\u{0131}",
            body_started:       "Claude \u{00e7}al\u{0131}\u{015f}maya ba\u{015f}lad\u{0131}",
            body_completed:     "Tamamland\u{0131} \u{2014} inceleme bekliyor",
            body_failed:        "Ba\u{015f}ar\u{0131}s\u{0131}z",
            body_test_passed:   "Otomatik test ge\u{00e7}ti \u{2014} onayland\u{0131}",
            body_test_failed:   "Otomatik test ba\u{015f}ar\u{0131}s\u{0131}z \u{2014} revizyon gerekli",
            body_revision:      "Claude\u{2019}a revizyon g\u{00f6}nderildi",
            body_queue:         "Kuyruktan otomatik ba\u{015f}lat\u{0131}ld\u{0131}",
            body_unknown_error: "bilinmeyen hata",
        },
        _ => Strings {
            task_started:       "Task Started",
            task_completed:     "Task Completed",
            task_failed:        "Task Failed",
            test_passed:        "Test Passed",
            test_failed:        "Test Failed",
            revision_requested: "Revision Requested",
            queue_started:      "Queue Started",
            body_started:       "Claude started working",
            body_completed:     "Completed \u{2014} ready for review",
            body_failed:        "Failed",
            body_test_passed:   "Auto-test passed \u{2014} approved",
            body_test_failed:   "Auto-test failed \u{2014} revision needed",
            body_revision:      "Revision feedback sent to Claude",
            body_queue:         "Auto-started from queue",
            body_unknown_error: "unknown error",
        },
    }
}

// ─── TaskNotification info ───

pub struct TaskNotification<'a> {
    pub title: &'a str,
    pub task_key: Option<&'a str>,
}

impl<'a> TaskNotification<'a> {
    pub fn new(title: &'a str, task_key: Option<&'a str>) -> Self {
        Self { title, task_key }
    }

    fn format_tag(&self) -> String {
        match self.task_key {
            Some(key) if !key.is_empty() => format!("[{}]", key),
            _ => String::new(),
        }
    }

    fn body_line(&self) -> String {
        let tag = self.format_tag();
        if tag.is_empty() { self.title.to_string() } else { format!("{} {}", tag, self.title) }
    }
}

// ─── Public API ───

pub fn notify_task_started(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_task_started { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{25B6} {}", info.body_line(), i.body_started);
    send(app, &format!("Claude Board \u{2014} {}", i.task_started), &body);
}

pub fn notify_task_completed(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_task_completed { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{2714} {}", info.body_line(), i.body_completed);
    send(app, &format!("Claude Board \u{2014} {}", i.task_completed), &body);
}

pub fn notify_task_failed(app: &AppHandle, info: &TaskNotification, reason: &str) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_task_failed { return; }
    let i = strings(&s.language);
    let detail = if reason.is_empty() { i.body_unknown_error.to_string() } else { reason.to_string() };
    let body = format!("{}\n\u{2718} {}: {}", info.body_line(), i.body_failed, detail);
    send(app, &format!("Claude Board \u{2014} {}", i.task_failed), &body);
}

pub fn notify_revision_requested(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_revision_requested { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{21BB} {}", info.body_line(), i.body_revision);
    send(app, &format!("Claude Board \u{2014} {}", i.revision_requested), &body);
}

pub fn notify_queue_started(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_queue_started { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{23F5} {}", info.body_line(), i.body_queue);
    send(app, &format!("Claude Board \u{2014} {}", i.queue_started), &body);
}

pub fn notify_test_passed(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_task_completed { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{2714} {}", info.body_line(), i.body_test_passed);
    send(app, &format!("Claude Board \u{2014} {}", i.test_passed), &body);
}

pub fn notify_test_failed(app: &AppHandle, info: &TaskNotification) {
    let db = db::get_db();
    let s = settings::get(&db);
    if !s.notify_task_failed { return; }
    let i = strings(&s.language);
    let body = format!("{}\n\u{2718} {}", info.body_line(), i.body_test_failed);
    send(app, &format!("Claude Board \u{2014} {}", i.test_failed), &body);
}

// ─── Internal ───

fn send(app: &AppHandle, title: &str, body: &str) {
    let mut builder = app.notification()
        .builder()
        .title(title)
        .body(body);

    // Set app icon for the notification
    if let Ok(resource_dir) = app.path().resource_dir() {
        let icon_path: std::path::PathBuf = resource_dir.join("icons").join("32x32.png");
        if icon_path.exists() {
            builder = builder.icon(icon_path.to_string_lossy().into_owned());
        }
    }

    builder.show().ok();
}
