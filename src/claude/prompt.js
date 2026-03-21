export function buildPrompt(task, revisions = [], snippets = [], attachments = [], role = null) {
  const isRevision = revisions.length > 0;
  const revisionNum = task.revision_count || revisions.length;
  const parts = [];

  // Role assignment
  if (role?.prompt) {
    parts.push(`## Role: ${role.name}`);
    parts.push(role.prompt);
    parts.push('');
  }

  if (isRevision) {
    parts.push(`# REVISION #${revisionNum}: ${task.title}`);
    parts.push(`\n> This task has been reviewed and sent back for changes. You MUST address ALL feedback below.`);
  } else {
    parts.push(`# Task: ${task.title}`);
  }

  if (task.description) parts.push(`\n## Description\n${task.description}`);
  if (task.acceptance_criteria) parts.push(`\n## Acceptance Criteria\n${task.acceptance_criteria}`);

  if (isRevision) {
    parts.push(`\n## Revision History`);
    parts.push(
      `This task has been reviewed ${revisions.length} time(s). Address ALL feedback from the latest revision.`,
    );
    parts.push(`Previous work has already been committed — build on top of it, do NOT start from scratch.\n`);
    for (const rev of revisions) {
      parts.push(`### Revision #${rev.revision_number} (${rev.created_at})`);
      parts.push(rev.feedback);
      parts.push('');
    }
    parts.push(`\n## IMPORTANT: Revision Instructions`);
    parts.push(`- Focus on the LATEST revision feedback (#${revisionNum}) above.`);
    parts.push(
      `- The previous work is already in the codebase — review what was done and fix/improve based on the feedback.`,
    );
    parts.push(`- Do NOT redo work that was already accepted — only change what the feedback asks for.`);
    parts.push(`- Commit your revision changes with a clear message referencing revision #${revisionNum}.`);
  }

  // Context snippets
  if (snippets.length > 0) {
    parts.push(`\n## Project Context`);
    for (const s of snippets) {
      parts.push(`### ${s.title}`);
      parts.push(s.content);
      parts.push('');
    }
  }

  // Attachments
  if (attachments.length > 0) {
    parts.push(`\n## Attached Files`);
    parts.push(`The following files have been provided as reference for this task:`);
    for (const a of attachments) {
      parts.push(
        `- **${a.original_name}** (${a.mime_type}, ${(a.size / 1024).toFixed(1)}KB) → \`.claude-attachments/${a.filename}\``,
      );
    }
    parts.push(
      `\nThese files are available in the \`.claude-attachments/\` directory relative to the working directory. Read them as needed for context.`,
    );
  }

  parts.push(`\n## Claude Board Integration`);
  parts.push(`You have access to Claude Board MCP tools. Use them to manage tasks on the project board:`);
  parts.push(`- **list_tasks** — See all tasks in this project (project_id: ${task.project_id})`);
  parts.push(`- **create_task** — Create new sub-tasks if this task requires breaking down into smaller pieces`);
  parts.push(`- **change_task_status** — Move tasks between statuses`);
  parts.push(`- **get_task_detail** — Get full details of any task`);
  parts.push(`- **list_task_summary** — Get a grouped summary of all tasks`);
  parts.push(
    `Use these tools when the task description asks you to plan, break down work, or manage tasks. The current project_id is ${task.project_id}.`,
  );

  parts.push(`\n## Instructions`);
  parts.push(`- Task type: ${task.task_type || 'feature'}`);
  parts.push(`- Complete this task thoroughly and commit your changes.`);
  if (!isRevision) {
    if (task.branch_name) {
      parts.push(`- You are already on branch "${task.branch_name}". Commit and push your changes to this branch.`);
    } else {
      parts.push(`- Create a new branch named ${task.task_type || 'feature'}/task-${task.id}, commit, and push.`);
    }
  } else {
    if (task.branch_name) {
      parts.push(`- You are on branch "${task.branch_name}". Commit and push your revision changes to this branch.`);
    } else {
      parts.push(`- Work on the existing branch. Commit and push your revision changes.`);
    }
  }
  parts.push(`- Write clear commit messages describing what was done.`);
  parts.push(`- If acceptance criteria are provided, ensure all criteria are met.`);

  return parts.join('\n');
}
