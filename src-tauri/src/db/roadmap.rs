use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

// ─── Structs ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: i64,
    pub project_id: i64,
    pub version: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub sort_order: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Phase {
    pub id: i64,
    pub milestone_id: i64,
    pub project_id: i64,
    pub phase_number: String,
    pub title: String,
    pub description: Option<String>,
    pub goal: Option<String>,
    pub success_criteria: Option<String>, // JSON array
    pub status: String,
    pub sort_order: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhasePlan {
    pub id: i64,
    pub phase_id: i64,
    pub plan_number: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub wave_index: i64,
    pub sort_order: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhasePlanTask {
    pub id: i64,
    pub plan_id: i64,
    pub task_id: i64,
    pub checkpoint_type: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseProgress {
    pub total: i64,
    pub done: i64,
    pub in_progress: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapData {
    pub milestones: Vec<MilestoneWithPhases>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilestoneWithPhases {
    #[serde(flatten)]
    pub milestone: Milestone,
    pub phases: Vec<PhaseWithPlans>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseWithPlans {
    #[serde(flatten)]
    pub phase: Phase,
    pub plans: Vec<PlanWithTasks>,
    pub progress: PhaseProgress,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanWithTasks {
    #[serde(flatten)]
    pub plan: PhasePlan,
    pub task_count: i64,
    pub done_count: i64,
}

// ─── Milestones ───

pub fn create_milestone(db: &DbPool, project_id: i64, version: &str, title: &str, description: &str) -> i64 {
    let conn = db.lock();
    let sort = conn.query_row(
        "SELECT COALESCE(MAX(sort_order),0)+1 FROM milestones WHERE project_id=?1",
        params![project_id], |r| r.get::<_, i64>(0),
    ).unwrap_or(0);
    conn.execute(
        "INSERT INTO milestones (project_id, version, title, description, sort_order) VALUES (?1,?2,?3,?4,?5)",
        params![project_id, version, title, description, sort],
    ).ok();
    conn.last_insert_rowid()
}

pub fn get_milestones(db: &DbPool, project_id: i64) -> Vec<Milestone> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id,project_id,version,title,description,status,sort_order,created_at,updated_at FROM milestones WHERE project_id=?1 ORDER BY sort_order"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_milestones: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![project_id], |r| Ok(Milestone {
        id: r.get(0)?, project_id: r.get(1)?, version: r.get(2)?, title: r.get(3)?,
        description: r.get(4)?, status: r.get(5)?, sort_order: r.get(6)?,
        created_at: r.get(7)?, updated_at: r.get(8)?,
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_milestones query: {}", e); vec![] }
    };
    result
}

pub fn get_milestone(db: &DbPool, id: i64) -> Option<Milestone> {
    let conn = db.lock();
    conn.query_row(
        "SELECT id,project_id,version,title,description,status,sort_order,created_at,updated_at FROM milestones WHERE id=?1",
        params![id], |r| Ok(Milestone {
            id: r.get(0)?, project_id: r.get(1)?, version: r.get(2)?, title: r.get(3)?,
            description: r.get(4)?, status: r.get(5)?, sort_order: r.get(6)?,
            created_at: r.get(7)?, updated_at: r.get(8)?,
        })
    ).ok()
}

pub fn update_milestone(db: &DbPool, id: i64, version: &str, title: &str, description: &str, status: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE milestones SET version=?1,title=?2,description=?3,status=?4,updated_at=datetime('now','localtime') WHERE id=?5",
        params![version, title, description, status, id],
    ).ok();
}

pub fn delete_milestone(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM milestones WHERE id=?1", params![id]).ok();
}

// ─── Phases ───

pub fn create_phase(
    db: &DbPool, milestone_id: i64, project_id: i64, phase_number: &str,
    title: &str, description: &str, goal: &str, success_criteria: &str,
) -> i64 {
    let conn = db.lock();
    let sort = conn.query_row(
        "SELECT COALESCE(MAX(sort_order),0)+1 FROM phases WHERE milestone_id=?1",
        params![milestone_id], |r| r.get::<_, i64>(0),
    ).unwrap_or(0);
    conn.execute(
        "INSERT INTO phases (milestone_id,project_id,phase_number,title,description,goal,success_criteria,sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![milestone_id, project_id, phase_number, title, description, goal, success_criteria, sort],
    ).ok();
    conn.last_insert_rowid()
}

pub fn get_phases(db: &DbPool, milestone_id: i64) -> Vec<Phase> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id,milestone_id,project_id,phase_number,title,description,goal,success_criteria,status,sort_order,created_at,updated_at FROM phases WHERE milestone_id=?1 ORDER BY sort_order"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_phases: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![milestone_id], |r| Ok(Phase {
        id: r.get(0)?, milestone_id: r.get(1)?, project_id: r.get(2)?,
        phase_number: r.get(3)?, title: r.get(4)?, description: r.get(5)?,
        goal: r.get(6)?, success_criteria: r.get(7)?, status: r.get(8)?,
        sort_order: r.get(9)?, created_at: r.get(10)?, updated_at: r.get(11)?,
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_phases query: {}", e); vec![] }
    };
    result
}

pub fn get_phase(db: &DbPool, id: i64) -> Option<Phase> {
    let conn = db.lock();
    conn.query_row(
        "SELECT id,milestone_id,project_id,phase_number,title,description,goal,success_criteria,status,sort_order,created_at,updated_at FROM phases WHERE id=?1",
        params![id], |r| Ok(Phase {
            id: r.get(0)?, milestone_id: r.get(1)?, project_id: r.get(2)?,
            phase_number: r.get(3)?, title: r.get(4)?, description: r.get(5)?,
            goal: r.get(6)?, success_criteria: r.get(7)?, status: r.get(8)?,
            sort_order: r.get(9)?, created_at: r.get(10)?, updated_at: r.get(11)?,
        })
    ).ok()
}

pub fn update_phase(
    db: &DbPool, id: i64, title: &str, description: &str, goal: &str,
    success_criteria: &str, status: &str,
) {
    let conn = db.lock();
    conn.execute(
        "UPDATE phases SET title=?1,description=?2,goal=?3,success_criteria=?4,status=?5,updated_at=datetime('now','localtime') WHERE id=?6",
        params![title, description, goal, success_criteria, status, id],
    ).ok();
}

pub fn delete_phase(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM phases WHERE id=?1", params![id]).ok();
}

pub fn reorder_phases(db: &DbPool, milestone_id: i64, phase_ids: &[i64]) {
    let conn = db.lock();
    for (i, id) in phase_ids.iter().enumerate() {
        conn.execute(
            "UPDATE phases SET sort_order=?1 WHERE id=?2 AND milestone_id=?3",
            params![i as i64, id, milestone_id],
        ).ok();
    }
}

/// Insert a decimal phase after a given phase number (e.g. after "2" creates "2.1")
pub fn insert_decimal_phase(
    db: &DbPool, milestone_id: i64, project_id: i64, after_phase_number: &str,
    title: &str, description: &str, goal: &str, success_criteria: &str,
) -> i64 {
    // Find next available decimal
    let conn = db.lock();
    let prefix = format!("{}.", after_phase_number);
    let mut stmt = conn.prepare(
        "SELECT phase_number FROM phases WHERE milestone_id=?1 AND phase_number LIKE ?2 ORDER BY phase_number DESC LIMIT 1"
    ).unwrap();
    let last: Option<String> = stmt.query_row(params![milestone_id, format!("{}%", prefix)], |r| r.get(0)).ok();

    let next_decimal = if let Some(last_num) = last {
        let suffix = last_num.strip_prefix(&prefix).unwrap_or("0");
        let n: i64 = suffix.parse().unwrap_or(0);
        format!("{}{}", prefix, n + 1)
    } else {
        format!("{}1", prefix)
    };
    drop(stmt);

    // Get sort_order: after the referenced phase
    let after_sort: i64 = conn.query_row(
        "SELECT sort_order FROM phases WHERE milestone_id=?1 AND phase_number=?2",
        params![milestone_id, after_phase_number], |r| r.get(0),
    ).unwrap_or(0);

    // Shift subsequent phases
    conn.execute(
        "UPDATE phases SET sort_order=sort_order+1 WHERE milestone_id=?1 AND sort_order>?2",
        params![milestone_id, after_sort],
    ).ok();

    conn.execute(
        "INSERT INTO phases (milestone_id,project_id,phase_number,title,description,goal,success_criteria,sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![milestone_id, project_id, &next_decimal, title, description, goal, success_criteria, after_sort + 1],
    ).ok();
    conn.last_insert_rowid()
}

// ─── Plans ───

pub fn create_plan(db: &DbPool, phase_id: i64, plan_number: &str, title: &str, description: &str, wave_index: i64) -> i64 {
    let conn = db.lock();
    let sort = conn.query_row(
        "SELECT COALESCE(MAX(sort_order),0)+1 FROM phase_plans WHERE phase_id=?1",
        params![phase_id], |r| r.get::<_, i64>(0),
    ).unwrap_or(0);
    conn.execute(
        "INSERT INTO phase_plans (phase_id,plan_number,title,description,wave_index,sort_order) VALUES (?1,?2,?3,?4,?5,?6)",
        params![phase_id, plan_number, title, description, wave_index, sort],
    ).ok();
    conn.last_insert_rowid()
}

pub fn get_plans(db: &DbPool, phase_id: i64) -> Vec<PhasePlan> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id,phase_id,plan_number,title,description,status,wave_index,sort_order,created_at,updated_at FROM phase_plans WHERE phase_id=?1 ORDER BY sort_order"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_plans: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![phase_id], |r| Ok(PhasePlan {
        id: r.get(0)?, phase_id: r.get(1)?, plan_number: r.get(2)?, title: r.get(3)?,
        description: r.get(4)?, status: r.get(5)?, wave_index: r.get(6)?,
        sort_order: r.get(7)?, created_at: r.get(8)?, updated_at: r.get(9)?,
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_plans query: {}", e); vec![] }
    };
    result
}

pub fn get_plan(db: &DbPool, id: i64) -> Option<PhasePlan> {
    let conn = db.lock();
    conn.query_row(
        "SELECT id,phase_id,plan_number,title,description,status,wave_index,sort_order,created_at,updated_at FROM phase_plans WHERE id=?1",
        params![id], |r| Ok(PhasePlan {
            id: r.get(0)?, phase_id: r.get(1)?, plan_number: r.get(2)?, title: r.get(3)?,
            description: r.get(4)?, status: r.get(5)?, wave_index: r.get(6)?,
            sort_order: r.get(7)?, created_at: r.get(8)?, updated_at: r.get(9)?,
        })
    ).ok()
}

pub fn update_plan(db: &DbPool, id: i64, title: &str, description: &str, status: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE phase_plans SET title=?1,description=?2,status=?3,updated_at=datetime('now','localtime') WHERE id=?4",
        params![title, description, status, id],
    ).ok();
}

pub fn delete_plan(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM phase_plans WHERE id=?1", params![id]).ok();
}

// ─── Plan ↔ Task links ───

pub fn link_task_to_plan(db: &DbPool, plan_id: i64, task_id: i64, checkpoint_type: &str) {
    let conn = db.lock();
    let sort = conn.query_row(
        "SELECT COALESCE(MAX(sort_order),0)+1 FROM phase_plan_tasks WHERE plan_id=?1",
        params![plan_id], |r| r.get::<_, i64>(0),
    ).unwrap_or(0);
    conn.execute(
        "INSERT OR IGNORE INTO phase_plan_tasks (plan_id,task_id,checkpoint_type,sort_order) VALUES (?1,?2,?3,?4)",
        params![plan_id, task_id, checkpoint_type, sort],
    ).ok();
    // Also set denormalized column on task
    conn.execute("UPDATE tasks SET phase_plan_id=?1 WHERE id=?2", params![plan_id, task_id]).ok();
}

pub fn unlink_task_from_plan(db: &DbPool, plan_id: i64, task_id: i64) {
    let conn = db.lock();
    conn.execute(
        "DELETE FROM phase_plan_tasks WHERE plan_id=?1 AND task_id=?2",
        params![plan_id, task_id],
    ).ok();
    conn.execute("UPDATE tasks SET phase_plan_id=NULL WHERE id=?1 AND phase_plan_id=?2", params![task_id, plan_id]).ok();
}

pub fn get_plan_tasks(db: &DbPool, plan_id: i64) -> Vec<PhasePlanTask> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id,plan_id,task_id,checkpoint_type,sort_order FROM phase_plan_tasks WHERE plan_id=?1 ORDER BY sort_order"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("get_plan_tasks: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![plan_id], |r| Ok(PhasePlanTask {
        id: r.get(0)?, plan_id: r.get(1)?, task_id: r.get(2)?,
        checkpoint_type: r.get(3)?, sort_order: r.get(4)?,
    })) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_plan_tasks query: {}", e); vec![] }
    };
    result
}

// ─── Status recomputation ───

pub fn recompute_plan_status(db: &DbPool, plan_id: i64) {
    let conn = db.lock();
    let counts: (i64, i64, i64, i64) = conn.query_row(
        "SELECT
            COUNT(*),
            SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END),
            SUM(CASE WHEN t.status IN ('in_progress','testing') THEN 1 ELSE 0 END),
            SUM(CASE WHEN t.status='failed' THEN 1 ELSE 0 END)
         FROM phase_plan_tasks pt JOIN tasks t ON t.id=pt.task_id WHERE pt.plan_id=?1",
        params![plan_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    ).unwrap_or((0, 0, 0, 0));

    let (total, done, active, failed) = counts;
    let status = if total == 0 { "pending" }
        else if done == total { "completed" }
        else if failed > 0 && active == 0 && done + failed == total { "failed" }
        else if active > 0 || done > 0 { "in_progress" }
        else { "pending" };

    conn.execute(
        "UPDATE phase_plans SET status=?1,updated_at=datetime('now','localtime') WHERE id=?2",
        params![status, plan_id],
    ).ok();
}

pub fn recompute_phase_status(db: &DbPool, phase_id: i64) {
    let conn = db.lock();
    let counts: (i64, i64, i64, i64) = conn.query_row(
        "SELECT
            COUNT(*),
            SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),
            SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END),
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)
         FROM phase_plans WHERE phase_id=?1",
        params![phase_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    ).unwrap_or((0, 0, 0, 0));

    let (total, done, active, failed) = counts;
    let current: String = conn.query_row(
        "SELECT status FROM phases WHERE id=?1", params![phase_id], |r| r.get(0),
    ).unwrap_or_default();

    // Don't overwrite manual statuses like 'planning' or 'verifying'
    let status = if total == 0 { &current }
        else if done == total { "completed" }
        else if failed > 0 && active == 0 && done + failed == total { "failed" }
        else if active > 0 || done > 0 { "in_progress" }
        else { &current };

    conn.execute(
        "UPDATE phases SET status=?1,updated_at=datetime('now','localtime') WHERE id=?2",
        params![status, phase_id],
    ).ok();
}

// ─── Aggregate roadmap query ───

pub fn get_roadmap(db: &DbPool, project_id: i64) -> RoadmapData {
    let milestones = get_milestones(db, project_id);
    let mut result = Vec::new();

    for ms in milestones {
        let phases = get_phases(db, ms.id);
        let mut phase_list = Vec::new();

        for ph in phases {
            let plans = get_plans(db, ph.id);
            let mut plan_list = Vec::new();

            let conn = db.lock();
            let progress: PhaseProgress = conn.query_row(
                "SELECT
                    COUNT(DISTINCT pt.task_id),
                    SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END),
                    SUM(CASE WHEN t.status IN ('in_progress','testing') THEN 1 ELSE 0 END),
                    SUM(CASE WHEN t.status='failed' THEN 1 ELSE 0 END)
                 FROM phase_plan_tasks pt
                 JOIN phase_plans pp ON pp.id=pt.plan_id
                 JOIN tasks t ON t.id=pt.task_id
                 WHERE pp.phase_id=?1",
                params![ph.id], |r| Ok(PhaseProgress {
                    total: r.get(0)?, done: r.get(1)?, in_progress: r.get(2)?, failed: r.get(3)?,
                }),
            ).unwrap_or(PhaseProgress { total: 0, done: 0, in_progress: 0, failed: 0 });
            drop(conn);

            for pl in plans {
                let conn = db.lock();
                let (tc, dc): (i64, i64) = conn.query_row(
                    "SELECT COUNT(*), SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) FROM phase_plan_tasks pt JOIN tasks t ON t.id=pt.task_id WHERE pt.plan_id=?1",
                    params![pl.id], |r| Ok((r.get(0)?, r.get(1)?)),
                ).unwrap_or((0, 0));
                drop(conn);

                plan_list.push(PlanWithTasks {
                    plan: pl,
                    task_count: tc,
                    done_count: dc,
                });
            }

            phase_list.push(PhaseWithPlans { phase: ph, plans: plan_list, progress });
        }

        result.push(MilestoneWithPhases { milestone: ms, phases: phase_list });
    }

    RoadmapData { milestones: result }
}

pub fn get_phase_progress(db: &DbPool, phase_id: i64) -> PhaseProgress {
    let conn = db.lock();
    conn.query_row(
        "SELECT
            COUNT(DISTINCT pt.task_id),
            SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END),
            SUM(CASE WHEN t.status IN ('in_progress','testing') THEN 1 ELSE 0 END),
            SUM(CASE WHEN t.status='failed' THEN 1 ELSE 0 END)
         FROM phase_plan_tasks pt
         JOIN phase_plans pp ON pp.id=pt.plan_id
         JOIN tasks t ON t.id=pt.task_id
         WHERE pp.phase_id=?1",
        params![phase_id], |r| Ok(PhaseProgress {
            total: r.get(0)?, done: r.get(1)?, in_progress: r.get(2)?, failed: r.get(3)?,
        }),
    ).unwrap_or(PhaseProgress { total: 0, done: 0, in_progress: 0, failed: 0 })
}

pub fn update_success_criterion(db: &DbPool, phase_id: i64, index: usize, verified: bool) -> Option<Phase> {
    let conn = db.lock();
    let criteria_json: String = conn.query_row(
        "SELECT success_criteria FROM phases WHERE id=?1", params![phase_id], |r| r.get(0),
    ).unwrap_or_else(|_| "[]".to_string());

    let mut criteria: Vec<serde_json::Value> = serde_json::from_str(&criteria_json).unwrap_or_default();
    if let Some(item) = criteria.get_mut(index) {
        if let Some(obj) = item.as_object_mut() {
            obj.insert("verified".to_string(), serde_json::Value::Bool(verified));
        }
    }

    let updated = serde_json::to_string(&criteria).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE phases SET success_criteria=?1,updated_at=datetime('now','localtime') WHERE id=?2",
        params![updated, phase_id],
    ).ok();
    drop(conn);

    get_phase(db, phase_id)
}
