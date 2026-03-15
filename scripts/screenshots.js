import puppeteer from 'puppeteer';
import { createApp } from '../src/app.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '..', 'docs', 'screenshots');

const PORT = 4444;
const BASE = `http://localhost:${PORT}`;

async function createDummyData() {
  const post = (path, body) => fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());

  const put = (path, body) => fetch(`${BASE}${path}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  const patch = (path, body) => fetch(`${BASE}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  // Create projects
  const p1 = await post('/api/projects', {
    name: 'E-Commerce API', slug: 'ecommerce-api',
    working_dir: '/home/dev/ecommerce-api', icon: 'beam', icon_seed: 'ecommerce'
  });
  const p2 = await post('/api/projects', {
    name: 'Mobile App', slug: 'mobile-app',
    working_dir: '/home/dev/mobile-app', icon: 'sunset', icon_seed: 'mobile'
  });
  const p3 = await post('/api/projects', {
    name: 'Admin Dashboard', slug: 'admin-dashboard',
    working_dir: '/home/dev/admin-dashboard', icon: 'marble', icon_seed: 'admin'
  });

  // Create tasks for p1
  const tasks = [
    { title: 'Setup Express server with TypeScript', task_type: 'feature', priority: 3, model: 'opus', thinking_effort: 'high', description: 'Initialize Express with TypeScript, ESLint, and Jest configuration' },
    { title: 'Add product CRUD endpoints', task_type: 'feature', priority: 2, model: 'sonnet', description: 'REST API for products with validation and pagination' },
    { title: 'Implement JWT authentication', task_type: 'feature', priority: 3, model: 'opus', thinking_effort: 'high', description: 'User registration, login, refresh tokens, and middleware' },
    { title: 'Fix cart total calculation bug', task_type: 'bugfix', priority: 2, model: 'sonnet', description: 'Cart total shows wrong amount when discount applied' },
    { title: 'Add order management system', task_type: 'feature', priority: 1, model: 'sonnet', description: 'Order creation, status tracking, and payment integration' },
    { title: 'Write API documentation', task_type: 'docs', priority: 1, model: 'haiku', description: 'OpenAPI/Swagger docs for all endpoints' },
    { title: 'Refactor database queries', task_type: 'refactor', priority: 1, model: 'sonnet', description: 'Optimize N+1 queries and add indexes' },
    { title: 'Add unit tests for auth module', task_type: 'test', priority: 2, model: 'sonnet', description: 'Jest tests for registration, login, token refresh flows' },
  ];

  const createdTasks = [];
  for (const t of tasks) {
    const task = await post(`/api/projects/${p1.id}/tasks`, t);
    createdTasks.push(task);
  }

  // Simulate different statuses and usage
  // Task 0: done (with usage)
  await patch(`/api/tasks/${createdTasks[0].id}/status`, { status: 'in_progress' });
  await simulateUsage(createdTasks[0].id, { input: 45000, output: 12000, cost: 0.285, turns: 8 });
  await patch(`/api/tasks/${createdTasks[0].id}/status`, { status: 'done' });

  // Task 1: done
  await patch(`/api/tasks/${createdTasks[1].id}/status`, { status: 'in_progress' });
  await simulateUsage(createdTasks[1].id, { input: 32000, output: 8500, cost: 0.162, turns: 5 });
  await patch(`/api/tasks/${createdTasks[1].id}/status`, { status: 'done' });

  // Task 2: testing (with usage + revision)
  await patch(`/api/tasks/${createdTasks[2].id}/status`, { status: 'in_progress' });
  await simulateUsage(createdTasks[2].id, { input: 68000, output: 22000, cost: 0.520, turns: 12 });
  await patch(`/api/tasks/${createdTasks[2].id}/status`, { status: 'testing' });

  // Task 3: testing
  await patch(`/api/tasks/${createdTasks[3].id}/status`, { status: 'in_progress' });
  await simulateUsage(createdTasks[3].id, { input: 18000, output: 5000, cost: 0.092, turns: 3 });
  await patch(`/api/tasks/${createdTasks[3].id}/status`, { status: 'testing' });

  // Task 4: in_progress (running)
  // Don't actually start Claude, just set status
  // Task 5-7: backlog (as is)

  // Create some tasks for p2
  await post(`/api/projects/${p2.id}/tasks`, { title: 'Setup React Native project', task_type: 'feature', priority: 2, model: 'sonnet' });
  await post(`/api/projects/${p2.id}/tasks`, { title: 'Design login screen', task_type: 'feature', priority: 1, model: 'haiku' });
  await post(`/api/projects/${p2.id}/tasks`, { title: 'Implement push notifications', task_type: 'feature', priority: 3, model: 'opus' });

  // Create tasks for p3
  await post(`/api/projects/${p3.id}/tasks`, { title: 'Build user management page', task_type: 'feature', priority: 2, model: 'sonnet' });
  await post(`/api/projects/${p3.id}/tasks`, { title: 'Add analytics charts', task_type: 'feature', priority: 1, model: 'sonnet' });

  console.log('Dummy data created:', { projects: 3, tasks: tasks.length + 5 });
  return p1;
}

async function simulateUsage(taskId, { input, output, cost, turns }) {
  await fetch(`${BASE}/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  // Directly update via a custom route is not available, so we'll use the DB
  // For screenshots, the summary stats will show from project summary
}

async function takeScreenshots(projectSlug) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Wait for app to be ready
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Dashboard
  console.log('Taking dashboard screenshot...');
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'dashboard.png'), fullPage: false });

  // 2. Board view
  console.log('Taking board screenshot...');
  await page.goto(`${BASE}/${projectSlug}`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(SCREENSHOTS_DIR, 'board.png'), fullPage: false });

  // 3. Stats panel - click Stats button
  console.log('Taking stats screenshot...');
  try {
    const statsBtn = await page.$$('button');
    for (const btn of statsBtn) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Stats')) { await btn.click(); break; }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'stats.png'), fullPage: false });
  } catch (e) { console.log('Stats screenshot skipped:', e.message); }

  // 4. Activity panel
  console.log('Taking activity screenshot...');
  try {
    const actBtn = await page.$$('button');
    for (const btn of actBtn) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Activity')) { await btn.click(); break; }
    }
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'activity.png'), fullPage: false });
  } catch (e) { console.log('Activity screenshot skipped:', e.message); }

  // 5. Task modal - click New Task button
  console.log('Taking task modal screenshot...');
  try {
    // Close any open panel first
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    const newTaskBtn = await page.$$('button');
    for (const btn of newTaskBtn) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('New Task')) { await btn.click(); break; }
    }
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: join(SCREENSHOTS_DIR, 'task-modal.png'), fullPage: false });
    await page.keyboard.press('Escape');
  } catch (e) { console.log('Task modal screenshot skipped:', e.message); }

  await browser.close();
  console.log('All screenshots saved to docs/screenshots/');
}

// Main
async function main() {
  console.log('Starting server...');
  const { server } = createApp();

  await new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      resolve();
    });
  });

  try {
    const project = await createDummyData();
    await takeScreenshots(project.slug || 'ecommerce-api');
  } catch (e) {
    console.error('Error:', e);
  }

  server.close();
  process.exit(0);
}

main();
