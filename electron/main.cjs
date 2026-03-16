const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let splashWindow = null;
let server = null;
const PORT = 4000;

// Single instance lock
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

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', iconName);
  }
  return path.join(__dirname, '..', 'build', iconName);
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; overflow: hidden; -webkit-app-region: drag;
  }
  .card {
    background: #1f1b17;
    border: 1px solid #3d372e;
    border-radius: 20px;
    padding: 48px 40px 40px;
    text-align: center;
    width: 340px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }
  .icon {
    width: 72px; height: 72px;
    background: linear-gradient(135deg, #E8926E, #C45A3C);
    border-radius: 18px;
    margin: 0 auto 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .icon svg { width: 40px; height: 40px; }
  h1 { color: #ebe4d8; font-size: 20px; font-weight: 700; margin-bottom: 6px; letter-spacing: -0.3px; }
  .version { color: #736858; font-size: 11px; margin-bottom: 32px; }
  .steps { text-align: left; margin-bottom: 28px; }
  .step {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 0; font-size: 12px; color: #564d40;
    transition: color 0.3s;
  }
  .step.active { color: #DA7756; }
  .step.done { color: #918678; }
  .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #3d372e; flex-shrink: 0;
    transition: background 0.3s, box-shadow 0.3s;
  }
  .step.active .dot { background: #DA7756; box-shadow: 0 0 8px #DA775680; }
  .step.done .dot { background: #918678; }
  .spinner {
    width: 18px; height: 18px;
    border: 2px solid #3d372e;
    border-top-color: #DA7756;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status { color: #736858; font-size: 11px; margin-top: 10px; }
</style></head>
<body><div class="card">
  <div class="icon">
    <svg viewBox="0 0 512 512" fill="none">
      <path d="M256 72 C256 72,272 188,276 212 C280 236,324 256,440 256 C324 256,280 276,276 300 C272 324,256 440,256 440 C256 440,240 324,236 300 C232 276,188 256,72 256 C188 256,232 236,236 212 C240 188,256 72,256 72Z" fill="white" opacity="0.95"/>
    </svg>
  </div>
  <h1>Claude Board</h1>
  <div class="version">v3.5.0</div>
  <div class="steps">
    <div class="step" id="s1"><span class="dot"></span>Initializing application</div>
    <div class="step" id="s2"><span class="dot"></span>Loading modules</div>
    <div class="step" id="s3"><span class="dot"></span>Starting server</div>
    <div class="step" id="s4"><span class="dot"></span>Loading dashboard</div>
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

async function startServer() {
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'production';
  process.env.ELECTRON = '1';
  if (app.isPackaged) {
    process.env.CLAUDE_BOARD_DATA = app.getPath('userData');
  }

  const { pathToFileURL } = require('url');
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'src', 'app.js')
    : path.join(__dirname, '..', 'src', 'app.js');
  const { createApp } = await import(pathToFileURL(appPath).href);

  const result = createApp();
  server = result.server;

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Claude Board server running on port ${PORT}`);
      resolve();
    });
  });
}

function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    title: 'Claude Board',
    backgroundColor: '#1f1b17',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Close splash after main window is visible
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Claude Board',
      submenu: [
        { label: 'About', role: 'about' },
        { type: 'separator' },
        { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${PORT}`) },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
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
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // Show splash immediately
  createSplash();
  updateSplash(0, 'Initializing...');

  try {
    updateSplash(1, 'Loading modules...');
    await new Promise((r) => setTimeout(r, 200));

    updateSplash(2, 'Starting server...');
    await startServer();

    updateSplash(3, 'Loading dashboard...');
    createWindow();
  } catch (err) {
    console.error('Failed to start:', err);
    updateSplash(0, 'Error: ' + err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});
