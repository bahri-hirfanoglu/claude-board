import puppeteer from 'puppeteer';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import { createWriteStream, readFileSync } from 'fs';
import { createApp } from '../src/app.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'docs', 'demo.gif');
const PORT = 4445;
const BASE = `http://localhost:${PORT}`;
const WIDTH = 1280;
const HEIGHT = 800;

async function createDummyData() {
  const post = (path, body) => fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());
  const patch = (path, body) => fetch(`${BASE}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  const p1 = await post('/api/projects', {
    name: 'E-Commerce API', slug: 'demo-ecommerce',
    working_dir: '/home/dev/ecommerce-api', icon: 'beam', icon_seed: 'ecommerce'
  });
  const p2 = await post('/api/projects', {
    name: 'Mobile App', slug: 'demo-mobile',
    working_dir: '/home/dev/mobile-app', icon: 'sunset', icon_seed: 'mobile'
  });
  const p3 = await post('/api/projects', {
    name: 'Admin Dashboard', slug: 'demo-admin',
    working_dir: '/home/dev/admin', icon: 'marble', icon_seed: 'admin'
  });

  const tasks = [
    { title: 'Setup Express server with TypeScript', task_type: 'feature', priority: 3, model: 'opus', thinking_effort: 'high', description: 'Initialize Express with TypeScript, ESLint, and Jest' },
    { title: 'Add product CRUD endpoints', task_type: 'feature', priority: 2, model: 'sonnet', description: 'REST API for products with validation' },
    { title: 'Implement JWT authentication', task_type: 'feature', priority: 3, model: 'opus', thinking_effort: 'high', description: 'User registration, login, refresh tokens' },
    { title: 'Fix cart total calculation bug', task_type: 'bugfix', priority: 2, model: 'sonnet', description: 'Cart shows wrong amount with discount' },
    { title: 'Add order management system', task_type: 'feature', priority: 1, model: 'sonnet', description: 'Order creation and status tracking' },
    { title: 'Write API documentation', task_type: 'docs', priority: 1, model: 'haiku' },
    { title: 'Refactor database queries', task_type: 'refactor', priority: 1, model: 'sonnet' },
    { title: 'Add unit tests for auth', task_type: 'test', priority: 2, model: 'sonnet' },
  ];

  const created = [];
  for (const t of tasks) created.push(await post(`/api/projects/${p1.id}/tasks`, t));

  // Set statuses
  await patch(`/api/tasks/${created[0].id}/status`, { status: 'in_progress' });
  await new Promise(r => setTimeout(r, 300));
  await patch(`/api/tasks/${created[0].id}/status`, { status: 'done' });
  await patch(`/api/tasks/${created[1].id}/status`, { status: 'in_progress' });
  await new Promise(r => setTimeout(r, 300));
  await patch(`/api/tasks/${created[1].id}/status`, { status: 'done' });
  await patch(`/api/tasks/${created[2].id}/status`, { status: 'in_progress' });
  await new Promise(r => setTimeout(r, 300));
  await patch(`/api/tasks/${created[2].id}/status`, { status: 'testing' });
  await patch(`/api/tasks/${created[3].id}/status`, { status: 'in_progress' });
  await new Promise(r => setTimeout(r, 300));
  await patch(`/api/tasks/${created[3].id}/status`, { status: 'testing' });

  await post(`/api/projects/${p2.id}/tasks`, { title: 'Setup React Native', task_type: 'feature', priority: 2, model: 'sonnet' });
  await post(`/api/projects/${p2.id}/tasks`, { title: 'Implement push notifications', task_type: 'feature', priority: 3, model: 'opus' });
  await post(`/api/projects/${p3.id}/tasks`, { title: 'Build user management', task_type: 'feature', priority: 2, model: 'sonnet' });

  return p1;
}

async function captureFrames(page, projectSlug) {
  const frames = [];

  async function capture(hold = 2000) {
    const buf = await page.screenshot({ encoding: 'binary' });
    // Repeat frame for hold duration (at 4fps = hold/250 frames)
    const count = Math.max(1, Math.round(hold / 250));
    for (let i = 0; i < count; i++) frames.push(buf);
  }

  // Scene 1: Dashboard (3s)
  console.log('  Scene 1: Dashboard');
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await capture(3000);

  // Scene 2: Click into project -> Board (3s)
  console.log('  Scene 2: Board');
  await page.goto(`${BASE}/${projectSlug}`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
  await capture(3000);

  // Scene 3: Open New Task modal (3s)
  console.log('  Scene 3: Task Modal');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('New Task')) { await btn.click(); break; }
  }
  await new Promise(r => setTimeout(r, 600));
  await capture(3000);

  // Scene 4: Close modal, open Stats (3s)
  console.log('  Scene 4: Stats');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));
  const btns2 = await page.$$('button');
  for (const btn of btns2) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Stats')) { await btn.click(); break; }
  }
  await new Promise(r => setTimeout(r, 600));
  await capture(3000);

  // Scene 5: Switch to Activity (3s)
  console.log('  Scene 5: Activity');
  const btns3 = await page.$$('button');
  for (const btn of btns3) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Activity')) { await btn.click(); break; }
  }
  await new Promise(r => setTimeout(r, 600));
  await capture(3000);

  // Scene 6: Back to dashboard (2s)
  console.log('  Scene 6: Back to Dashboard');
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));
  await capture(2000);

  return frames;
}

async function createGif(frames) {
  console.log(`Creating GIF from ${frames.length} frames...`);

  // Parse first frame to get dimensions
  const firstPng = PNG.sync.read(frames[0]);
  const encoder = new GIFEncoder(firstPng.width, firstPng.height, 'neuquant', false);

  const stream = createWriteStream(OUTPUT);
  encoder.createReadStream().pipe(stream);

  encoder.start();
  encoder.setDelay(250); // 4 fps
  encoder.setRepeat(0);  // loop forever
  encoder.setQuality(10);

  for (let i = 0; i < frames.length; i++) {
    if (i % 4 === 0) process.stdout.write(`\r  Encoding frame ${i + 1}/${frames.length}`);
    const png = PNG.sync.read(frames[i]);
    encoder.addFrame(png.data);
  }

  encoder.finish();
  console.log('\n  GIF encoding complete');

  await new Promise(resolve => stream.on('finish', resolve));
}

async function main() {
  console.log('Starting demo creation...\n');

  const { server } = createApp();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Server on port ${PORT}`);

  const project = await createDummyData();
  console.log('Dummy data ready\n');

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: WIDTH, height: HEIGHT },
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  console.log('Capturing scenes:');
  const frames = await captureFrames(page, project.slug || 'demo-ecommerce');
  await browser.close();

  console.log(`\n${frames.length} frames captured`);
  await createGif(frames);

  const stats = readFileSync(OUTPUT);
  console.log(`\nDemo saved: docs/demo.gif (${(stats.length / 1024 / 1024).toFixed(1)} MB)`);

  server.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
