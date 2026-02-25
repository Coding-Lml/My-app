export {};

declare global {
  interface Window {
    electronAPI: {
      todos: {
        getAll: () => Promise<any[]>;
        create: (todo: any) => Promise<any>;
        update: (id: number, todo: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      checkins: {
        getAll: (limit?: number) => Promise<any[]>;
        save: (date: number, data: any) => Promise<any>;
        getByDate: (date: number) => Promise<any>;
        start: (date: number) => Promise<any>;
        end: (date: number, duration: number) => Promise<any>;
        stats: () => Promise<any>;
      };
      pomodoro: {
        getAll: (limit?: number) => Promise<any[]>;
        save: (session: any) => Promise<any>;
        update: (id: number, updates: any) => Promise<{ success: boolean }>;
        getStats: (date: number) => Promise<any>;
        getTodayStats: () => Promise<any>;
      };
      snippets: {
        getAll: () => Promise<any[]>;
        create: (snippet: any) => Promise<any>;
        update: (id: number, snippet: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        incrementUsage: (id: number) => Promise<{ success: boolean }>;
      };
      code: {
        runJava: (code: string, javaPath?: string) => Promise<any>;
        runPython: (code: string, pythonPath?: string) => Promise<any>;
        checkJava: (javaPath?: string) => Promise<any>;
        checkPython: (pythonPath?: string) => Promise<any>;
      };
      progress: {
        getAll: () => Promise<any[]>;
        update: (skillName: string, updates: any) => Promise<{ success: boolean }>;
        create: (payload: { skill_name: string; category?: string; parent_skill_id?: number | null; order_index?: number; target_level?: number }) => Promise<any>;
        updateById: (id: number, updates: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      achievements: {
        getAll: () => Promise<any[]>;
        getUnlocked: () => Promise<any[]>;
      };
      settings: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string, category?: string) => Promise<{ success: boolean }>;
        getAll: () => Promise<Record<string, string>>;
      };
      plans: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        create: (plan: any) => Promise<any>;
        update: (id: number, updates: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      milestones: {
        getByPlanId: (planId: number) => Promise<any[]>;
        create: (milestone: any) => Promise<any>;
        update: (id: number, updates: any) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      export: {
        backup: () => Promise<any>;
        importBackup: () => Promise<any>;
        toPDF: (content: string, title: string) => Promise<any>;
        toPDFAdvanced: (
          content: string,
          title: string,
          options?: {
            pageSize?: 'A4' | 'Letter';
            printBackground?: boolean;
            theme?: 'typora' | 'github' | 'custom';
            customCss?: string;
          }
        ) => Promise<any>;
      };
      file: {
        save: (content: string, defaultPath?: string, filters?: any[]) => Promise<{ success: boolean; path?: string }>;
      };
      fs: {
        openFolder: () => Promise<{ success: boolean; folderPath?: string }>;
        openFile: (options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ success: boolean; filePath?: string }>;
        saveFileDialog: (
          content: string,
          defaultName?: string,
          options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }
        ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        readFolder: (folderPath: string, options?: { extensions?: string[] }) => Promise<{ success: boolean; files?: any[]; folders?: any[]; folderPath?: string; error?: string }>;
        readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
        createFile: (folderPath: string, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
        renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
        watchFolder: (folderPath: string, options?: { extensions?: string[] }) => Promise<{ success: boolean; error?: string }>;
        unwatchFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
        onFolderChange: (callback: (event: any, data: any) => void) => void;
        removeFolderChangeListener: () => void;
        reveal: (filePath: string) => Promise<{ success: boolean }>;
        getFileStats: (filePath: string) => Promise<{ success: boolean; stats?: { size: number; modified: number; created: number }; error?: string }>;
        fileExists: (filePath: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;
      };
      image: {
        save: (
          imageData: string,
          targetDir?: string,
          options?: { fileName?: string }
        ) => Promise<{ success: boolean; relativePath?: string; error?: string }>;
        select: () => Promise<{ success: boolean; relativePath?: string; error?: string }>;
        read: (relativePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      };
    };
  }
}
