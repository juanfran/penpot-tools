const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const VIEWER_PORT = Number(process.env.VIEWER_PORT) || 4173;
const VIEWER_URL = `http://localhost:${VIEWER_PORT}`;

const isPackaged = app.isPackaged;
const viewerOutputDir = isPackaged
  ? path.join(process.resourcesPath, 'viewer-output')
  : path.join(__dirname, '..', 'viewer', '.output');

let viewerProcess = null;
let mainWindow = null;

function startViewerServer() {
  const serverEntry = path.join(viewerOutputDir, 'server', 'index.mjs');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Viewer build not found at ${serverEntry}. Run "pnpm --filter viewer build" first.`,
    );
  }

  viewerProcess = spawn(process.execPath, [serverEntry], {
    cwd: viewerOutputDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(VIEWER_PORT),
      NITRO_PORT: String(VIEWER_PORT),
    },
  });

  viewerProcess.on('exit', (code, signal) => {
    console.log(`[electron] viewer process exited (code=${code}, signal=${signal})`);
    viewerProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
}

function waitForServer(url, { timeoutMs = 30_000, intervalMs = 250 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, intervalMs);
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(VIEWER_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(VIEWER_URL);
}

app.whenReady().then(async () => {
  try {
    startViewerServer();
    await waitForServer(VIEWER_URL);
    createWindow();
  } catch (err) {
    console.error('[electron] failed to start viewer server:', err);
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (viewerProcess) {
    viewerProcess.kill();
    viewerProcess = null;
  }
});
