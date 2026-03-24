use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;
use super::schema::project_key_from_slug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub working_dir: String,
    pub icon: Option<String>,
    pub icon_seed: Option<String>,
    pub permission_mode: Option<String>,
    pub allowed_tools: Option<String>,
    pub auto_queue: Option<i64>,
    pub max_concurrent: Option<i64>,
    pub auto_branch: Option<i64>,
    pub auto_pr: Option<i64>,
    pub pr_base_branch: Option<String>,
    pub project_key: Option<String>,
    pub task_counter: Option<i64>,
    pub max_retries: Option<i64>,
    pub auto_test: Option<i64>,
    pub test_prompt: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    #[serde(flatten)]
    pub project: Project,
    pub total_tasks: i64,
    pub done_tasks: i64,
    pub active_tasks: i64,
    pub backlog_tasks: i64,
    pub testing_tasks: i64,
    pub total_tokens: Option<i64>,
    pub total_cost: Option<f64>,
    pub last_activity: Option<String>,
}

fn row_to_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get("id")?,
        name: row.get("name")?,
        slug: row.get("slug")?,
        working_dir: row.get("working_dir")?,
        icon: row.get("icon")?,
        icon_seed: row.get("icon_seed")?,
        permission_mode: row.get("permission_mode")?,
        allowed_tools: row.get("allowed_tools")?,
        auto_queue: row.get("auto_queue")?,
        max_concurrent: row.get("max_concurrent")?,
        auto_branch: row.get("auto_branch")?,
        auto_pr: row.get("auto_pr")?,
        pr_base_branch: row.get("pr_base_branch")?,
        project_key: row.get("project_key")?,
        task_counter: row.get("task_counter")?,
        max_retries: row.get("max_retries")?,
        auto_test: row.get("auto_test")?,
        test_prompt: row.get("test_prompt")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn get_all(db: &DbPool) -> Vec<Project> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY name").unwrap();
    stmt.query_map([], |row| row_to_project(row))
        .unwrap()
        .flatten()
        .collect()
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Project> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE id=?1").unwrap();
    stmt.query_row(params![id], |row| row_to_project(row))
        .ok()
}

pub fn get_by_slug(db: &DbPool, slug: &str) -> Option<Project> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE slug=?1").unwrap();
    stmt.query_row(params![slug], |row| row_to_project(row))
        .ok()
}

pub fn create(
    db: &DbPool,
    name: &str, slug: &str, working_dir: &str,
    icon: Option<&str>, icon_seed: Option<&str>,
    permission_mode: Option<&str>, allowed_tools: Option<&str>,
) -> i64 {
    let conn = db.lock();
    let project_key = project_key_from_slug(slug);
    conn.execute(
        "INSERT INTO projects (name,slug,working_dir,icon,icon_seed,permission_mode,allowed_tools,project_key) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            name, slug, working_dir,
            icon.unwrap_or("marble"),
            icon_seed.unwrap_or(""),
            permission_mode.unwrap_or("auto-accept"),
            allowed_tools.unwrap_or(""),
            project_key,
        ],
    ).unwrap();
    conn.last_insert_rowid()
}

pub fn update(
    db: &DbPool, id: i64,
    name: &str, slug: &str, working_dir: &str,
    icon: Option<&str>, icon_seed: Option<&str>,
    permission_mode: Option<&str>, allowed_tools: Option<&str>,
) {
    let conn = db.lock();
    conn.execute(
        "UPDATE projects SET name=?1,slug=?2,working_dir=?3,icon=?4,icon_seed=?5,permission_mode=?6,allowed_tools=?7,updated_at=datetime('now','localtime') WHERE id=?8",
        params![
            name, slug, working_dir,
            icon.unwrap_or("marble"),
            icon_seed.unwrap_or(""),
            permission_mode.unwrap_or("auto-accept"),
            allowed_tools.unwrap_or(""),
            id,
        ],
    ).unwrap();
}

pub fn update_queue(db: &DbPool, id: i64, auto_queue: bool, max_concurrent: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE projects SET auto_queue=?1,max_concurrent=?2,updated_at=datetime('now','localtime') WHERE id=?3",
        params![auto_queue as i64, max_concurrent, id],
    ).unwrap();
}

pub fn update_git_settings(db: &DbPool, id: i64, auto_branch: bool, auto_pr: bool, pr_base_branch: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE projects SET auto_branch=?1,auto_pr=?2,pr_base_branch=?3,updated_at=datetime('now','localtime') WHERE id=?4",
        params![auto_branch as i64, auto_pr as i64, pr_base_branch, id],
    ).unwrap();
}

pub fn update_test_settings(db: &DbPool, id: i64, auto_test: bool, test_prompt: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE projects SET auto_test=?1,test_prompt=?2,updated_at=datetime('now','localtime') WHERE id=?3",
        params![auto_test as i64, test_prompt, id],
    ).unwrap();
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM projects WHERE id=?1", params![id]).unwrap();
}

pub fn get_summary(db: &DbPool) -> Vec<ProjectSummary> {
    let conn = db.lock();
    let mut stmt = conn.prepare(
        "SELECT p.*, COUNT(t.id) as total_tasks,
         COUNT(CASE WHEN t.status='done' THEN 1 END) as done_tasks,
         COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as active_tasks,
         COUNT(CASE WHEN t.status='backlog' THEN 1 END) as backlog_tasks,
         COUNT(CASE WHEN t.status='testing' THEN 1 END) as testing_tasks,
         SUM(COALESCE(t.input_tokens,0)+COALESCE(t.output_tokens,0)) as total_tokens,
         SUM(COALESCE(t.total_cost,0)) as total_cost,
         MAX(t.updated_at) as last_activity
       FROM projects p LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id ORDER BY p.name"
    ).unwrap();

    stmt.query_map([], |row| {
        Ok(ProjectSummary {
            project: row_to_project(row)?,
            total_tasks: row.get("total_tasks").unwrap_or(0),
            done_tasks: row.get("done_tasks").unwrap_or(0),
            active_tasks: row.get("active_tasks").unwrap_or(0),
            backlog_tasks: row.get("backlog_tasks").unwrap_or(0),
            testing_tasks: row.get("testing_tasks").unwrap_or(0),
            total_tokens: row.get("total_tokens").ok(),
            total_cost: row.get("total_cost").ok(),
            last_activity: row.get("last_activity").ok(),
        })
    })
    .unwrap()
    .flatten()
    .collect()
}
