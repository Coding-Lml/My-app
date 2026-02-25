import { app, BrowserWindow, protocol } from 'electron';
import path from 'path';
import { registerTodoHandlers } from './ipc/handlers/todo';
import { registerCodeHandlers } from './ipc/handlers/code';
import { registerStatsHandlers } from './ipc/handlers/stats';
import { registerStudyHandlers } from './ipc/handlers/study';
import { registerPlanHandlers } from './ipc/handlers/plan';
import { registerExportHandlers } from './ipc/handlers/export';
import { registerImageHandlers } from './ipc/handlers/image';
import { registerFsHandlers } from './ipc/handlers/fs';
import { Database } from './database';
import * as fs from 'fs';
import { allowPath, isPathAllowed } from './security/pathAccess';

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

function createWindow() {
  const iconPath =
    process.platform === 'win32'
      ? path.join(__dirname, '../../resources/icons/icon.ico')
      : path.join(__dirname, '../../resources/icons/icon-1024.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    icon: iconPath,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeDatabase() {
  db = new Database();
  await db.initialize();
}

function restoreAuthorizedPathsFromSettings() {
  if (!db) return;

  const singlePathKeys = ['notesRootFolder', 'codeWorkspaceFolder'];
  singlePathKeys.forEach(key => {
    const value = db?.getSetting(key);
    if (value) {
      allowPath(value);
    }
  });

  const listPathKeys = ['recentFiles', 'codeRecentFiles'];
  listPathKeys.forEach(key => {
    const raw = db?.getSetting(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed
          .filter((item): item is string => typeof item === 'string' && item.length > 0)
          .forEach(item => allowPath(item));
      }
    } catch {
      // Ignore invalid JSON settings.
    }
  });
}

// Register file protocol for loading local images
function registerFileProtocol() {
  protocol.handle('local-file', async (request) => {
    try {
      const urlPath = decodeURIComponent(request.url.substring('local-file://'.length));
      if (!isPathAllowed(urlPath)) {
        return new Response('Access denied', { status: 403 });
      }

      try {
        await fs.promises.access(urlPath, fs.constants.R_OK);
        const buffer = await fs.promises.readFile(urlPath);
        const ext = path.extname(urlPath).toLowerCase();
        const mimeTypeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.bmp': 'image/bmp',
        };

        const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

        return new Response(buffer, {
          headers: {
            'Content-Type': mimeType,
          },
        });
      } catch {
        return new Response('File not found', { status: 404 });
      }
    } catch (error) {
      console.error('Error serving local file:', error);
      return new Response('Internal server error', { status: 500 });
    }
  });
}

app.whenReady().then(async () => {
  await initializeDatabase();
  restoreAuthorizedPathsFromSettings();

  // Register file protocol before creating window
  registerFileProtocol();

  createWindow();

  // Register IPC handlers
  registerTodoHandlers(db!);
  registerCodeHandlers(db!);
  registerStatsHandlers(db!);
  registerStudyHandlers(db!);
  registerPlanHandlers(db!);
  registerExportHandlers(db!);
  registerImageHandlers();
  registerFsHandlers();

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
  if (db) {
    db.close();
  }
});
