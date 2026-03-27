use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CountRow {
    pub label: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DurationStats {
    pub avg_minutes: Option<f64>,
    pub min_minutes: Option<f64>,
    pub max_minutes: Option<f64>,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelinePoint {
    pub day: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentCompleted {
    pub id: i64,
    pub title: String,
    pub task_type: Option<String>,
    pub priority: Option<i64>,
    pub model: Option<String>,
    pub model_used: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub total_cost: Option<f64>,
    pub num_turns: Option<i64>,
    pub rate_limit_hits: Option<i64>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub work_duration_ms: Option<i64>,
    pub duration_minutes: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeUsage {
    pub total_input_tokens: Option<i64>,
    pub total_output_tokens: Option<i64>,
    pub total_cache_read: Option<i64>,
    pub total_cache_creation: Option<i64>,
    pub total_cost: Option<f64>,
    pub total_turns: Option<i64>,
    pub total_rate_limits: Option<i64>,
    pub tasks_with_usage: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelBreakdown {
    pub model_name: String,
    pub count: i64,
    pub total_tokens: Option<i64>,
    pub total_cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read: Option<i64>,
    pub cache_creation: Option<i64>,
    pub total_cost: Option<f64>,
    pub total_turns: Option<i64>,
    pub rate_limit_hits: Option<i64>,
    pub tasks_with_usage: Option<i64>,
    pub total_tasks: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalModelRow {
    pub model: String,
    pub tasks: i64,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageTimelinePoint {
    pub day: String,
    pub tokens: Option<i64>,
    pub cost: Option<f64>,
    pub tasks: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeLimits {
    pub id: Option<i64>,
    pub rate_limit_type: Option<String>,
    pub status: Option<String>,
    pub resets_at: Option<i64>,
    pub overage_status: Option<String>,
    pub is_using_overage: Option<i64>,
    pub last_model: Option<String>,
    pub last_cost_usd: Option<f64>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub by_status: Vec<CountRow>,
    pub by_priority: Vec<CountRow>,
    pub by_type: Vec<CountRow>,
    pub duration: DurationStats,
    pub timeline: Vec<TimelinePoint>,
    pub recent_completed: Vec<RecentCompleted>,
    pub claude_usage: ClaudeUsage,
    pub model_breakdown: Vec<ModelBreakdown>,
}

fn normalize_model(raw: &str) -> String {
    if raw.is_empty() { return "unknown".to_string(); }
    let lower = raw.to_lowercase();
    if lower.contains("opus") { "opus".to_string() }
    else if lower.contains("sonnet") { "sonnet".to_string() }
    else if lower.contains("haiku") { "haiku".to_string() }
    else { raw.to_string() }
}

pub fn get_project_stats(db: &DbPool, pid: i64) -> ProjectStats {
    let conn = db.lock();

    let by_status = {
        let mut s = match conn.prepare("SELECT status,COUNT(*) as count FROM tasks WHERE project_id=?1 GROUP BY status") {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(by_status): {}", e); return ProjectStats { by_status: vec![], by_priority: vec![], by_type: vec![], duration: DurationStats::default(), timeline: vec![], recent_completed: vec![], claude_usage: ClaudeUsage::default(), model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(CountRow { label: r.get(0)?, count: r.get(1)? })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(by_status): {}", e); vec![] }
        };
        result
    };

    let by_priority = {
        let mut s = match conn.prepare("SELECT priority,COUNT(*) as count FROM tasks WHERE project_id=?1 GROUP BY priority") {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(by_priority): {}", e); return ProjectStats { by_status, by_priority: vec![], by_type: vec![], duration: DurationStats::default(), timeline: vec![], recent_completed: vec![], claude_usage: ClaudeUsage::default(), model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(CountRow { label: format!("{}", r.get::<_, i64>(0)?), count: r.get(1)? })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(by_priority): {}", e); vec![] }
        };
        result
    };

    let by_type = {
        let mut s = match conn.prepare("SELECT task_type,COUNT(*) as count FROM tasks WHERE project_id=?1 GROUP BY task_type") {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(by_type): {}", e); return ProjectStats { by_status, by_priority, by_type: vec![], duration: DurationStats::default(), timeline: vec![], recent_completed: vec![], claude_usage: ClaudeUsage::default(), model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(CountRow { label: r.get(0)?, count: r.get(1)? })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(by_type): {}", e); vec![] }
        };
        result
    };

    let duration = match conn.prepare(
        "SELECT AVG(CASE WHEN work_duration_ms>0 THEN work_duration_ms/60000.0 ELSE (julianday(completed_at)-julianday(started_at))*24*60 END) as avg_minutes,
                MIN(CASE WHEN work_duration_ms>0 THEN work_duration_ms/60000.0 ELSE (julianday(completed_at)-julianday(started_at))*24*60 END) as min_minutes,
                MAX(CASE WHEN work_duration_ms>0 THEN work_duration_ms/60000.0 ELSE (julianday(completed_at)-julianday(started_at))*24*60 END) as max_minutes,
                COUNT(*) as count
         FROM tasks WHERE project_id=?1 AND started_at IS NOT NULL AND completed_at IS NOT NULL"
    ) {
        Ok(mut s) => s.query_row(params![pid], |r| Ok(DurationStats {
            avg_minutes: r.get(0).ok(),
            min_minutes: r.get(1).ok(),
            max_minutes: r.get(2).ok(),
            count: r.get(3).unwrap_or(0),
        })).unwrap_or_default(),
        Err(e) => { log::error!("get_project_stats(duration): {}", e); DurationStats::default() }
    };

    let timeline = {
        let mut s = match conn.prepare(
            "SELECT date(completed_at) as day,COUNT(*) as count FROM tasks WHERE project_id=?1 AND completed_at IS NOT NULL AND completed_at>=datetime('now','-14 days') GROUP BY date(completed_at) ORDER BY day"
        ) {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(timeline): {}", e); return ProjectStats { by_status, by_priority, by_type, duration, timeline: vec![], recent_completed: vec![], claude_usage: ClaudeUsage::default(), model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(TimelinePoint { day: r.get(0)?, count: r.get(1)? })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(timeline): {}", e); vec![] }
        };
        result
    };

    let recent_completed = {
        let mut s = match conn.prepare(
            "SELECT id,title,task_type,priority,model,model_used,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens,total_cost,num_turns,rate_limit_hits,started_at,completed_at,work_duration_ms,ROUND(CASE WHEN work_duration_ms>0 THEN work_duration_ms/60000.0 ELSE (julianday(completed_at)-julianday(started_at))*24*60 END,1) as duration_minutes FROM tasks WHERE project_id=?1 AND started_at IS NOT NULL AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 10"
        ) {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(recent_completed): {}", e); return ProjectStats { by_status, by_priority, by_type, duration, timeline, recent_completed: vec![], claude_usage: ClaudeUsage::default(), model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(RecentCompleted {
            id: r.get(0)?, title: r.get(1)?, task_type: r.get(2)?, priority: r.get(3)?,
            model: r.get(4)?, model_used: r.get(5)?, input_tokens: r.get(6)?, output_tokens: r.get(7)?,
            cache_read_tokens: r.get(8)?, cache_creation_tokens: r.get(9)?, total_cost: r.get(10)?,
            num_turns: r.get(11)?, rate_limit_hits: r.get(12)?, started_at: r.get(13)?,
            completed_at: r.get(14)?, work_duration_ms: r.get(15)?, duration_minutes: r.get(16)?,
        })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(recent_completed): {}", e); vec![] }
        };
        result
    };

    let claude_usage = match conn.prepare(
        "SELECT SUM(COALESCE(input_tokens,0)),SUM(COALESCE(output_tokens,0)),SUM(COALESCE(cache_read_tokens,0)),SUM(COALESCE(cache_creation_tokens,0)),SUM(COALESCE(total_cost,0)),SUM(COALESCE(num_turns,0)),SUM(COALESCE(rate_limit_hits,0)),COUNT(CASE WHEN input_tokens>0 THEN 1 END) FROM tasks WHERE project_id=?1"
    ) {
        Ok(mut s) => s.query_row(params![pid], |r| Ok(ClaudeUsage {
            total_input_tokens: r.get(0).ok(), total_output_tokens: r.get(1).ok(),
            total_cache_read: r.get(2).ok(), total_cache_creation: r.get(3).ok(),
            total_cost: r.get(4).ok(), total_turns: r.get(5).ok(),
            total_rate_limits: r.get(6).ok(), tasks_with_usage: r.get(7).ok(),
        })).unwrap_or_default(),
        Err(e) => { log::error!("get_project_stats(claude_usage): {}", e); ClaudeUsage::default() }
    };

    let raw_breakdown: Vec<ModelBreakdown> = {
        let mut s = match conn.prepare(
            "SELECT COALESCE(NULLIF(model_used,''),NULLIF(model,''),'unknown') as model_name, COUNT(*) as count, SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)) as total_tokens, SUM(COALESCE(total_cost,0)) as total_cost FROM tasks WHERE project_id=?1 AND (input_tokens>0 OR status IN ('in_progress','testing','done')) GROUP BY model_name"
        ) {
            Ok(s) => s,
            Err(e) => { log::error!("get_project_stats(model_breakdown): {}", e); return ProjectStats { by_status, by_priority, by_type, duration, timeline, recent_completed, claude_usage, model_breakdown: vec![] }; }
        };
        let result = match s.query_map(params![pid], |r| Ok(ModelBreakdown {
            model_name: r.get(0)?, count: r.get(1)?,
            total_tokens: r.get(2).ok(), total_cost: r.get(3).ok(),
        })) {
            Ok(rows) => rows.flatten().collect(),
            Err(e) => { log::error!("get_project_stats(model_breakdown): {}", e); vec![] }
        };
        result
    };

    // Merge model rows by normalized name
    let model_breakdown = merge_model_breakdown(raw_breakdown);

    ProjectStats { by_status, by_priority, by_type, duration, timeline, recent_completed, claude_usage, model_breakdown }
}

fn merge_model_breakdown(rows: Vec<ModelBreakdown>) -> Vec<ModelBreakdown> {
    let mut map = std::collections::HashMap::new();
    for row in rows {
        let name = normalize_model(&row.model_name);
        let entry = map.entry(name.clone()).or_insert(ModelBreakdown {
            model_name: name, count: 0, total_tokens: Some(0), total_cost: Some(0.0),
        });
        entry.count += row.count;
        if let Some(t) = entry.total_tokens.as_mut() { *t += row.total_tokens.unwrap_or(0); }
        if let Some(c) = entry.total_cost.as_mut() { *c += row.total_cost.unwrap_or(0.0); }
    }
    map.into_values().collect()
}

pub fn get_global_usage(db: &DbPool) -> GlobalUsage {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT SUM(COALESCE(input_tokens,0)),SUM(COALESCE(output_tokens,0)),SUM(COALESCE(cache_read_tokens,0)),SUM(COALESCE(cache_creation_tokens,0)),SUM(COALESCE(total_cost,0)),SUM(COALESCE(num_turns,0)),SUM(COALESCE(rate_limit_hits,0)),COUNT(CASE WHEN input_tokens>0 THEN 1 END),COUNT(*) FROM tasks") {
        Ok(s) => s,
        Err(e) => { log::error!("get_global_usage: {}", e); return GlobalUsage::default(); }
    };
    stmt.query_row([], |r| Ok(GlobalUsage {
            input_tokens: r.get(0).ok(), output_tokens: r.get(1).ok(),
            cache_read: r.get(2).ok(), cache_creation: r.get(3).ok(),
            total_cost: r.get(4).ok(), total_turns: r.get(5).ok(),
            rate_limit_hits: r.get(6).ok(), tasks_with_usage: r.get(7).ok(),
            total_tasks: r.get(8).ok(),
        })).unwrap_or_default()
}

pub fn get_global_model_breakdown(db: &DbPool) -> Vec<GlobalModelRow> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT COALESCE(NULLIF(model_used,''),NULLIF(model,''),'unknown') as model, COUNT(*) as tasks, SUM(COALESCE(input_tokens,0)) as input_tokens, SUM(COALESCE(output_tokens,0)) as output_tokens, SUM(COALESCE(total_cost,0)) as cost FROM tasks WHERE input_tokens>0 GROUP BY model ORDER BY cost DESC"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_global_model_breakdown: {}", e); return vec![]; }
    };
    let raw: Vec<GlobalModelRow> = match stmt.query_map([], |r| Ok(GlobalModelRow {
        model: r.get(0)?, tasks: r.get(1)?,
        input_tokens: r.get(2).ok(), output_tokens: r.get(3).ok(), cost: r.get(4).ok(),
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_global_model_breakdown: {}", e); return vec![]; }
    };

    // Merge by normalized name
    let mut map: std::collections::HashMap<String, GlobalModelRow> = std::collections::HashMap::new();
    for row in raw {
        let name = normalize_model(&row.model);
        let entry = map.entry(name.clone()).or_insert(GlobalModelRow {
            model: name, tasks: 0, input_tokens: Some(0), output_tokens: Some(0), cost: Some(0.0),
        });
        entry.tasks += row.tasks;
        if let Some(t) = entry.input_tokens.as_mut() { *t += row.input_tokens.unwrap_or(0); }
        if let Some(t) = entry.output_tokens.as_mut() { *t += row.output_tokens.unwrap_or(0); }
        if let Some(c) = entry.cost.as_mut() { *c += row.cost.unwrap_or(0.0); }
    }
    map.into_values().collect()
}

pub fn get_claude_limits(db: &DbPool) -> Option<ClaudeLimits> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM claude_limits WHERE id=1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_claude_limits: {}", e); return None; }
    };
    stmt.query_row([], |r| Ok(ClaudeLimits {
            id: r.get("id").ok(), rate_limit_type: r.get("rate_limit_type").ok(),
            status: r.get("status").ok(), resets_at: r.get("resets_at").ok(),
            overage_status: r.get("overage_status").ok(), is_using_overage: r.get("is_using_overage").ok(),
            last_model: r.get("last_model").ok(), last_cost_usd: r.get("last_cost_usd").ok(),
            context_window: r.get("context_window").ok(), max_output_tokens: r.get("max_output_tokens").ok(),
            updated_at: r.get("updated_at").ok(),
        })).ok()
}

#[allow(clippy::too_many_arguments)]
pub fn upsert_claude_limits(db: &DbPool, rate_limit_type: &str, status: &str, resets_at: i64, overage_status: &str, is_using_overage: bool, model: &str, cost_usd: f64, context_window: i64, max_output_tokens: i64) {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO claude_limits (id,rate_limit_type,status,resets_at,overage_status,is_using_overage,last_model,last_cost_usd,context_window,max_output_tokens,updated_at) VALUES (1,?1,?2,?3,?4,?5,?6,?7,?8,?9,datetime('now','localtime')) ON CONFLICT(id) DO UPDATE SET rate_limit_type=excluded.rate_limit_type, status=excluded.status, resets_at=excluded.resets_at, overage_status=excluded.overage_status, is_using_overage=excluded.is_using_overage, last_model=excluded.last_model, last_cost_usd=excluded.last_cost_usd, context_window=excluded.context_window, max_output_tokens=excluded.max_output_tokens, updated_at=excluded.updated_at",
        params![rate_limit_type, status, resets_at, overage_status, is_using_overage as i64, model, cost_usd, context_window, max_output_tokens],
    ).ok();
}

pub fn get_usage_timeline(db: &DbPool) -> Vec<UsageTimelinePoint> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT date(started_at) as day, SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)) as tokens, SUM(COALESCE(total_cost,0)) as cost, COUNT(*) as tasks FROM tasks WHERE started_at IS NOT NULL AND started_at>=datetime('now','-30 days') GROUP BY day ORDER BY day"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_usage_timeline: {}", e); return vec![]; }
    };
    let result = match stmt.query_map([], |r| Ok(UsageTimelinePoint {
        day: r.get(0)?, tokens: r.get(1).ok(), cost: r.get(2).ok(), tasks: r.get(3)?,
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_usage_timeline: {}", e); vec![] }
    };
    result
}
