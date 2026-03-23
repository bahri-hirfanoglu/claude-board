use crate::db::tasks::{Task, TaskRevision};
use crate::db::snippets::Snippet;
use crate::db::attachments::Attachment;
use crate::db::roles::Role;

pub fn build_prompt(
    task: &Task,
    revisions: &[TaskRevision],
    snippets: &[Snippet],
    attachments: &[Attachment],
    role: Option<&Role>,
    project_id: i64,
) -> String {
    let mut parts = Vec::new();
    let is_revision = !revisions.is_empty();
    let revision_num = task.revision_count.unwrap_or(revisions.len() as i64);

    if let Some(r) = role {
        if let Some(ref prompt) = r.prompt {
            if !prompt.is_empty() {
                parts.push(format!("## Role: {}", r.name));
                parts.push(prompt.clone());
                parts.push(String::new());
            }
        }
    }

    if is_revision {
        parts.push(format!("# REVISION #{}: {}", revision_num, task.title));
        parts.push("\n> This task has been reviewed and sent back for changes. You MUST address ALL feedback below.".into());
    } else {
        parts.push(format!("# Task: {}", task.title));
    }

    if let Some(ref desc) = task.description {
        if !desc.is_empty() {
            parts.push(format!("\n## Description\n{}", desc));
        }
    }
    if let Some(ref criteria) = task.acceptance_criteria {
        if !criteria.is_empty() {
            parts.push(format!("\n## Acceptance Criteria\n{}", criteria));
        }
    }

    if is_revision {
        parts.push("\n## Revision History".into());
        parts.push(format!("This task has been reviewed {} time(s). Address ALL feedback from the latest revision.", revisions.len()));
        parts.push("Previous work has already been committed — build on top of it, do NOT start from scratch.\n".into());
        for rev in revisions {
            parts.push(format!("### Revision #{} ({})", rev.revision_number, rev.created_at.as_deref().unwrap_or("")));
            parts.push(rev.feedback.clone());
            parts.push(String::new());
        }
        parts.push("\n## IMPORTANT: Revision Instructions".into());
        parts.push(format!("- Focus on the LATEST revision feedback (#{}) above.", revision_num));
        parts.push("- The previous work is already in the codebase — review what was done and fix/improve based on the feedback.".into());
        parts.push("- Do NOT redo work that was already accepted — only change what the feedback asks for.".into());
        parts.push(format!("- Commit your revision changes with a clear message referencing revision #{}.", revision_num));
    }

    if !snippets.is_empty() {
        parts.push("\n## Project Context".into());
        for s in snippets {
            parts.push(format!("### {}", s.title));
            parts.push(s.content.clone());
            parts.push(String::new());
        }
    }

    if !attachments.is_empty() {
        parts.push("\n## Attached Files".into());
        parts.push("The following files have been provided as reference for this task:".into());
        for a in attachments {
            let size_kb = a.size.unwrap_or(0) as f64 / 1024.0;
            parts.push(format!(
                "- **{}** ({}, {:.1}KB) → `.claude-attachments/{}`",
                a.original_name, a.mime_type.as_deref().unwrap_or(""), size_kb, a.filename
            ));
        }
        parts.push("\nThese files are available in the `.claude-attachments/` directory relative to the working directory. Read them as needed for context.".into());
    }

    parts.push("\n## Claude Board Integration".into());
    parts.push("You have access to Claude Board MCP tools. Use them to manage tasks on the project board:".into());
    parts.push(format!("- **list_tasks** — See all tasks in this project (project_id: {})", project_id));
    parts.push("- **create_task** — Create new sub-tasks if this task requires breaking down into smaller pieces".into());
    parts.push("- **change_task_status** — Move tasks between statuses".into());
    parts.push("- **get_task_detail** — Get full details of any task".into());
    parts.push("- **list_task_summary** — Get a grouped summary of all tasks".into());
    parts.push(format!("Use these tools when the task description asks you to plan, break down work, or manage tasks. The current project_id is {}.", project_id));

    parts.push("\n## Instructions".into());
    parts.push(format!("- Task type: {}", task.task_type.as_deref().unwrap_or("feature")));
    parts.push("- Complete this task thoroughly and commit your changes.".into());

    let branch = task.branch_name.as_deref().unwrap_or("");
    if !is_revision {
        if !branch.is_empty() {
            parts.push(format!("- You are already on branch \"{}\". Commit and push your changes to this branch.", branch));
        } else {
            parts.push(format!("- Create a new branch named {}/task-{}, commit, and push.", task.task_type.as_deref().unwrap_or("feature"), task.id));
        }
    } else if !branch.is_empty() {
        parts.push(format!("- You are on branch \"{}\". Commit and push your revision changes to this branch.", branch));
    } else {
        parts.push("- Work on the existing branch. Commit and push your revision changes.".into());
    }

    parts.push("- Write clear commit messages describing what was done.".into());
    parts.push("- If acceptance criteria are provided, ensure all criteria are met.".into());

    parts.join("\n")
}
