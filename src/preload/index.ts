import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Todos
  todos: {
    getAll: () => ipcRenderer.invoke('todos:getAll'),
    create: (todo: any) => ipcRenderer.invoke('todos:create', todo),
    update: (id: number, todo: any) => ipcRenderer.invoke('todos:update', id, todo),
    delete: (id: number) => ipcRenderer.invoke('todos:delete', id),
  },

  // Check-ins
  checkins: {
    getAll: (limit?: number) => ipcRenderer.invoke('checkins:getAll', limit),
    save: (date: number, data: any) => ipcRenderer.invoke('checkins:save', date, data),
    getByDate: (date: number) => ipcRenderer.invoke('checkins:getByDate', date),
    start: (date: number) => ipcRenderer.invoke('checkins:start', date),
    end: (date: number, duration: number) => ipcRenderer.invoke('checkins:end', date, duration),
    stats: () => ipcRenderer.invoke('checkins:stats'),
  },

  // Pomodoro
  pomodoro: {
    getAll: (limit?: number) => ipcRenderer.invoke('pomodoro:getAll', limit),
    save: (session: any) => ipcRenderer.invoke('pomodoro:save', session),
    update: (id: number, updates: any) => ipcRenderer.invoke('pomodoro:update', id, updates),
    getStats: (date: number) => ipcRenderer.invoke('pomodoro:getStats', date),
    getTodayStats: () => ipcRenderer.invoke('pomodoro:getTodayStats'),
  },

  // Code Snippets
  snippets: {
    getAll: () => ipcRenderer.invoke('snippets:getAll'),
    create: (snippet: any) => ipcRenderer.invoke('snippets:create', snippet),
    update: (id: number, snippet: any) => ipcRenderer.invoke('snippets:update', id, snippet),
    delete: (id: number) => ipcRenderer.invoke('snippets:delete', id),
    incrementUsage: (id: number) => ipcRenderer.invoke('snippets:incrementUsage', id),
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
    update: (skillName: string, updates: any) => ipcRenderer.invoke('progress:update', skillName, updates),
    create: (payload: { skill_name: string; category?: string; parent_skill_id?: number | null; order_index?: number; target_level?: number }) =>
      ipcRenderer.invoke('progress:create', payload),
    updateById: (id: number, updates: any) =>
      ipcRenderer.invoke('progress:updateById', id, updates),
    delete: (id: number) =>
      ipcRenderer.invoke('progress:delete', id),
  },

  // Achievements
  achievements: {
    getAll: () => ipcRenderer.invoke('achievements:getAll'),
    getUnlocked: () => ipcRenderer.invoke('achievements:getUnlocked'),
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
    create: (plan: any) => ipcRenderer.invoke('plans:create', plan),
    update: (id: number, updates: any) => ipcRenderer.invoke('plans:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('plans:delete', id),
  },

  // Milestones
  milestones: {
    getByPlanId: (planId: number) => ipcRenderer.invoke('milestones:getByPlanId', planId),
    create: (milestone: any) => ipcRenderer.invoke('milestones:create', milestone),
    update: (id: number, updates: any) => ipcRenderer.invoke('milestones:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('milestones:delete', id),
  },

  // Export
  export: {
    backup: () => ipcRenderer.invoke('export:backup'),
    importBackup: () => ipcRenderer.invoke('import:backup'),
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

  // File save dialog
  file: {
    save: (content: string, defaultPath?: string, filters?: any[]) => ipcRenderer.invoke('file:save', content, defaultPath, filters),
  },

  // File system - open folder like Typora
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    openFile: (options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke('fs:openFile', options),
    saveFileDialog: (
      content: string,
      defaultName?: string,
      options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }
    ) => ipcRenderer.invoke('fs:saveFileDialog', content, defaultName, options),
    readFolder: (folderPath: string, options?: { extensions?: string[] }) => ipcRenderer.invoke('fs:readFolder', folderPath, options),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    createFile: (folderPath: string, fileName: string) => ipcRenderer.invoke('fs:createFile', folderPath, fileName),
    deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath),
    renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
    watchFolder: (folderPath: string, options?: { extensions?: string[] }) =>
      ipcRenderer.invoke('fs:watchFolder', folderPath, options),
    unwatchFolder: (folderPath: string) => ipcRenderer.invoke('fs:unwatchFolder', folderPath),
    onFolderChange: (callback: (event: any, data: any) => void) => ipcRenderer.on('fs:folderChange', callback),
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
