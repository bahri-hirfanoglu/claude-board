import { Router } from 'express';
import { spawn } from 'child_process';
import { platform } from 'os';
import { asyncHandler } from '../middleware/errorHandler.js';

const IS_WIN = platform() === 'win32';

export default function planningRoutes({ queries, projectQueries, io, activityLog }) {
  const router = Router();

  // Active planning sessions
  const activePlans = new Map();

  router.post(
    '/projects/:projectId/plan',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { topic, model = 'sonnet', effort = 'medium', context = '' } = req.body;
      if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

      if (activePlans.has(project.id)) {
        return res.status(409).json({ error: 'Planning already in progress for this project' });
      }

      const MODEL_MAP = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };
      const EFFORT_BUDGET = { low: 'low', medium: 'medium', high: 'high' };
      const planId = `plan-${project.id}-${Date.now()}`;

      const prompt = buildPlanningPrompt(topic, context, project);

      const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
      if (MODEL_MAP[model]) args.push('--model', MODEL_MAP[model]);
      if (EFFORT_BUDGET[effort]) args.push('--thinking-budget', EFFORT_BUDGET[effort]);

      const proc = spawn('claude', args, {
        cwd: project.working_dir,
        shell: false,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        ...(IS_WIN && { windowsHide: true }),
      });

      activePlans.set(project.id, { proc, planId });

      io.emit('plan:started', { projectId: project.id, planId, topic });
      activityLog.add(project.id, null, 'plan_started', `Planning started: ${topic.trim()}`);

      let buffer = '';
      let fullText = '';

      proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'assistant' && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  fullText += block.text;
                  io.emit('plan:progress', { projectId: project.id, planId, text: block.text });
                }
              }
            }
          } catch {}
        }
      });

      proc.stderr.on('data', () => {}); // suppress stderr

      proc.on('close', async () => {
        activePlans.delete(project.id);

        // Parse tasks from Claude's output
        const tasks = parseTasksFromOutput(fullText);

        if (tasks.length > 0) {
          // Create tasks in backlog
          const created = [];
          for (const t of tasks) {
            const result = queries.createTask.run(
              project.id,
              t.title,
              t.description || '',
              t.priority || 0,
              t.task_type || 'feature',
              t.acceptance_criteria || '',
              t.model || model,
              'medium',
              null,
            );
            const task = queries.getTaskById.get(result.lastInsertRowid);
            io.emit('task:created', task);
            created.push(task);
          }

          activityLog.add(
            project.id,
            null,
            'plan_completed',
            `Planning completed: ${tasks.length} tasks created from "${topic.trim()}"`,
          );
          io.emit('plan:completed', { projectId: project.id, planId, tasks: created });
        } else {
          io.emit('plan:completed', { projectId: project.id, planId, tasks: [], raw: fullText });
        }
      });

      res.json({ planId, status: 'started' });
    }),
  );

  // Cancel active planning
  router.post(
    '/projects/:projectId/plan/cancel',
    asyncHandler(async (req, res) => {
      const plan = activePlans.get(Number(req.params.projectId));
      if (!plan) return res.status(404).json({ error: 'No active planning session' });

      try {
        if (IS_WIN) {
          spawn('taskkill', ['/pid', String(plan.proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
        } else {
          plan.proc.kill('SIGTERM');
        }
      } catch {}

      activePlans.delete(Number(req.params.projectId));
      io.emit('plan:cancelled', { projectId: Number(req.params.projectId), planId: plan.planId });
      res.json({ status: 'cancelled' });
    }),
  );

  // Get planning status
  router.get(
    '/projects/:projectId/plan/status',
    asyncHandler(async (req, res) => {
      const plan = activePlans.get(Number(req.params.projectId));
      res.json({ active: !!plan, planId: plan?.planId || null });
    }),
  );

  return router;
}

function buildPlanningPrompt(topic, context, project) {
  return `You are a technical project planner. Analyze the following topic and create a structured task breakdown for a development project.

## Project
Name: ${project.name}
Working Directory: ${project.working_dir}

## Topic to Plan
${topic.trim()}

${context ? `## Additional Context\n${context.trim()}\n` : ''}

## Instructions
1. Research and analyze the topic thoroughly
2. Break it down into concrete, actionable development tasks
3. Each task should be small enough for a single Claude session (1-3 files)
4. Order tasks by dependency (prerequisite tasks first)

## CRITICAL: Output Format
You MUST end your response with a JSON code block containing the task array.
Use EXACTLY this format — no variations:

\`\`\`json
[
  {
    "title": "Short, clear task title",
    "description": "Detailed description of what to implement. Include specific files, functions, and requirements.",
    "task_type": "feature|bugfix|refactor|docs|test|chore",
    "priority": 0-3,
    "acceptance_criteria": "What must be true when this task is done"
  }
]
\`\`\`

Rules:
- task_type must be one of: feature, bugfix, refactor, docs, test, chore
- priority: 0=none, 1=low, 2=medium, 3=high
- Create 3-15 tasks depending on complexity
- Each task must be independently executable
- Include setup/infrastructure tasks first, then features, then tests
- Descriptions should be detailed enough for Claude to implement without additional context`;
}

function parseTasksFromOutput(text) {
  if (!text) return [];

  // Find the last JSON code block
  const jsonBlocks = [...text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/g)];
  if (jsonBlocks.length === 0) return [];

  const lastBlock = jsonBlocks[jsonBlocks.length - 1][1].trim();

  try {
    const parsed = JSON.parse(lastBlock);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({
        title: t.title.trim().slice(0, 200),
        description: (t.description || '').trim(),
        task_type: ['feature', 'bugfix', 'refactor', 'docs', 'test', 'chore'].includes(t.task_type)
          ? t.task_type
          : 'feature',
        priority: typeof t.priority === 'number' && t.priority >= 0 && t.priority <= 3 ? t.priority : 0,
        acceptance_criteria: (t.acceptance_criteria || '').trim(),
      }));
  } catch {
    return [];
  }
}
