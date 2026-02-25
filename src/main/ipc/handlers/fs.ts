import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { watch, FSWatcher } from 'fs';

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
    .map((ext) => ext.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
}

function shouldIncludeFile(fileName: string, extensions: string[]): boolean {
  if (extensions.includes('*')) {
    return true;
  }
  const fileExt = path.extname(fileName).toLowerCase().replace(/^\./, '');
  return fileExt ? extensions.includes(fileExt) : false;
}

export function registerFsHandlers() {
  // Open folder dialog
  ipcMain.handle('fs:openFolder', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '打开文件夹',
      properties: ['openDirectory'],
    });

    if (result.filePaths && result.filePaths.length > 0) {
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false };
  });

  // Read folder contents
  ipcMain.handle('fs:readFolder', async (_, folderPath: string, options?: FsReadFolderOptions) => {
    try {
      const extensions = normalizeExtensions(options?.extensions);
      const items = fs.readdirSync(folderPath, { withFileTypes: true });
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
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('Failed to read file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Write file content
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Create new file
  ipcMain.handle('fs:createFile', async (_, folderPath: string, fileName: string) => {
    try {
      const filePath = path.join(folderPath, fileName);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf-8');
        return { success: true, filePath };
      }
      return { success: false, error: '文件已存在' };
    } catch (error) {
      console.error('Failed to create file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Delete file
  ipcMain.handle('fs:deleteFile', async (_, filePath: string) => {
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Rename file
  ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to rename file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Watch folder for changes
  ipcMain.handle('fs:watchFolder', async (_, folderPath: string, options?: FsWatchFolderOptions) => {
    try {
      const extensions = normalizeExtensions(options?.extensions);
      // Unwatch if already watching
      if (watchers.has(folderPath)) {
        watchers.get(folderPath)!.close();
        watchers.delete(folderPath);
      }

      const watcher = watch(folderPath, { recursive: true }, (eventType, filename) => {
        if (filename && shouldIncludeFile(filename, extensions)) {
          const win = BrowserWindow.getFocusedWindow();
          if (win) {
            win.webContents.send('fs:folderChange', { eventType, filename, folderPath });
          }
        }
      });

      watchers.set(folderPath, watcher);
      return { success: true };
    } catch (error) {
      console.error('Failed to watch folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Unwatch folder
  ipcMain.handle('fs:unwatchFolder', async (_, folderPath: string) => {
    try {
      if (watchers.has(folderPath)) {
        watchers.get(folderPath)!.close();
        watchers.delete(folderPath);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to unwatch folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Reveal in Finder
  ipcMain.handle('fs:reveal', async (_, filePath: string) => {
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
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile'],
    });

    if (result.filePaths && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false };
  });

  // Save file dialog (Save As)
  ipcMain.handle('fs:saveFileDialog', async (_, content: string, defaultName?: string, options?: FsSaveFileDialogOptions) => {
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
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, filePath: result.filePath };
      } catch (error) {
        console.error('Failed to save file:', error);
        return { success: false, error: (error as Error).message };
      }
    }
    return { success: false };
  });

  // Get file stats (for displaying file info)
  ipcMain.handle('fs:getFileStats', async (_, filePath: string) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        success: true,
        stats: {
          size: stats.size,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs,
        }
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Check if file exists
  ipcMain.handle('fs:fileExists', async (_, filePath: string) => {
    try {
      return { success: true, exists: fs.existsSync(filePath) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
