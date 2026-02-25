export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: number;
  status: number;
  due_date: number | null;
  estimated_hours: number | null;
  actual_hours: number;
  category: string | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
  is_deleted: number;
}

export interface CheckIn {
  id: number;
  date: number;
  start_time: number | null;
  end_time: number | null;
  duration: number;
  tasks_completed: number;
  notes_count: number;
  code_runs: number;
  created_at: number;
}

export interface CheckInStats {
  consecutiveDays: number;
  totalDays: number;
  totalDuration: number;
  totalTasks: number;
  thisMonthDays: number;
  thisMonthDuration: number;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error: string | null;
  executionTime: number;
  id?: number;
}

export interface RuntimeCheckResult {
  success: boolean;
  version?: string;
  raw?: string;
  path: string;
  error?: string;
}

export interface StudyProgress {
  id: number;
  skill_name: string;
  category: string | null;
  level: number;
  target_level: number;
  time_spent: number;
  notes_count: number;
  code_count: number;
  parent_skill_id: number | null;
  order_index: number;
  updated_at: number;
}

export interface StudyPlan {
  id: number;
  title: string;
  description: string | null;
  skill_id: number | null;
  skill_name: string | null;
  start_date: number;
  end_date: number;
  target_hours: number;
  completed_hours: number;
  status: number;
  priority: number;
  reminder: number;
  reminder_time: string | null;
  created_at: number;
  updated_at: number;
}

export interface Milestone {
  id: number;
  plan_id: number;
  title: string;
  description: string | null;
  target_date: number | null;
  completed: number;
  completed_at: number | null;
  sort_order: number;
  created_at: number;
}

export type SettingsMap = Record<string, string>;

export interface StudyPlanUpdatePayload {
  title?: string;
  description?: string | null;
  skill_id?: number | null;
  skill_name?: string | null;
  start_date?: number;
  end_date?: number;
  target_hours?: number;
  completed_hours?: number;
  status?: number;
  priority?: number;
}

export type PdfPageSize = 'A4' | 'Letter';
export type PdfTheme = 'typora' | 'github' | 'custom';

export interface PdfExportOptions {
  pageSize?: PdfPageSize;
  printBackground?: boolean;
  theme?: PdfTheme;
  customCss?: string;
}

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface FsOpenFileOptions {
  title?: string;
  filters?: FileDialogFilter[];
}

export interface FsSaveFileDialogOptions {
  title?: string;
  filters?: FileDialogFilter[];
}

export interface FsReadFolderOptions {
  extensions?: string[];
}

export interface FsFolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FsReadFolderResult {
  success: boolean;
  files?: FsFolderEntry[];
  folders?: FsFolderEntry[];
  folderPath?: string;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  path?: string;
  filePath?: string;
}

export interface FileStatsResult {
  success: boolean;
  stats?: {
    size: number;
    modified: number;
    created: number;
  };
  error?: string;
}

export interface FileExistsResult {
  success: boolean;
  exists?: boolean;
  error?: string;
}

export interface ImageSaveResult {
  success: boolean;
  path?: string;
  relativePath?: string;
  error?: string;
  canceled?: boolean;
}

export interface ImageReadResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface BackupCountMap {
  todos: number;
  checkIns: number;
  studyProgress: number;
  studyPlans: number;
  milestones: number;
  settings: number;
}

export interface BackupExportResult {
  success: boolean;
  path?: string;
  version?: string;
  counts?: BackupCountMap;
  error?: string;
}

export interface BackupImportStats {
  created: BackupCountMap;
  updated: BackupCountMap;
  skipped: BackupCountMap;
}

export interface BackupImportResult {
  success: boolean;
  message: string;
  stats?: BackupImportStats;
  warnings?: string[];
  error?: string;
}

export interface BackupPreviewSummary {
  version?: string;
  exportedAt?: string;
  counts: BackupCountMap;
}

export interface BackupPreviewResult {
  success: boolean;
  message: string;
  filePath?: string;
  summary?: BackupPreviewSummary;
  warnings?: string[];
  error?: string;
}

export interface ProgressCreatePayload {
  skill_name: string;
  category?: string;
  parent_skill_id?: number | null;
  order_index?: number;
  target_level?: number;
}

export interface ElectronAPI {
  todos: {
    getAll: () => Promise<Todo[]>;
    create: (todo: Partial<Todo>) => Promise<Todo>;
    update: (id: number, todo: Partial<Todo>) => Promise<{ success: boolean }>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };
  checkins: {
    getAll: (limit?: number) => Promise<CheckIn[]>;
    save: (date: number, data: Partial<CheckIn>) => Promise<CheckIn>;
    getByDate: (date: number) => Promise<CheckIn | null>;
    start: (date: number) => Promise<CheckIn>;
    end: (date: number, duration: number) => Promise<CheckIn>;
    stats: () => Promise<CheckInStats>;
  };
  code: {
    runJava: (code: string, javaPath?: string) => Promise<CodeExecutionResult>;
    runPython: (code: string, pythonPath?: string) => Promise<CodeExecutionResult>;
    checkJava: (javaPath?: string) => Promise<RuntimeCheckResult>;
    checkPython: (pythonPath?: string) => Promise<RuntimeCheckResult>;
  };
  progress: {
    getAll: () => Promise<StudyProgress[]>;
    update: (skillName: string, updates: Partial<StudyProgress>) => Promise<{ success: boolean }>;
    create: (payload: ProgressCreatePayload) => Promise<StudyProgress>;
    updateById: (id: number, updates: Partial<StudyProgress>) => Promise<{ success: boolean }>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, category?: string) => Promise<{ success: boolean }>;
    getAll: () => Promise<SettingsMap>;
  };
  plans: {
    getAll: () => Promise<StudyPlan[]>;
    getById: (id: number) => Promise<StudyPlan | null>;
    create: (plan: Partial<StudyPlan>) => Promise<StudyPlan>;
    update: (id: number, updates: StudyPlanUpdatePayload) => Promise<{ success: boolean; plan?: StudyPlan; error?: string }>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };
  milestones: {
    getByPlanId: (planId: number) => Promise<Milestone[]>;
    create: (milestone: Partial<Milestone>) => Promise<Milestone>;
    update: (id: number, updates: Partial<Milestone>) => Promise<{ success: boolean }>;
    delete: (id: number) => Promise<{ success: boolean }>;
  };
  export: {
    backup: () => Promise<BackupExportResult>;
    previewBackup: () => Promise<BackupPreviewResult>;
    importBackup: (filePath?: string) => Promise<BackupImportResult>;
    toPDF: (content: string, title: string) => Promise<SaveResult>;
    toPDFAdvanced: (content: string, title: string, options?: PdfExportOptions) => Promise<SaveResult>;
  };
  fs: {
    openFolder: () => Promise<{ success: boolean; folderPath?: string }>;
    openFile: (options?: FsOpenFileOptions) => Promise<{ success: boolean; filePath?: string }>;
    saveFileDialog: (content: string, defaultName?: string, options?: FsSaveFileDialogOptions) => Promise<SaveResult>;
    readFolder: (folderPath: string, options?: FsReadFolderOptions) => Promise<FsReadFolderResult>;
    readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (filePath: string, content: string) => Promise<SaveResult>;
    createFile: (folderPath: string, fileName: string) => Promise<SaveResult>;
    deleteFile: (filePath: string) => Promise<SaveResult>;
    renameFile: (oldPath: string, newPath: string) => Promise<SaveResult>;
    watchFolder: (folderPath: string, options?: FsReadFolderOptions) => Promise<SaveResult>;
    unwatchFolder: (folderPath: string) => Promise<SaveResult>;
    onFolderChange: (callback: (event: unknown, data: { eventType: string; filename: string; folderPath: string }) => void) => void;
    removeFolderChangeListener: () => void;
    reveal: (filePath: string) => Promise<{ success: boolean }>;
    getFileStats: (filePath: string) => Promise<FileStatsResult>;
    fileExists: (filePath: string) => Promise<FileExistsResult>;
  };
  image: {
    save: (imageData: string, targetDir?: string, options?: { fileName?: string }) => Promise<ImageSaveResult>;
    select: () => Promise<ImageSaveResult>;
    read: (relativePath: string) => Promise<ImageReadResult>;
  };
}
