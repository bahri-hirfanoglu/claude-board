const { app, BrowserWindow, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let tray = null;
const PORT = 4000;

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  // In packaged app, resources are in different location
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', iconName);
  }
  return path.join(__dirname, '..', 'build', iconName);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'server.js')
      : path.join(__dirname, '..', 'server.js');

    const cwd = app.isPackaged
      ? process.resourcesPath
      : path.join(__dirname, '..');

    serverProcess = spawn(process.execPath, [serverPath], {
      cwd,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', ELECTRON: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[Server]', text.trim());
      if (!started && (text.includes('localhost') || text.includes('Claude Board'))) {
        started = true;
        // Give server a moment to fully start
        setTimeout(resolve, 500);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('[Server] Failed to start:', err.message);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('[Server] Exited with code:', code);
      if (!started) reject(new Error(`Server exited with code ${code}`));
    });

    // Timeout fallback
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 5000);
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
  });

  // Open external links in browser
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

  // Remove default menu, add custom
  const menu = Menu.buildFromTemplate([
    {
      label: 'Claude Board',
      submenu: [
        { label: 'About', role: 'about' },
        { type: 'separator' },
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(`http://localhost:${PORT}`),
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
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
  console.log('Starting Claude Board...');

  try {
    await startServer();
    console.log('Server started on port', PORT);
  } catch (err) {
    console.error('Failed to start server:', err.message);
  }

  createWindow();

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
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
