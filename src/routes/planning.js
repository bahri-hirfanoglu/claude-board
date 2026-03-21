import { Router } from 'express';
import { spawn } from 'child_process';
import { platform } from 'os';
import { asyncHandler } from '../middleware/errorHandler.js';

const IS_WIN = platform() === 'win32';

export default function planningRoutes({ queries, projectQueries, io, activityLog }) {
  const router = Router();
  const activePlans = new Map();

  router.post(
    '/projects/:projectId/plan',
    asyncHandler(async (req, res) => {
      const project = projectQueries.getById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { topic, model = 'sonnet', effort = 'medium', granularity = 'balanced', context = '' } = req.body;
      if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

      if (activePlans.has(project.id)) {
        return res.status(409).json({ error: 'Planning already in progress for this project' });
      }

      const MODEL_MAP = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };
      const planId = `plan-${project.id}-${Date.now()}`;
      const startTime = Date.now();

      const prompt = buildPlanningPrompt(topic, context, project, granularity);
      const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
      if (MODEL_MAP[model]) args.push('--model', MODEL_MAP[model]);
      if (effort && effort !== 'medium') args.push('--thinking-budget', effort);

      const proc = spawn('claude', args, {
        cwd: project.working_dir,
        shell: false,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        ...(IS_WIN && { windowsHide: true }),
      });

      const session = { proc, planId, startTime, tokens: { input: 0, output: 0 }, toolCalls: 0, turns: 0 };
      activePlans.set(project.id, session);

      const pid = project.id;
      io.emit('plan:started', { projectId: pid, planId, topic, model, effort });
      activityLog.add(pid, null, 'plan_started', `Planning started: ${topic.trim()}`);

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
            handlePlanEvent(event, pid, planId, session, io, fullText, (t) => {
              fullText += t;
            });
          } catch {}
        }
      });

      proc.stderr.on('data', (chunk) => {
        const msg = chunk.toString().trim();
        if (msg) io.emit('plan:log', { projectId: pid, planId, type: 'error', message: msg });
      });

      proc.on('close', (code) => {
        activePlans.delete(pid);
        const elapsed = Date.now() - startTime;

        const tasks = parseTasksFromOutput(fullText);

        if (tasks.length > 0) {
          const created = [];
          for (const t of tasks) {
            const result = queries.createTask.run(
              pid,
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
            pid,
            null,
            'plan_completed',
            `Planning completed: ${tasks.length} tasks from "${topic.trim()}"`,
          );
          io.emit('plan:completed', {
            projectId: pid,
            planId,
            tasks: created,
            stats: {
              elapsed,
              tokens: session.tokens,
              toolCalls: session.toolCalls,
              turns: session.turns,
              exitCode: code,
            },
          });
        } else {
          io.emit('plan:completed', {
            projectId: pid,
            planId,
            tasks: [],
            stats: {
              elapsed,
              tokens: session.tokens,
              toolCalls: session.toolCalls,
              turns: session.turns,
              exitCode: code,
            },
            raw: fullText,
          });
        }
      });

      res.json({ planId, status: 'started' });
    }),
  );

  router.post(
    '/projects/:projectId/plan/cancel',
    asyncHandler(async (req, res) => {
      const plan = activePlans.get(Number(req.params.projectId));
      if (!plan) return res.status(404).json({ error: 'No active planning session' });

      try {
        if (IS_WIN) {
          spawn('taskkill', ['/pid', String(plan.proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        } else {
          plan.proc.kill('SIGTERM');
        }
      } catch {}

      activePlans.delete(Number(req.params.projectId));
      io.emit('plan:cancelled', { projectId: Number(req.params.projectId), planId: plan.planId });
      res.json({ status: 'cancelled' });
    }),
  );

  router.get(
    '/projects/:projectId/plan/status',
    asyncHandler(async (req, res) => {
      const plan = activePlans.get(Number(req.params.projectId));
      if (!plan) return res.json({ active: false, planId: null });
      res.json({
        active: true,
        planId: plan.planId,
        elapsed: Date.now() - plan.startTime,
        tokens: plan.tokens,
        toolCalls: plan.toolCalls,
      });
    }),
  );

  return router;
}

// ─── Event handler ───
function handlePlanEvent(event, projectId, planId, session, io, _fullText, appendText) {
  const type = event.type;

  if (type === 'assistant') {
    const content = event.message?.content;
    if (!Array.isArray(content)) return;

    session.turns++;

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        appendText(block.text);
        io.emit('plan:progress', { projectId, planId, type: 'text', content: block.text });
      } else if (block.type === 'tool_use') {
        session.toolCalls++;
        const tool = block.name || 'unknown';
        const input = block.input || {};
        let detail = tool;
        if (input.file_path || input.path) detail += ` → ${input.file_path || input.path}`;
        else if (input.command) detail += ` → ${String(input.command).slice(0, 120)}`;
        else if (input.pattern) detail += ` → ${input.pattern}`;
        else if (input.description) detail += ` → ${String(input.description).slice(0, 100)}`;

        io.emit('plan:log', { projectId, planId, type: 'tool', message: detail, tool });
      }
    }

    // Track tokens
    const usage = event.message?.usage;
    if (usage) {
      session.tokens.input += usage.input_tokens || 0;
      session.tokens.output += usage.output_tokens || 0;
    }

    // Emit stats update
    io.emit('plan:stats', {
      projectId,
      planId,
      elapsed: Date.now() - session.startTime,
      tokens: session.tokens,
      toolCalls: session.toolCalls,
      turns: session.turns,
    });
  }

  if (type === 'user') {
    // Tool results
    const content = event.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result' && block.content) {
          const preview =
            typeof block.content === 'string'
              ? block.content.slice(0, 200)
              : JSON.stringify(block.content).slice(0, 200);
          io.emit('plan:log', { projectId, planId, type: 'result', message: preview });
        }
      }
    }
  }
}

// ─── Prompt ───
const GRANULARITY = {
  'high-level': {
    count: '3-5',
    style: `Create FEW large tasks (3-5 maximum). Each task should be a major milestone that covers a broad area of work.
In the description of each task, include a bullet-point checklist of sub-steps that need to be done within that task.
Use "- [ ] step description" format for sub-steps inside the description.
Do NOT create separate tasks for small things like "add validation" or "write tests" — bundle them into the parent task's checklist.`,
  },
  balanced: {
    count: '5-10',
    style: `Create a moderate number of tasks (5-10). Each task should represent a meaningful unit of work.
Group related small changes into a single task. For example, "Add user model + migration + validation" is ONE task, not three.
Include sub-steps as bullet points in the description when a task has multiple parts.`,
  },
  detailed: {
    count: '10-20',
    style: `Create detailed, atomic tasks (10-20). Each task should be small and focused on a single concern.
Each task should be completable in a single Claude session (1-3 files).
Include setup, implementation, and testing as separate tasks.`,
  },
};

function buildPlanningPrompt(topic, context, project, granularity = 'balanced') {
  const g = GRANULARITY[granularity] || GRANULARITY.balanced;

  return `You are a technical project planner. Analyze the following topic and create a structured task breakdown for a development project.

## Project
Name: ${project.name}
Working Directory: ${project.working_dir}

## Topic to Plan
${topic.trim()}

${context ? `## Additional Context\n${context.trim()}\n` : ''}

## Instructions
1. First, explore the project's codebase to understand the existing structure, tech stack, and patterns
2. Research the topic — understand best practices and common approaches
3. Break it down into concrete, actionable development tasks
4. Order tasks by dependency (prerequisite tasks first)

## Task Granularity: ${granularity.toUpperCase()}
${g.style}

## CRITICAL: Output Format
You MUST end your response with a JSON code block containing the task array.
Use EXACTLY this format — no variations:

\`\`\`json
[
  {
    "title": "Short, clear task title",
    "description": "Detailed description. Use bullet points (- [ ] step) for sub-steps within this task.",
    "task_type": "feature|bugfix|refactor|docs|test|chore",
    "priority": 0-3,
    "acceptance_criteria": "What must be true when this task is done"
  }
]
\`\`\`

Rules:
- task_type must be one of: feature, bugfix, refactor, docs, test, chore
- priority: 0=none, 1=low, 2=medium, 3=high
- Create ${g.count} tasks
- Descriptions should be detailed enough for Claude to implement without additional context
- Reference actual files and patterns from the codebase when possible`;
}

// ─── Parser ───
function parseTasksFromOutput(text) {
  if (!text) return [];

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
