const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

let mainWindow = null;
let splashWindow = null;
let setupWindow = null;
let server = null;
const PORT = 4000;

// ─── Config ───
const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {}
  return null;
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ─── Single instance ───
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Icon ───
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) return path.join(process.resourcesPath, 'build', iconName);
  return path.join(__dirname, '..', 'build', iconName);
}

// ─── Sparkle SVG (shared) ───
const SPARKLE_SVG = `<svg viewBox="0 0 512 512" fill="none">
  <path d="M256 72 C256 72,272 188,276 212 C280 236,324 256,440 256 C324 256,280 276,276 300 C272 324,256 440,256 440 C256 440,240 324,236 300 C232 276,188 256,72 256 C188 256,232 236,236 212 C240 188,256 72,256 72Z" fill="white" opacity="0.95"/>
</svg>`;

// ─── Frameless window options (cross-platform) ───
function framelessOptions(extra = {}) {
  const opts = {
    frame: false,
    resizable: false,
    icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    ...extra,
  };
  // transparent works on Windows & macOS, Linux needs backgroundColor fallback
  if (isLinux) {
    opts.backgroundColor = '#1f1b17';
  } else {
    opts.transparent = true;
  }
  return opts;
}

// ─── Setup Window ───
function createSetup() {
  return new Promise((resolve) => {
    const defaultDir = path.join(app.getPath('userData'), 'data');

    setupWindow = new BrowserWindow(framelessOptions({
      width: 520,
      height: 580,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    }));

    // createDirectory is macOS-only dialog property
    const dialogProps = ['openDirectory'];
    if (isMac) dialogProps.push('createDirectory');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${isLinux ? '#1f1b17' : 'transparent'}; height: 100vh; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #1f1b17; border: 1px solid #3d372e; border-radius: 20px;
    padding: 44px 40px 36px; width: 480px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6); -webkit-app-region: drag;
  }
  .icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg, #E8926E, #C45A3C);
    border-radius: 16px; margin: 0 auto 20px;
    display: flex; align-items: center; justify-content: center;
  }
  .icon svg { width: 36px; height: 36px; }
  h1 { color: #ebe4d8; font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 4px; }
  .subtitle { color: #736858; font-size: 12px; text-align: center; margin-bottom: 32px; }
  label { display: block; color: #b5ab9a; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
  .desc { color: #564d40; font-size: 11px; margin-bottom: 20px; line-height: 1.5; }
  .path-row { display: flex; gap: 8px; margin-bottom: 8px; -webkit-app-region: no-drag; }
  .path-input {
    flex: 1; padding: 10px 14px; background: #2a2520; border: 1px solid #3d372e;
    border-radius: 10px; color: #ebe4d8; font-size: 12px; font-family: monospace; outline: none;
  }
  .path-input:focus { border-color: #DA7756; }
  .browse-btn {
    padding: 10px 16px; background: #2a2520; border: 1px solid #3d372e;
    border-radius: 10px; color: #b5ab9a; font-size: 12px; cursor: pointer;
    white-space: nowrap; transition: all 0.15s;
  }
  .browse-btn:hover { border-color: #DA7756; color: #DA7756; }
  .info {
    display: flex; align-items: flex-start; gap: 8px; padding: 12px;
    background: #2a2520; border-radius: 10px; margin-bottom: 28px;
  }
  .info-icon { color: #DA7756; font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .info-text { color: #918678; font-size: 11px; line-height: 1.5; }
  .actions { display: flex; gap: 10px; justify-content: flex-end; -webkit-app-region: no-drag; }
  .btn {
    padding: 10px 28px; border-radius: 10px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; transition: all 0.15s;
  }
  .btn-secondary { background: #2a2520; color: #b5ab9a; border: 1px solid #3d372e; }
  .btn-secondary:hover { border-color: #918678; color: #ebe4d8; }
  .btn-primary { background: linear-gradient(135deg, #DA7756, #C45A3C); color: white; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
  .port-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; -webkit-app-region: no-drag; }
  .port-input {
    width: 80px; padding: 10px 14px; background: #2a2520; border: 1px solid #3d372e;
    border-radius: 10px; color: #ebe4d8; font-size: 12px; font-family: monospace;
    outline: none; text-align: center;
  }
  .port-input:focus { border-color: #DA7756; }
  .port-label { color: #564d40; font-size: 11px; }
</style></head>
<body><div class="card">
  <div class="icon">${SPARKLE_SVG}</div>
  <h1>Welcome to Claude Board</h1>
  <div class="subtitle">Let's set up a few things before we start</div>
  <label>Data Directory</label>
  <div class="desc">Where your projects, tasks, and database will be stored.</div>
  <div class="path-row">
    <input class="path-input" id="dataPath" value="${defaultDir.replace(/\\/g, '\\\\')}" />
    <button class="browse-btn" onclick="browse()">Browse</button>
  </div>
  <div class="info">
    <span class="info-icon">i</span>
    <span class="info-text">This folder will contain your SQLite database and uploaded files. You can change this later in the config file.</span>
  </div>
  <label>Server Port</label>
  <div class="port-row">
    <input class="port-input" id="portInput" type="number" value="4000" min="1024" max="65535" />
    <span class="port-label">Default: 4000</span>
  </div>
  <div class="actions">
    <button class="btn btn-secondary" onclick="window.electronAPI.quit()">Cancel</button>
    <button class="btn btn-primary" id="startBtn" onclick="start()">Get Started</button>
  </div>
</div>
<script>
  async function browse() {
    const result = await window.electronAPI.selectFolder();
    if (result) document.getElementById('dataPath').value = result;
  }
  async function start() {
    const btn = document.getElementById('startBtn');
    btn.disabled = true; btn.textContent = 'Setting up...';
    const dataPath = document.getElementById('dataPath').value;
    const port = parseInt(document.getElementById('portInput').value) || 4000;
    await window.electronAPI.finishSetup({ dataDir: dataPath, port });
  }
</script>
</body></html>`;

    setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    setupWindow.center();
    setupWindow.show();

    ipcMain.handleOnce('select-folder', async () => {
      const result = await dialog.showOpenDialog(setupWindow, {
        properties: dialogProps,
        title: 'Select Data Directory',
      });
      return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handleOnce('finish-setup', async (_, config) => {
      fs.mkdirSync(config.dataDir, { recursive: true });
      saveConfig(config);
      setupWindow.close();
      setupWindow = null;
      resolve(config);
    });

    ipcMain.handleOnce('quit-setup', () => {
      app.quit();
    });

    setupWindow.on('closed', () => {
      setupWindow = null;
      if (!loadConfig()) app.quit();
    });
  });
}

// ─── Splash Window ───
function createSplash() {
  splashWindow = new BrowserWindow(framelessOptions({
    width: 380,
    height: 420,
    alwaysOnTop: true,
  }));

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${isLinux ? '#1f1b17' : 'transparent'}; display: flex; align-items: center; justify-content: center;
    height: 100vh; overflow: hidden; -webkit-app-region: drag;
  }
  .card {
    background: #1f1b17; border: 1px solid #3d372e; border-radius: 20px;
    padding: 48px 40px 40px; text-align: center; width: 340px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }
  .icon {
    width: 72px; height: 72px;
    background: linear-gradient(135deg, #E8926E, #C45A3C);
    border-radius: 18px; margin: 0 auto 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .icon svg { width: 40px; height: 40px; }
  h1 { color: #ebe4d8; font-size: 20px; font-weight: 700; margin-bottom: 6px; }
  .version { color: #736858; font-size: 11px; margin-bottom: 32px; }
  .steps { text-align: left; margin-bottom: 28px; }
  .step { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 12px; color: #564d40; transition: color 0.3s; }
  .step.active { color: #DA7756; }
  .step.done { color: #918678; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #3d372e; flex-shrink: 0; transition: background 0.3s, box-shadow 0.3s; }
  .step.active .dot { background: #DA7756; box-shadow: 0 0 8px #DA775680; }
  .step.done .dot { background: #918678; }
  .spinner { width: 18px; height: 18px; border: 2px solid #3d372e; border-top-color: #DA7756; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { color: #736858; font-size: 11px; margin-top: 10px; }
</style></head>
<body><div class="card">
  <div class="icon">${SPARKLE_SVG}</div>
  <h1>Claude Board</h1>
  <div class="version">v3.5.0</div>
  <div class="steps">
    <div class="step"><span class="dot"></span>Initializing application</div>
    <div class="step"><span class="dot"></span>Loading modules</div>
    <div class="step"><span class="dot"></span>Starting server</div>
    <div class="step"><span class="dot"></span>Loading dashboard</div>
  </div>
  <div class="spinner"></div>
  <div class="status" id="statusText">Starting...</div>
</div></body></html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splashWindow.center();
  splashWindow.show();
}

function updateSplash(step, text) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.executeJavaScript(`
    document.querySelectorAll('.step').forEach((el, i) => {
      el.className = 'step' + (i < ${step} ? ' done' : i === ${step} ? ' active' : '');
    });
    document.getElementById('statusText').textContent = '${text}';
  `).catch(() => {});
}

// ─── Server ───
async function startServer(config) {
  const port = config?.port || PORT;
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'production';
  process.env.ELECTRON = '1';
  process.env.CLAUDE_BOARD_DATA = config?.dataDir || app.getPath('userData');

  const { pathToFileURL } = require('url');
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'src', 'app.js')
    : path.join(__dirname, '..', 'src', 'app.js');
  const { createApp } = await import(pathToFileURL(appPath).href);

  const result = createApp();
  server = result.server;

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Claude Board server running on port ${port}`);
      resolve(port);
    });
  });
}

// ─── Main Window ───
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 600,
    icon: getIconPath(), title: 'Claude Board', backgroundColor: '#1f1b17',
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // ─── Menu (cross-platform) ───
  const template = [];

  // macOS app menu
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${port}`) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(
    // File menu (Windows/Linux)
    ...(!isMac ? [{
      label: 'File',
      submenu: [
        { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${port}`) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] : [{ role: 'selectAll' }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── App lifecycle ───
app.whenReady().then(async () => {
  let config = loadConfig();

  if (!config) {
    config = await createSetup();
  }

  createSplash();
  updateSplash(0, 'Initializing...');

  try {
    updateSplash(1, 'Loading modules...');
    await new Promise((r) => setTimeout(r, 200));

    updateSplash(2, 'Starting server...');
    const port = await startServer(config);

    updateSplash(3, 'Loading dashboard...');
    createWindow(port);
  } catch (err) {
    console.error('Failed to start:', err);
    updateSplash(0, 'Error: ' + err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const cfg = loadConfig();
      createWindow(cfg?.port || PORT);
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  if (server) { server.close(); server = null; }
});
