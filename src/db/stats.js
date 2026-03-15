import { queryAll, queryOne } from './connection.js';

export const statsQueries = {
  getTasksByStatus: (pid) => queryAll('SELECT status,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY status', [pid]),
  getTasksByPriority: (pid) => queryAll('SELECT priority,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY priority', [pid]),
  getTasksByType: (pid) => queryAll('SELECT task_type,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY task_type', [pid]),
  getAvgDuration: (pid) => queryOne(
    `SELECT AVG((julianday(completed_at)-julianday(started_at))*24*60) as avg_minutes,
            MIN((julianday(completed_at)-julianday(started_at))*24*60) as min_minutes,
            MAX((julianday(completed_at)-julianday(started_at))*24*60) as max_minutes,
            COUNT(*) as count
     FROM tasks WHERE project_id=? AND started_at IS NOT NULL AND completed_at IS NOT NULL`, [pid]
  ),
  getCompletionTimeline: (pid) => queryAll(
    `SELECT date(completed_at) as day,COUNT(*) as count FROM tasks
     WHERE project_id=? AND completed_at IS NOT NULL AND completed_at>=datetime('now','-14 days')
     GROUP BY date(completed_at) ORDER BY day`, [pid]
  ),
  getRecentCompleted: (pid) => queryAll(
    `SELECT id,title,task_type,priority,model,model_used,input_tokens,output_tokens,
            cache_read_tokens,cache_creation_tokens,total_cost,num_turns,rate_limit_hits,
            started_at,completed_at,ROUND((julianday(completed_at)-julianday(started_at))*24*60,1) as duration_minutes
     FROM tasks WHERE project_id=? AND started_at IS NOT NULL AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 10`, [pid]
  ),
  getClaudeUsage: (pid) => queryOne(
    `SELECT SUM(COALESCE(input_tokens,0)) as total_input_tokens, SUM(COALESCE(output_tokens,0)) as total_output_tokens,
       SUM(COALESCE(cache_read_tokens,0)) as total_cache_read, SUM(COALESCE(cache_creation_tokens,0)) as total_cache_creation,
       SUM(COALESCE(total_cost,0)) as total_cost, SUM(COALESCE(num_turns,0)) as total_turns,
       SUM(COALESCE(rate_limit_hits,0)) as total_rate_limits,
       COUNT(CASE WHEN input_tokens>0 THEN 1 END) as tasks_with_usage
     FROM tasks WHERE project_id=?`, [pid]
  ),
  getModelBreakdown: (pid) => queryAll(
    `SELECT COALESCE(model_used,model,'unknown') as model_name, COUNT(*) as count,
            SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)) as total_tokens,
            SUM(COALESCE(total_cost,0)) as total_cost
     FROM tasks WHERE project_id=? AND (input_tokens>0 OR status IN ('in_progress','testing','done'))
     GROUP BY model_name`, [pid]
  ),
};
