import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI as ElectronApiContract,
  FsOpenFileOptions,
  FsReadFolderOptions,
  FsSaveFileDialogOptions,
  Milestone,
  StudyPlan,
  StudyPlanUpdatePayload,
  StudyProgress,
  Todo,
} from '@shared/types/ipc';

const api: ElectronApiContract = {
  // Todos
  todos: {
    getAll: () => ipcRenderer.invoke('todos:getAll'),
    create: (todo: Partial<Todo>) => ipcRenderer.invoke('todos:create', todo),
    update: (id: number, todo: Partial<Todo>) => ipcRenderer.invoke('todos:update', id, todo),
    delete: (id: number) => ipcRenderer.invoke('todos:delete', id),
  },

  // Check-ins
  checkins: {
    getAll: (limit?: number) => ipcRenderer.invoke('checkins:getAll', limit),
    save: (date: number, data) => ipcRenderer.invoke('checkins:save', date, data),
    getByDate: (date: number) => ipcRenderer.invoke('checkins:getByDate', date),
    start: (date: number) => ipcRenderer.invoke('checkins:start', date),
    end: (date: number, duration: number) => ipcRenderer.invoke('checkins:end', date, duration),
    stats: () => ipcRenderer.invoke('checkins:stats'),
  },

  // Code Execution
  code: {
    runJava: (code: string, javaPath?: string) => ipcRenderer.invoke('code:runJava', code, javaPath),
    runPython: (code: string, pythonPath?: string) => ipcRenderer.invoke('code:runPython', code, pythonPath),
    checkJava: (javaPath?: string) => ipcRenderer.invoke('code:checkJava', javaPath),
    checkPython: (pythonPath?: string) => ipcRenderer.invoke('code:checkPython', pythonPath),
  },

  // Progress
  progress: {
    getAll: () => ipcRenderer.invoke('progress:getAll'),
    update: (skillName: string, updates: Partial<StudyProgress>) => ipcRenderer.invoke('progress:update', skillName, updates),
    create: (payload: { skill_name: string; category?: string; parent_skill_id?: number | null; order_index?: number; target_level?: number }) =>
      ipcRenderer.invoke('progress:create', payload),
    updateById: (id: number, updates: Partial<StudyProgress>) =>
      ipcRenderer.invoke('progress:updateById', id, updates),
    delete: (id: number) =>
      ipcRenderer.invoke('progress:delete', id),
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string, category?: string) => ipcRenderer.invoke('settings:set', key, value, category),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // Study Plans
  plans: {
    getAll: () => ipcRenderer.invoke('plans:getAll'),
    getById: (id: number) => ipcRenderer.invoke('plans:getById', id),
    create: (plan: Partial<StudyPlan>) => ipcRenderer.invoke('plans:create', plan),
    update: (id: number, updates: StudyPlanUpdatePayload) => ipcRenderer.invoke('plans:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('plans:delete', id),
  },

  // Milestones
  milestones: {
    getByPlanId: (planId: number) => ipcRenderer.invoke('milestones:getByPlanId', planId),
    create: (milestone: Partial<Milestone>) => ipcRenderer.invoke('milestones:create', milestone),
    update: (id: number, updates: Partial<Milestone>) => ipcRenderer.invoke('milestones:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('milestones:delete', id),
  },

  // Export
  export: {
    backup: () => ipcRenderer.invoke('export:backup'),
    previewBackup: () => ipcRenderer.invoke('export:previewBackup'),
    importBackup: (filePath?: string) => ipcRenderer.invoke('import:backup', filePath),
    toPDF: (content: string, title: string) => ipcRenderer.invoke('export:pdf', content, title),
    toPDFAdvanced: (
      content: string,
      title: string,
      options?: {
        pageSize?: 'A4' | 'Letter';
        printBackground?: boolean;
        theme?: 'typora' | 'github' | 'custom';
        customCss?: string;
      }
    ) =>
      ipcRenderer.invoke('export:pdfAdvanced', content, title, options),
  },

  // File system - open folder like Typora
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    openFile: (options?: FsOpenFileOptions) =>
      ipcRenderer.invoke('fs:openFile', options),
    saveFileDialog: (
      content: string,
      defaultName?: string,
      options?: FsSaveFileDialogOptions
    ) => ipcRenderer.invoke('fs:saveFileDialog', content, defaultName, options),
    readFolder: (folderPath: string, options?: FsReadFolderOptions) => ipcRenderer.invoke('fs:readFolder', folderPath, options),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createFile: (folderPath: string, fileName: string) => ipcRenderer.invoke('fs:createFile', folderPath, fileName),
    deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath),
    renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
    watchFolder: (folderPath: string, options?: FsReadFolderOptions) =>
      ipcRenderer.invoke('fs:watchFolder', folderPath, options),
    unwatchFolder: (folderPath: string) => ipcRenderer.invoke('fs:unwatchFolder', folderPath),
    onFolderChange: (callback: (event: unknown, data: { eventType: string; filename: string; folderPath: string }) => void) =>
      ipcRenderer.on('fs:folderChange', callback),
    removeFolderChangeListener: () => ipcRenderer.removeAllListeners('fs:folderChange'),
    reveal: (filePath: string) => ipcRenderer.invoke('fs:reveal', filePath),
    getFileStats: (filePath: string) => ipcRenderer.invoke('fs:getFileStats', filePath),
    fileExists: (filePath: string) => ipcRenderer.invoke('fs:fileExists', filePath),
  },

  // Image
  image: {
    save: (imageData: string, targetDir?: string, options?: { fileName?: string }) =>
      ipcRenderer.invoke('image:save', imageData, targetDir, options),
    select: () => ipcRenderer.invoke('image:select'),
    read: (relativePath: string) => ipcRenderer.invoke('image:read', relativePath),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
