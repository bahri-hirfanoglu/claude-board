/**
 * @typedef {Object} Project
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 * @property {string} working_dir
 * @property {string} [icon]
 * @property {string} [icon_seed]
 * @property {string} [permission_mode]
 * @property {string} [allowed_tools]
 * @property {number} [auto_queue]
 * @property {number} [max_concurrent]
 * @property {number} [auto_branch]
 * @property {number} [auto_pr]
 * @property {string} [pr_base_branch]
 * @property {string} [project_key]
 * @property {number} [task_counter]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Task
 * @property {number} id
 * @property {number} project_id
 * @property {string} title
 * @property {string} [description]
 * @property {'backlog'|'in_progress'|'testing'|'done'} status
 * @property {number} [priority]
 * @property {'feature'|'bugfix'|'refactor'|'docs'|'test'|'chore'} [task_type]
 * @property {string} [acceptance_criteria]
 * @property {string} [model]
 * @property {string} [thinking_effort]
 * @property {number} [sort_order]
 * @property {number} [queue_position]
 * @property {string} [branch_name]
 * @property {string} [claude_session_id]
 * @property {number} [input_tokens]
 * @property {number} [output_tokens]
 * @property {number} [cache_read_tokens]
 * @property {number} [cache_creation_tokens]
 * @property {number} [total_cost]
 * @property {number} [num_turns]
 * @property {number} [rate_limit_hits]
 * @property {number} [revision_count]
 * @property {string} [model_used]
 * @property {string} [started_at]
 * @property {string} [completed_at]
 * @property {number} [work_duration_ms]
 * @property {string} [last_resumed_at]
 * @property {string} [commits] - JSON string of commit array
 * @property {string} [pr_url]
 * @property {string} [diff_stat]
 * @property {number} [role_id]
 * @property {string} [task_key]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 * @property {boolean} [is_running] - computed at runtime
 */

/**
 * @typedef {Object} Template
 * @property {number} id
 * @property {number} project_id
 * @property {string} name
 * @property {string} [description]
 * @property {string} template
 * @property {string} [variables] - JSON string of variable definitions
 * @property {string} [task_type]
 * @property {string} [model]
 * @property {string} [thinking_effort]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Snippet
 * @property {number} id
 * @property {number} project_id
 * @property {string} title
 * @property {string} content
 * @property {number} [enabled]
 * @property {number} [sort_order]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Role
 * @property {number} id
 * @property {number} [project_id]
 * @property {string} name
 * @property {string} [description]
 * @property {string} [prompt]
 * @property {string} [color]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Webhook
 * @property {number} id
 * @property {number} project_id
 * @property {string} name
 * @property {string} url
 * @property {string} [platform]
 * @property {string} [events] - JSON string of event types
 * @property {number} [enabled]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {Object} Attachment
 * @property {number} id
 * @property {number} task_id
 * @property {string} filename
 * @property {string} original_name
 * @property {string} mime_type
 * @property {number} size
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} TaskRevision
 * @property {number} id
 * @property {number} task_id
 * @property {number} revision_number
 * @property {string} feedback
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} ActivityEntry
 * @property {number} id
 * @property {number} project_id
 * @property {number} [task_id]
 * @property {string} event_type
 * @property {string} message
 * @property {string} [metadata] - JSON string
 * @property {string} [created_at]
 */
