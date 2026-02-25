import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { watch, FSWatcher } from 'fs';
import {
  allowPath,
  getPathAccessError,
  isParentPathAllowed,
  isPathAllowed,
} from '../../security/pathAccess';

const watchers = new Map<string, FSWatcher>();
const MARKDOWN_EXTENSIONS = ['md', 'txt', 'markdown'];

type FsDialogFilter = {
  name: string;
  extensions: string[];
};

type FsReadFolderOptions = {
  extensions?: string[];
};

type FsOpenFileOptions = {
  title?: string;
  filters?: FsDialogFilter[];
};

type FsSaveFileDialogOptions = {
  title?: string;
  filters?: FsDialogFilter[];
};

type FsWatchFolderOptions = {
  extensions?: string[];
};

function normalizeExtensions(extensions?: string[]): string[] {
  if (!extensions || extensions.length === 0) {
    return [...MARKDOWN_EXTENSIONS];
  }

  return extensions
    .map(ext => ext.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

function shouldIncludeFile(fileName: string, extensions: string[]): boolean {
  if (extensions.includes('*')) {
    return true;
  }
  const fileExt = path.extname(fileName).toLowerCase().replace(/^\./, '');
  return fileExt ? extensions.includes(fileExt) : false;
}

function ensurePathAllowed(targetPath: string, allowParent = false): string | null {
  const allowed = isPathAllowed(targetPath) || (allowParent && isParentPathAllowed(targetPath));
  if (allowed) {
    return null;
  }
  return getPathAccessError(targetPath);
}

export function registerFsHandlers() {
  // Open folder dialog
  ipcMain.handle('fs:openFolder', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '打开文件夹',
      properties: ['openDirectory'],
    });

    if (result.filePaths && result.filePaths.length > 0) {
      allowPath(result.filePaths[0]);
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false };
  });

  // Read folder contents
  ipcMain.handle('fs:readFolder', async (_, folderPath: string, options?: FsReadFolderOptions) => {
    const denied = ensurePathAllowed(folderPath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      const extensions = normalizeExtensions(options?.extensions);
      const items = await fs.promises.readdir(folderPath, { withFileTypes: true });
      const files = items
        .filter(item => item.isFile() && shouldIncludeFile(item.name, extensions))
        .map(item => ({
          name: item.name,
          path: path.join(folderPath, item.name),
          isDirectory: false,
        }));

      const folders = items
        .filter(item => item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules')
        .map(item => ({
          name: item.name,
          path: path.join(folderPath, item.name),
          isDirectory: true,
        }));

      return { success: true, files, folders, folderPath };
    } catch (error) {
      console.error('Failed to read folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Read file content
  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    const denied = ensurePathAllowed(filePath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('Failed to read file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Write file content
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    const denied = ensurePathAllowed(filePath, true);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      allowPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to write file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Create new file
  ipcMain.handle('fs:createFile', async (_, folderPath: string, fileName: string) => {
    const denied = ensurePathAllowed(folderPath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      const filePath = path.join(folderPath, fileName);
      await fs.promises.access(filePath, fs.constants.F_OK);
      return { success: false, error: '文件已存在' };
    } catch {
      // Expected when file does not exist.
    }

    try {
      const filePath = path.join(folderPath, fileName);
      await fs.promises.writeFile(filePath, '', 'utf-8');
      allowPath(filePath);
      return { success: true, filePath };
    } catch (error) {
      console.error('Failed to create file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Delete file
  ipcMain.handle('fs:deleteFile', async (_, filePath: string) => {
    const denied = ensurePathAllowed(filePath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Rename file
  ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
    const deniedOld = ensurePathAllowed(oldPath);
    if (deniedOld) {
      return { success: false, error: deniedOld };
    }
    const deniedNew = ensurePathAllowed(newPath, true);
    if (deniedNew) {
      return { success: false, error: deniedNew };
    }

    try {
      await fs.promises.rename(oldPath, newPath);
      allowPath(newPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to rename file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Watch folder for changes
  ipcMain.handle('fs:watchFolder', async (_, folderPath: string, options?: FsWatchFolderOptions) => {
    const denied = ensurePathAllowed(folderPath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      const watcherKey = path.resolve(folderPath);
      const extensions = normalizeExtensions(options?.extensions);
      if (watchers.has(watcherKey)) {
        watchers.get(watcherKey)!.close();
        watchers.delete(watcherKey);
      }

      const watcher = watch(folderPath, { recursive: true }, (eventType, filename) => {
        if (filename && shouldIncludeFile(filename, extensions)) {
          const win = BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send('fs:folderChange', { eventType, filename, folderPath });
          }
        }
      });

      watchers.set(watcherKey, watcher);
      return { success: true };
    } catch (error) {
      console.error('Failed to watch folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Unwatch folder
  ipcMain.handle('fs:unwatchFolder', async (_, folderPath: string) => {
    try {
      const watcherKey = path.resolve(folderPath);
      if (watchers.has(watcherKey)) {
        watchers.get(watcherKey)!.close();
        watchers.delete(watcherKey);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to unwatch folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Reveal in Finder
  ipcMain.handle('fs:reveal', async (_, filePath: string) => {
    const denied = ensurePathAllowed(filePath);
    if (denied) {
      return { success: false, error: denied };
    }
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // Open single file dialog (for direct file opening like Typora)
  ipcMain.handle('fs:openFile', async (_, options?: FsOpenFileOptions) => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: options?.title || '打开 Markdown 文件',
      filters: options?.filters || [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.filePaths && result.filePaths.length > 0) {
      allowPath(result.filePaths[0]);
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false };
  });

  // Save file dialog (Save As)
  ipcMain.handle(
    'fs:saveFileDialog',
    async (_, content: string, defaultName?: string, options?: FsSaveFileDialogOptions) => {
      const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
        title: options?.title || '保存文件',
        defaultPath: defaultName || 'untitled.md',
        filters: options?.filters || [
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
        ],
      });

      if (!result.canceled && result.filePath) {
        try {
          await fs.promises.writeFile(result.filePath, content, 'utf-8');
          allowPath(result.filePath);
          return { success: true, filePath: result.filePath };
        } catch (error) {
          console.error('Failed to save file:', error);
          return { success: false, error: (error as Error).message };
        }
      }
      return { success: false };
    }
  );

  // Get file stats (for displaying file info)
  ipcMain.handle('fs:getFileStats', async (_, filePath: string) => {
    const denied = ensurePathAllowed(filePath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      const stats = await fs.promises.stat(filePath);
      return {
        success: true,
        stats: {
          size: stats.size,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Check if file exists
  ipcMain.handle('fs:fileExists', async (_, filePath: string) => {
    const denied = ensurePathAllowed(filePath);
    if (denied) {
      return { success: false, error: denied };
    }

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return { success: true, exists: true };
    } catch {
      return { success: true, exists: false };
    }
  });
}
