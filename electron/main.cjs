const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let server = null;
const PORT = 4000;

// Single instance lock — if already running, focus existing window
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

async function startServer() {
  // Set working directory and env before importing
  const appRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar') : path.join(__dirname, '..');

  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'production';
  process.env.ELECTRON = '1';
  // Store DB in user data directory when packaged
  if (app.isPackaged) {
    process.env.CLAUDE_BOARD_DATA = app.getPath('userData');
  }

  // Dynamically import the ESM server module (Windows needs file:// URL)
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
  } catch (err) {
    console.error('Failed to start server:', err);
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
  if (server) {
    server.close();
    server = null;
  }
});
