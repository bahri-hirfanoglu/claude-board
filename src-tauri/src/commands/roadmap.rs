use tauri::{AppHandle, Emitter};
use crate::db::{self, roadmap as rm, tasks as tq, projects as pq, activity, dependencies};

// ─── Milestones ───

#[tauri::command]
pub fn get_milestones(project_id: i64) -> Vec<rm::Milestone> {
    rm::get_milestones(&db::get_db(), project_id)
}

#[tauri::command]
pub fn create_milestone(
    app: AppHandle, project_id: i64, version: String, title: String, description: Option<String>,
) -> Result<rm::Milestone, String> {
    if title.trim().is_empty() { return Err("Title is required".into()); }
    let db = db::get_db();
    let id = rm::create_milestone(&db, project_id, version.trim(), title.trim(), description.as_deref().unwrap_or(""));
    let ms = rm::get_milestone(&db, id).ok_or("Failed to create milestone")?;
    app.emit("roadmap:updated", &project_id).ok();
    Ok(ms)
}

#[tauri::command]
pub fn update_milestone(
    app: AppHandle, id: i64, version: String, title: String, description: Option<String>, status: String,
) -> Result<rm::Milestone, String> {
    let db = db::get_db();
    rm::update_milestone(&db, id, version.trim(), title.trim(), description.as_deref().unwrap_or(""), status.trim());
    let ms = rm::get_milestone(&db, id).ok_or("Failed to update milestone")?;
    app.emit("roadmap:updated", &ms.project_id).ok();
    Ok(ms)
}

#[tauri::command]
pub fn delete_milestone(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let ms = rm::get_milestone(&db, id).ok_or("Milestone not found")?;
    rm::delete_milestone(&db, id);
    app.emit("roadmap:updated", &ms.project_id).ok();
    Ok(())
}

// ─── Phases ───

#[tauri::command]
pub fn get_phases(milestone_id: i64) -> Vec<rm::Phase> {
    rm::get_phases(&db::get_db(), milestone_id)
}

#[tauri::command]
pub fn create_phase(
    app: AppHandle, milestone_id: i64, project_id: i64, phase_number: String,
    title: String, description: Option<String>, goal: Option<String>, success_criteria: Option<String>,
) -> Result<rm::Phase, String> {
    if title.trim().is_empty() { return Err("Title is required".into()); }
    let db = db::get_db();
    let id = rm::create_phase(
        &db, milestone_id, project_id, phase_number.trim(), title.trim(),
        description.as_deref().unwrap_or(""), goal.as_deref().unwrap_or(""),
        success_criteria.as_deref().unwrap_or("[]"),
    );
    let phase = rm::get_phase(&db, id).ok_or("Failed to create phase")?;
    app.emit("roadmap:updated", &project_id).ok();
    Ok(phase)
}

#[tauri::command]
pub fn update_phase(
    app: AppHandle, id: i64, title: String, description: Option<String>,
    goal: Option<String>, success_criteria: Option<String>, status: String,
) -> Result<rm::Phase, String> {
    let db = db::get_db();
    rm::update_phase(
        &db, id, title.trim(), description.as_deref().unwrap_or(""),
        goal.as_deref().unwrap_or(""), success_criteria.as_deref().unwrap_or("[]"), status.trim(),
    );
    let phase = rm::get_phase(&db, id).ok_or("Failed to update phase")?;
    app.emit("roadmap:updated", &phase.project_id).ok();
    Ok(phase)
}

#[tauri::command]
pub fn delete_phase(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let phase = rm::get_phase(&db, id).ok_or("Phase not found")?;
    rm::delete_phase(&db, id);
    app.emit("roadmap:updated", &phase.project_id).ok();
    Ok(())
}

#[tauri::command]
pub fn reorder_phases(milestone_id: i64, phase_ids: Vec<i64>) -> Result<(), String> {
    rm::reorder_phases(&db::get_db(), milestone_id, &phase_ids);
    Ok(())
}

#[tauri::command]
pub fn insert_phase(
    app: AppHandle, milestone_id: i64, project_id: i64, after_phase_number: String,
    title: String, description: Option<String>, goal: Option<String>, success_criteria: Option<String>,
) -> Result<rm::Phase, String> {
    if title.trim().is_empty() { return Err("Title is required".into()); }
    let db = db::get_db();
    let id = rm::insert_decimal_phase(
        &db, milestone_id, project_id, after_phase_number.trim(), title.trim(),
        description.as_deref().unwrap_or(""), goal.as_deref().unwrap_or(""),
        success_criteria.as_deref().unwrap_or("[]"),
    );
    let phase = rm::get_phase(&db, id).ok_or("Failed to insert phase")?;
    app.emit("roadmap:updated", &project_id).ok();
    Ok(phase)
}

// ─── Plans ───

#[tauri::command]
pub fn get_plans(phase_id: i64) -> Vec<rm::PhasePlan> {
    rm::get_plans(&db::get_db(), phase_id)
}

#[tauri::command]
pub fn create_plan(
    app: AppHandle, phase_id: i64, plan_number: String, title: String,
    description: Option<String>, wave_index: Option<i64>,
) -> Result<rm::PhasePlan, String> {
    if title.trim().is_empty() { return Err("Title is required".into()); }
    let db = db::get_db();
    let id = rm::create_plan(&db, phase_id, plan_number.trim(), title.trim(), description.as_deref().unwrap_or(""), wave_index.unwrap_or(0));
    let plan = rm::get_plan(&db, id).ok_or("Failed to create plan")?;
    // Get project_id from phase
    if let Some(phase) = rm::get_phase(&db, phase_id) {
        app.emit("roadmap:updated", &phase.project_id).ok();
    }
    Ok(plan)
}

#[tauri::command]
pub fn update_plan(
    app: AppHandle, id: i64, title: String, description: Option<String>, status: String,
) -> Result<rm::PhasePlan, String> {
    let db = db::get_db();
    rm::update_plan(&db, id, title.trim(), description.as_deref().unwrap_or(""), status.trim());
    let plan = rm::get_plan(&db, id).ok_or("Failed to update plan")?;
    if let Some(phase) = rm::get_phase(&db, plan.phase_id) {
        app.emit("roadmap:updated", &phase.project_id).ok();
    }
    Ok(plan)
}

#[tauri::command]
pub fn delete_plan(app: AppHandle, id: i64) -> Result<(), String> {
    let db = db::get_db();
    let plan = rm::get_plan(&db, id).ok_or("Plan not found")?;
    rm::delete_plan(&db, id);
    if let Some(phase) = rm::get_phase(&db, plan.phase_id) {
        app.emit("roadmap:updated", &phase.project_id).ok();
    }
    Ok(())
}

// ─── Plan ↔ Task linking ───

#[tauri::command]
pub fn link_task_to_plan(plan_id: i64, task_id: i64, checkpoint_type: Option<String>) -> Result<(), String> {
    rm::link_task_to_plan(&db::get_db(), plan_id, task_id, checkpoint_type.as_deref().unwrap_or("auto"));
    Ok(())
}

#[tauri::command]
pub fn unlink_task_from_plan(plan_id: i64, task_id: i64) -> Result<(), String> {
    rm::unlink_task_from_plan(&db::get_db(), plan_id, task_id);
    Ok(())
}

#[tauri::command]
pub fn get_plan_tasks(plan_id: i64) -> Vec<rm::PhasePlanTask> {
    rm::get_plan_tasks(&db::get_db(), plan_id)
}

// ─── Aggregate ───

#[tauri::command]
pub fn get_roadmap(project_id: i64) -> rm::RoadmapData {
    rm::get_roadmap(&db::get_db(), project_id)
}

#[tauri::command]
pub fn get_phase_progress(phase_id: i64) -> rm::PhaseProgress {
    rm::get_phase_progress(&db::get_db(), phase_id)
}

#[tauri::command]
pub fn update_success_criterion(
    app: AppHandle, phase_id: i64, criterion_index: usize, verified: bool,
) -> Result<rm::Phase, String> {
    let db = db::get_db();
    let phase = rm::update_success_criterion(&db, phase_id, criterion_index, verified)
        .ok_or("Failed to update criterion")?;
    app.emit("roadmap:updated", &phase.project_id).ok();
    Ok(phase)
}

// ─── GSD Phase Planning & Execution ───

/// Start AI planning for a phase - uses the existing planning infrastructure
/// but enriches the prompt with phase context (goal, success criteria).
#[tauri::command]
pub fn plan_phase(
    app: AppHandle, project_id: i64, phase_id: i64,
    model: Option<String>, effort: Option<String>,
) -> Result<serde_json::Value, String> {
    let db = db::get_db();
    let phase = rm::get_phase(&db, phase_id).ok_or("Phase not found")?;
    let _project = pq::get_by_id(&db, project_id).ok_or("Project not found")?;

    // Build a planning topic from phase context
    let criteria: Vec<serde_json::Value> = serde_json::from_str(
        phase.success_criteria.as_deref().unwrap_or("[]"),
    ).unwrap_or_default();

    let criteria_text = criteria.iter()
        .filter_map(|c| {
            c.get("text").or(c.get("criterion")).and_then(|v| v.as_str())
        })
        .enumerate()
        .map(|(i, t)| format!("{}. {}", i + 1, t))
        .collect::<Vec<_>>()
        .join("\n");

    let topic = format!(
        "Phase {}: {}\n\nGoal: {}\n\n{}\n\nSuccess Criteria:\n{}",
        phase.phase_number,
        phase.title,
        phase.goal.as_deref().unwrap_or(""),
        phase.description.as_deref().unwrap_or(""),
        if criteria_text.is_empty() { "None specified".to_string() } else { criteria_text.clone() },
    );

    // Update phase status to planning
    rm::update_phase(
        &db, phase_id, &phase.title,
        phase.description.as_deref().unwrap_or(""),
        phase.goal.as_deref().unwrap_or(""),
        phase.success_criteria.as_deref().unwrap_or("[]"),
        "planning",
    );
    app.emit("roadmap:updated", &project_id).ok();

    // Build GSD-aware context with checkpoint guidance
    let context = format!(
        r#"## GSD Phase Context
This is a phase-based planning request from a GSD (Get Stuff Done) workflow.
Each task must include a `checkpoint_type` field indicating the level of human involvement:

- **auto**: Fully automated by AI agent. No human interaction needed. Use for most coding tasks.
- **human-verify**: AI implements, human verifies the result visually or functionally. Use for UI changes, critical logic, or anything needing visual confirmation.
- **decision**: Human must choose between options before work can proceed. Use when there are architectural decisions, library choices, or design tradeoffs.
- **human-action**: Human must perform an action that cannot be automated (e.g., email verification, 3rd party signup, manual deployment). Rare.

Default to "auto" unless the task specifically requires human input.

## Success Criteria (each must be TRUE when phase is complete):
{}

The tasks you create should collectively satisfy ALL success criteria above."#,
        if criteria_text.is_empty() { "None specified".to_string() } else { criteria_text }
    );

    // Delegate to existing planning command with GSD context
    crate::commands::planning::start_planning(
        app, project_id, topic,
        model, effort, Some("balanced".into()), Some(context),
    )
}

/// Approve a phase plan: create tasks, link them to a new plan within the phase,
/// and set up dependencies.
#[tauri::command]
pub fn approve_phase_plan(
    app: AppHandle, project_id: i64, phase_id: i64,
    plan_title: String, tasks: Vec<serde_json::Value>,
    model: Option<String>, dependencies_edges: Option<Vec<Vec<i64>>>,
) -> Result<Vec<tq::Task>, String> {
    let db = db::get_db();
    let phase = rm::get_phase(&db, phase_id).ok_or("Phase not found")?;
    if pq::get_by_id(&db, project_id).is_none() { return Err("Project not found".into()); }
    let model = model.unwrap_or_else(|| "sonnet".into());

    // Count existing plans to generate plan number
    let existing_plans = rm::get_plans(&db, phase_id);
    let plan_number = format!("{:02}-{:02}", phase.phase_number.replace('.', ""), existing_plans.len() + 1);

    // Create the plan record
    let title = if plan_title.trim().is_empty() {
        format!("Plan for Phase {}", phase.phase_number)
    } else {
        plan_title.trim().to_string()
    };
    let plan_id = rm::create_plan(&db, phase_id, &plan_number, &title, "", 0);

    // Create tasks and link them to the plan
    let phase_tag = format!("phase:{}", phase.phase_number);
    let mut created = Vec::new();

    for t in &tasks {
        let mut task_tags = vec![phase_tag.clone()];
        if let Some(extra) = t.get("tags").and_then(|v| v.as_array()) {
            for tag in extra {
                if let Some(s) = tag.as_str() {
                    if !task_tags.contains(&s.to_string()) {
                        task_tags.push(s.to_string());
                    }
                }
            }
        }
        let tags_json = serde_json::to_string(&task_tags).unwrap_or_else(|_| "[]".into());

        let task_id = tq::create(&db, project_id,
            t.get("title").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            t.get("priority").and_then(|v| v.as_i64()).unwrap_or(0),
            t.get("task_type").and_then(|v| v.as_str()).unwrap_or("feature"),
            t.get("acceptance_criteria").and_then(|v| v.as_str()).unwrap_or(""),
            &model, "medium", None,
            Some(&tags_json),
        );

        // Determine checkpoint type
        let checkpoint = t.get("checkpoint_type")
            .and_then(|v| v.as_str())
            .unwrap_or("auto");

        // Link task to plan
        rm::link_task_to_plan(&db, plan_id, task_id, checkpoint);

        if let Some(task) = tq::get_by_id(&db, task_id) {
            app.emit("task:created", &task).ok();
            created.push(task);
        }
    }

    // Create dependency edges
    if let Some(deps) = dependencies_edges {
        for edge in &deps {
            if edge.len() == 2 {
                let parent_idx = edge[0] as usize;
                let child_idx = edge[1] as usize;
                if parent_idx < created.len() && child_idx < created.len() {
                    let parent_id = created[parent_idx].id;
                    let child_id = created[child_idx].id;
                    dependencies::add_dependency(&db, child_id, parent_id, None).ok();
                }
            }
        }
    }

    // Update phase status to in_progress
    rm::update_phase(
        &db, phase_id, &phase.title,
        phase.description.as_deref().unwrap_or(""),
        phase.goal.as_deref().unwrap_or(""),
        phase.success_criteria.as_deref().unwrap_or("[]"),
        "in_progress",
    );

    activity::add(&db, project_id, None, "phase_plan_approved",
        &format!("Phase {} plan approved: {} tasks created", phase.phase_number, created.len()), None);

    app.emit("roadmap:updated", &project_id).ok();

    // Trigger queue
    crate::services::queue::start_next_queued(&db, &app, project_id);

    Ok(created)
}

/// Execute a phase: trigger the queue to start ready tasks
#[tauri::command]
pub fn execute_phase(app: AppHandle, project_id: i64, phase_id: i64) -> Result<String, String> {
    let db = db::get_db();
    let phase = rm::get_phase(&db, phase_id).ok_or("Phase not found")?;

    // Update phase status
    rm::update_phase(
        &db, phase_id, &phase.title,
        phase.description.as_deref().unwrap_or(""),
        phase.goal.as_deref().unwrap_or(""),
        phase.success_criteria.as_deref().unwrap_or("[]"),
        "in_progress",
    );

    // Trigger queue to start ready tasks
    crate::services::queue::start_next_queued(&db, &app, project_id);

    app.emit("roadmap:updated", &project_id).ok();
    Ok(format!("Phase {} execution started", phase.phase_number))
}
