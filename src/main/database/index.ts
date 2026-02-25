import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import type { StudyPlanUpdatePayload } from '@shared/types/ipc';
import { resolveStudyPlanDateRange, validateTargetHours } from '@shared/utils/studyPlan';

const DB_VERSION = 3;

// @ts-ignore
const SQL = require('sql.js');

type SQLDatabase = typeof SQL.Database;

interface Todo {
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

interface CheckIn {
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

interface CodeSnippet {
  id: number;
  title: string;
  content: string;
  language: string;
  description: string | null;
  category: string | null;
  is_favorite: number;
  usage_count: number;
  created_at: number;
  updated_at: number;
  is_deleted: number;
}

interface CodeExecution {
  id: number;
  snippet_id: number | null;
  code: string;
  language: string;
  output: string | null;
  error: string | null;
  execution_time: number | null;
  status: string;
  created_at: number;
}

interface StudyProgress {
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

interface Setting {
  id: number;
  key: string;
  value: string;
  category: string | null;
  updated_at: number;
}

export class Database {
  private db: SQLDatabase | null = null;
  private dbPath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private isPersisting = false;
  private pendingPersist = false;
  private readonly saveDebounceMs = 300;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'learning-app.db');
  }

  async initialize(): Promise<void> {
    let dbData: Uint8Array | null = null;

    if (fs.existsSync(this.dbPath)) {
      dbData = fs.readFileSync(this.dbPath);
    }

    let wasmPath: string | undefined;
    if (process.env.NODE_ENV !== 'development') {
      const resourcesPath = process.resourcesPath;
      wasmPath = path.join(resourcesPath, 'sql-wasm.wasm');
    }

    // @ts-ignore
    const SQL = await require('sql.js')({
      locateFile: (file: string) => {
        if (wasmPath && file.endsWith('.wasm')) {
          return wasmPath;
        }
        return file;
      }
    });

    if (dbData) {
      this.db = new SQL.Database(dbData);
      this.checkAndMigrate();
    } else {
      this.db = new SQL.Database();
      this.createTables();
      this.insertDefaultData();
    }
  }

  private checkAndMigrate(): void {
    if (!this.db) return;

    let currentVersion = 0;
    try {
      const result = this.db.exec('SELECT value FROM settings WHERE key = "db_version"');
      currentVersion = result.length > 0 && result[0].values.length > 0
        ? Number(result[0].values[0][0])
        : 0;
    } catch {
      this.createTables();
      currentVersion = 0;
    }

    if (currentVersion < DB_VERSION) {
      this.runMigration(currentVersion);
      this.updateDBVersion();
      this.save();
    }
  }

  private runMigration(fromVersion: number): void {
    if (!this.db) return;

    // Add future migrations here
    if (fromVersion === 0) {
      this.createTables();
      this.insertDefaultData();
    }

    if (fromVersion < 3) {
      this.db.run('DROP TABLE IF EXISTS diary_history');
      this.db.run('DROP TABLE IF EXISTS diary_logs');
    }
  }

  private updateDBVersion(): void {
    if (!this.db) return;
    const now = Date.now();
    this.db.run(`INSERT OR REPLACE INTO settings (key, value, category, updated_at) VALUES ('db_version', '${DB_VERSION}', 'system', ${now})`);
  }

  private createTables(): void {
    if (!this.db) return;

    // Settings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        category TEXT,
        updated_at INTEGER NOT NULL
      )
    `);

    // Todos table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        priority INTEGER DEFAULT 2,
        status INTEGER DEFAULT 0,
        due_date INTEGER,
        estimated_hours REAL,
        actual_hours REAL DEFAULT 0,
        category TEXT,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER DEFAULT 0
      )
    `);

    // Check-ins table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date INTEGER NOT NULL UNIQUE,
        start_time INTEGER,
        end_time INTEGER,
        duration INTEGER DEFAULT 0,
        tasks_completed INTEGER DEFAULT 0,
        notes_count INTEGER DEFAULT 0,
        code_runs INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Code snippets table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        language TEXT NOT NULL,
        description TEXT,
        category TEXT,
        is_favorite INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER DEFAULT 0
      )
    `);

    // Code executions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snippet_id INTEGER REFERENCES code_snippets(id),
        code TEXT NOT NULL,
        language TEXT NOT NULL,
        output TEXT,
        error TEXT,
        execution_time INTEGER,
        status TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Study progress table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS study_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_name TEXT NOT NULL UNIQUE,
        category TEXT,
        level INTEGER DEFAULT 0,
        target_level INTEGER DEFAULT 100,
        time_spent INTEGER DEFAULT 0,
        notes_count INTEGER DEFAULT 0,
        code_count INTEGER DEFAULT 0,
        parent_skill_id INTEGER REFERENCES study_progress(id),
        order_index INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `);

    // Achievements table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        condition_type TEXT,
        condition_value INTEGER,
        unlocked INTEGER DEFAULT 0,
        unlocked_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    // User achievements table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        achievement_id INTEGER NOT NULL REFERENCES achievements(id),
        unlocked_at INTEGER NOT NULL,
        UNIQUE(achievement_id)
      )
    `);

    // Pomodoro sessions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration INTEGER NOT NULL,
        type TEXT DEFAULT 'work',
        task_id INTEGER REFERENCES todos(id),
        task_title TEXT,
        completed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Study plans table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS study_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        skill_id INTEGER REFERENCES study_progress(id),
        skill_name TEXT,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        target_hours REAL DEFAULT 0,
        completed_hours REAL DEFAULT 0,
        status INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 2,
        reminder INTEGER DEFAULT 0,
        reminder_time TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Plan milestones table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS plan_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES study_plans(id),
        title TEXT NOT NULL,
        description TEXT,
        target_date INTEGER,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
  }

  private insertDefaultData(): void {
    const db = this.db;
    if (!db) return;

    const now = Date.now();

    // Default skills - Java Backend Engineer Skill Tree
    const parentSkills = [
      { name: 'Java语法基础', category: 'Java', order: 1 },
      { name: 'Spring框架', category: 'Java', order: 10 },
      { name: 'MySQL', category: '数据库', order: 20 },
      { name: 'Redis', category: '数据库', order: 24 },
      { name: '数据结构', category: '算法', order: 30 },
      { name: '排序算法', category: '算法', order: 34 },
      { name: '查找算法', category: '算法', order: 35 },
      { name: '动态规划', category: '算法', order: 36 },
      { name: '计算机网络', category: '基础', order: 40 },
      { name: '操作系统', category: '基础', order: 41 },
      { name: '设计模式', category: '基础', order: 42 },
    ];

    parentSkills.forEach(skill => {
      db.run(`INSERT INTO study_progress (skill_name, category, order_index, updated_at) VALUES ('${skill.name}', '${skill.category}', ${skill.order}, ${now})`);
    });

    const childSkills = [
      { name: '面向对象编程', category: 'Java', order: 2, parent: 'Java语法基础' },
      { name: '集合框架', category: 'Java', order: 3, parent: 'Java语法基础' },
      { name: '异常处理', category: 'Java', order: 4, parent: 'Java语法基础' },
      { name: 'IO/NIO', category: 'Java', order: 5, parent: 'Java语法基础' },
      { name: '多线程与并发', category: 'Java', order: 6, parent: 'Java语法基础' },
      { name: 'JVM原理', category: 'Java', order: 7, parent: 'Java语法基础' },
      { name: 'Spring Boot', category: 'Java', order: 11, parent: 'Spring框架' },
      { name: 'Spring MVC', category: 'Java', order: 12, parent: 'Spring框架' },
      { name: 'Spring Security', category: 'Java', order: 13, parent: 'Spring框架' },
      { name: 'MyBatis', category: 'Java', order: 14, parent: 'Spring框架' },
      { name: 'SQL语法', category: '数据库', order: 21, parent: 'MySQL' },
      { name: '索引优化', category: '数据库', order: 22, parent: 'MySQL' },
      { name: '事务与锁', category: '数据库', order: 23, parent: 'MySQL' },
      { name: 'Redis数据结构', category: '数据库', order: 25, parent: 'Redis' },
      { name: 'Redis缓存策略', category: '数据库', order: 26, parent: 'Redis' },
      { name: '数组与链表', category: '算法', order: 31, parent: '数据结构' },
      { name: '栈与队列', category: '算法', order: 32, parent: '数据结构' },
      { name: '树与图', category: '算法', order: 33, parent: '数据结构' },
    ];

    childSkills.forEach(skill => {
      db.run(`INSERT INTO study_progress (skill_name, category, order_index, parent_skill_id, updated_at) VALUES ('${skill.name}', '${skill.category}', ${skill.order}, (SELECT id FROM study_progress WHERE skill_name = '${skill.parent}'), ${now})`);
    });

    // Default achievements
    const achievements = [
      { name: '初学者', description: '完成第一篇学习笔记', icon: '📝', condition: 'notes_count', value: 1 },
      { name: '坚持学习', description: '连续打卡7天', icon: '🔥', condition: 'consecutive_days', value: 7 },
      { name: '代码达人', description: '代码执行次数达到100次', icon: '💻', condition: 'code_runs', value: 100 },
      { name: '学霸', description: '学习时长达到100小时', icon: '📚', condition: 'study_hours', value: 6000 },
      { name: '任务大师', description: '完成100个待办任务', icon: '✅', condition: 'todos_completed', value: 100 },
    ];

    achievements.forEach(ach => {
      db.run(`INSERT INTO achievements (name, description, icon, condition_type, condition_value, created_at) VALUES ('${ach.name}', '${ach.description}', '${ach.icon}', '${ach.condition}', ${ach.value}, ${now})`);
    });

    // Default settings
    const settings = [
      { key: 'theme', value: 'light', category: 'appearance' },
      { key: 'fontSize', value: '14', category: 'editor' },
      { key: 'javaPath', value: '', category: 'code' },
      { key: 'pythonPath', value: '', category: 'code' },
      { key: 'autoSave', value: 'true', category: 'editor' },
      { key: 'dailyGoal', value: '120', category: 'study' },
      { key: 'db_version', value: String(DB_VERSION), category: 'system' },
    ];

    settings.forEach(setting => {
      db.run(`INSERT OR REPLACE INTO settings (key, value, category, updated_at) VALUES ('${setting.key}', '${setting.value}', '${setting.category}', ${now})`);
    });

    this.save();
  }

  private save(): void {
    if (!this.db) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persistAsync();
    }, this.saveDebounceMs);
  }

  private async persistAsync(): Promise<void> {
    if (!this.db) return;

    if (this.isPersisting) {
      this.pendingPersist = true;
      return;
    }

    this.isPersisting = true;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      await fs.promises.writeFile(this.dbPath, buffer);
    } catch (error) {
      console.error('Failed to persist database:', error);
    } finally {
      this.isPersisting = false;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        void this.persistAsync();
      }
    }
  }

  private flushSaveSync(): void {
    if (!this.db) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  private escape(value: any): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
    }
    return String(value);
  }

  // Todo CRUD operations
  getTodos(): Todo[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM todos WHERE is_deleted = 0 ORDER BY priority ASC, created_at DESC');
    return this.parseResults<Todo>(result);
  }

  createTodo(todo: Partial<Todo>): Todo {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT INTO todos (title, description, priority, status, category, due_date, estimated_hours, created_at, updated_at)
      VALUES (${this.escape(todo.title || 'Untitled')}, ${todo.description ? this.escape(todo.description) : 'NULL'}, ${todo.priority || 2}, ${todo.status || 0}, ${todo.category ? this.escape(todo.category) : 'NULL'}, ${todo.due_date || 'NULL'}, ${todo.estimated_hours || 'NULL'}, ${now}, ${now})
    `);

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    this.save();

    const result2 = this.db.exec(`SELECT * FROM todos WHERE id = ${id}`);
    return this.parseRow<Todo>(result2[0], 0);
  }

  updateTodo(id: number, todo: Partial<Todo>): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    const updates: string[] = [];

    if (todo.title !== undefined) {
      updates.push(`title = ${this.escape(todo.title)}`);
    }
    if (todo.description !== undefined) {
      updates.push(`description = ${todo.description ? this.escape(todo.description) : 'NULL'}`);
    }
    if (todo.priority !== undefined) {
      updates.push(`priority = ${todo.priority}`);
    }
    if (todo.status !== undefined) {
      updates.push(`status = ${todo.status}`);
      if (todo.status === 2) {
        updates.push(`completed_at = ${now}`);
      }
    }
    if (todo.category !== undefined) {
      updates.push(`category = ${todo.category ? this.escape(todo.category) : 'NULL'}`);
    }
    if (todo.due_date !== undefined) {
      updates.push(`due_date = ${todo.due_date || 'NULL'}`);
    }
    if (todo.actual_hours !== undefined) {
      updates.push(`actual_hours = ${todo.actual_hours}`);
    }

    updates.push(`updated_at = ${now}`);

    this.db.run(`UPDATE todos SET ${updates.join(', ')} WHERE id = ${id}`);
    this.save();
  }

  deleteTodo(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`UPDATE todos SET is_deleted = 1 WHERE id = ${id}`);
    this.save();
  }

  // Code snippet operations
  getCodeSnippets(): CodeSnippet[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM code_snippets WHERE is_deleted = 0 ORDER BY updated_at DESC');
    return this.parseResults<CodeSnippet>(result);
  }

  createCodeSnippet(snippet: Partial<CodeSnippet>): CodeSnippet {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT INTO code_snippets (title, content, language, description, category, created_at, updated_at)
      VALUES (${this.escape(snippet.title || 'Untitled')}, ${this.escape(snippet.content || '')}, ${this.escape(snippet.language || 'java')}, ${snippet.description ? this.escape(snippet.description) : 'NULL'}, ${snippet.category ? this.escape(snippet.category) : 'NULL'}, ${now}, ${now})
    `);

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    this.save();

    const result2 = this.db.exec(`SELECT * FROM code_snippets WHERE id = ${id}`);
    return this.parseRow<CodeSnippet>(result2[0], 0);
  }

  updateCodeSnippet(id: number, snippet: Partial<CodeSnippet>): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    const updates: string[] = [];

    if (snippet.title !== undefined) {
      updates.push(`title = ${this.escape(snippet.title)}`);
    }
    if (snippet.content !== undefined) {
      updates.push(`content = ${this.escape(snippet.content)}`);
    }
    if (snippet.description !== undefined) {
      updates.push(`description = ${snippet.description ? this.escape(snippet.description) : 'NULL'}`);
    }
    if (snippet.category !== undefined) {
      updates.push(`category = ${snippet.category ? this.escape(snippet.category) : 'NULL'}`);
    }
    if (snippet.is_favorite !== undefined) {
      updates.push(`is_favorite = ${snippet.is_favorite}`);
    }
    if (snippet.usage_count !== undefined) {
      updates.push(`usage_count = ${snippet.usage_count}`);
    }

    updates.push(`updated_at = ${now}`);

    this.db.run(`UPDATE code_snippets SET ${updates.join(', ')} WHERE id = ${id}`);
    this.save();
  }

  deleteCodeSnippet(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`UPDATE code_snippets SET is_deleted = 1 WHERE id = ${id}`);
    this.save();
  }

  incrementSnippetUsage(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`UPDATE code_snippets SET usage_count = usage_count + 1 WHERE id = ${id}`);
    this.save();
  }

  // Code execution operations
  createCodeExecution(execution: Partial<CodeExecution>): CodeExecution {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    (this.db as any).run(
      'INSERT INTO code_executions (snippet_id, code, language, output, error, execution_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        execution.snippet_id ?? null,
        execution.code || '',
        execution.language || 'java',
        execution.output ?? null,
        execution.error ?? null,
        execution.execution_time ?? null,
        execution.status || 'pending',
        now
      ]
    );

    this.save();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    if (!result || result.length === 0 || result[0].values.length === 0) {
      // Fallback if driver did not return id for any reason
      return {
        id: -1,
        snippet_id: execution.snippet_id ?? null,
        code: execution.code || '',
        language: execution.language || 'java',
        output: execution.output || null,
        error: execution.error || null,
        execution_time: execution.execution_time || null,
        status: execution.status || 'pending',
        created_at: now,
      } as CodeExecution;
    }
    const id = result[0].values[0][0] as number;
    const result2 = this.db.exec(`SELECT * FROM code_executions WHERE id = ${id}`);
    if (!result2 || result2.length === 0 || result2[0].values.length === 0) {
      return {
        id,
        snippet_id: execution.snippet_id ?? null,
        code: execution.code || '',
        language: execution.language || 'java',
        output: execution.output || null,
        error: execution.error || null,
        execution_time: execution.execution_time || null,
        status: execution.status || 'pending',
        created_at: now,
      } as CodeExecution;
    }
    return this.parseRow<CodeExecution>(result2[0], 0);
  }

  // Study progress operations
  getStudyProgress(): StudyProgress[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM study_progress ORDER BY order_index');
    return this.parseResults<StudyProgress>(result);
  }

  upsertStudyProgressByName(
    progress: Partial<StudyProgress> & { skill_name: string; parent_skill_name?: string | null }
  ): 'created' | 'updated' {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const existing = this.db.exec(
      `SELECT id FROM study_progress WHERE skill_name = ${this.escape(progress.skill_name)}`
    );
    const parentName = progress.parent_skill_name;
    let parentIdSql = 'NULL';

    if (parentName) {
      parentIdSql = `(SELECT id FROM study_progress WHERE skill_name = ${this.escape(parentName)} LIMIT 1)`;
    } else if (progress.parent_skill_id !== undefined && progress.parent_skill_id !== null) {
      parentIdSql = String(progress.parent_skill_id);
    }

    if (existing.length > 0 && existing[0].values.length > 0) {
      const id = Number(existing[0].values[0][0]);
      const setClauses: string[] = [
        `category = ${progress.category ? this.escape(progress.category) : 'NULL'}`,
        `level = ${progress.level ?? 0}`,
        `target_level = ${progress.target_level ?? 100}`,
        `time_spent = ${progress.time_spent ?? 0}`,
        `notes_count = ${progress.notes_count ?? 0}`,
        `code_count = ${progress.code_count ?? 0}`,
        `parent_skill_id = ${parentIdSql}`,
        `order_index = ${progress.order_index ?? 0}`,
        `updated_at = ${progress.updated_at ?? now}`,
      ];
      this.db.run(`UPDATE study_progress SET ${setClauses.join(', ')} WHERE id = ${id}`);
      this.save();
      return 'updated';
    }

    this.db.run(`
      INSERT INTO study_progress (skill_name, category, level, target_level, time_spent, notes_count, code_count, parent_skill_id, order_index, updated_at)
      VALUES (${this.escape(progress.skill_name)}, ${progress.category ? this.escape(progress.category) : 'NULL'}, ${progress.level ?? 0}, ${progress.target_level ?? 100}, ${progress.time_spent ?? 0}, ${progress.notes_count ?? 0}, ${progress.code_count ?? 0}, ${parentIdSql}, ${progress.order_index ?? 0}, ${progress.updated_at ?? now})
    `);
    this.save();
    return 'created';
  }

  updateStudyProgress(skillName: string, updates: Partial<StudyProgress>): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    const setClauses: string[] = [];

    if (updates.level !== undefined) {
      setClauses.push(`level = ${updates.level}`);
    }
    if (updates.time_spent !== undefined) {
      setClauses.push(`time_spent = ${updates.time_spent}`);
    }
    if (updates.notes_count !== undefined) {
      setClauses.push(`notes_count = ${updates.notes_count}`);
    }
    if (updates.code_count !== undefined) {
      setClauses.push(`code_count = ${updates.code_count}`);
    }

    setClauses.push(`updated_at = ${now}`);

    this.db.run(`UPDATE study_progress SET ${setClauses.join(', ')} WHERE skill_name = ${this.escape(skillName)}`);
    this.save();
  }

  // Skill CRUD for study_progress
  createStudySkill(payload: { skill_name: string; category?: string; parent_skill_id?: number | null; order_index?: number; target_level?: number }): any {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();
    const order = payload.order_index ?? 0;
    const target = payload.target_level ?? 100;
    this.db.run(`
      INSERT INTO study_progress (skill_name, category, level, target_level, time_spent, notes_count, code_count, parent_skill_id, order_index, updated_at)
      VALUES (${this.escape(payload.skill_name)}, ${payload.category ? this.escape(payload.category) : 'NULL'}, 0, ${target}, 0, 0, 0, ${payload.parent_skill_id ?? 'NULL'}, ${order}, ${now})
    `);
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    const row = this.db.exec(`SELECT * FROM study_progress WHERE id = ${id}`);
    return this.parseRow(row[0], 0);
  }

  updateStudySkill(id: number, updates: Partial<StudyProgress> & { skill_name?: string; category?: string; parent_skill_id?: number | null; order_index?: number; target_level?: number }): void {
    if (!this.db) throw new Error('Database not initialized');
    const setClauses: string[] = [];
    if (updates.skill_name !== undefined) setClauses.push(`skill_name = ${this.escape(updates.skill_name)}`);
    if (updates.category !== undefined) setClauses.push(`category = ${updates.category ? this.escape(updates.category) : 'NULL'}`);
    if (updates.level !== undefined) setClauses.push(`level = ${updates.level}`);
    if (updates.target_level !== undefined) setClauses.push(`target_level = ${updates.target_level}`);
    if (updates.time_spent !== undefined) setClauses.push(`time_spent = ${updates.time_spent}`);
    if (updates.notes_count !== undefined) setClauses.push(`notes_count = ${updates.notes_count}`);
    if (updates.code_count !== undefined) setClauses.push(`code_count = ${updates.code_count}`);
    if (updates.parent_skill_id !== undefined) setClauses.push(`parent_skill_id = ${updates.parent_skill_id ?? 'NULL'}`);
    if (updates.order_index !== undefined) setClauses.push(`order_index = ${updates.order_index}`);
    setClauses.push(`updated_at = ${Date.now()}`);
    if (setClauses.length > 0) {
      this.db.run(`UPDATE study_progress SET ${setClauses.join(', ')} WHERE id = ${id}`);
      this.save();
    }
  }

  deleteStudySkill(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`DELETE FROM study_progress WHERE id = ${id}`);
    // 清理将其作为父节点的引用
    this.db.run(`UPDATE study_progress SET parent_skill_id = NULL WHERE parent_skill_id = ${id}`);
    this.save();
  }

  // Check-in operations
  getCheckIns(limit: number = 30): CheckIn[] {
    if (!this.db) return [];
    const result = this.db.exec(`SELECT * FROM check_ins ORDER BY date DESC LIMIT ${limit}`);
    return this.parseResults<CheckIn>(result);
  }

  createOrUpdateCheckIn(date: number, data: Partial<CheckIn>): CheckIn {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    // Check if check-in exists
    const existing = this.db.exec(`SELECT * FROM check_ins WHERE date = ${date}`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      const updates: string[] = [];

      if (data.start_time !== undefined) {
        updates.push(`start_time = ${data.start_time}`);
      }
      if (data.end_time !== undefined) {
        updates.push(`end_time = ${data.end_time}`);
      }
      if (data.duration !== undefined) {
        updates.push(`duration = ${data.duration}`);
      }
      if (data.tasks_completed !== undefined) {
        updates.push(`tasks_completed = ${data.tasks_completed}`);
      }
      if (data.notes_count !== undefined) {
        updates.push(`notes_count = ${data.notes_count}`);
      }
      if (data.code_runs !== undefined) {
        updates.push(`code_runs = ${data.code_runs}`);
      }

      this.db.run(`UPDATE check_ins SET ${updates.join(', ')} WHERE date = ${date}`);
      this.save();

      const result2 = this.db.exec(`SELECT * FROM check_ins WHERE date = ${date}`);
      return this.parseRow<CheckIn>(result2[0], 0);
    } else {
      this.db.run(`
        INSERT INTO check_ins (date, start_time, end_time, duration, tasks_completed, notes_count, code_runs, created_at)
        VALUES (${date}, ${data.start_time || 'NULL'}, ${data.end_time || 'NULL'}, ${data.duration || 0}, ${data.tasks_completed || 0}, ${data.notes_count || 0}, ${data.code_runs || 0}, ${now})
      `);

      this.save();

      const result2 = this.db.exec(`SELECT * FROM check_ins WHERE date = ${date}`);
      return this.parseRow<CheckIn>(result2[0], 0);
    }
  }

  createOrUpdateCheckInFromBackup(checkIn: Partial<CheckIn> & { date: number }): 'created' | 'updated' {
    if (!this.db) throw new Error('Database not initialized');
    const existing = this.db.exec(`SELECT id FROM check_ins WHERE date = ${checkIn.date}`);
    const action: 'created' | 'updated' =
      existing.length > 0 && existing[0].values.length > 0 ? 'updated' : 'created';

    this.createOrUpdateCheckIn(checkIn.date, {
      start_time: checkIn.start_time ?? null,
      end_time: checkIn.end_time ?? null,
      duration: checkIn.duration ?? 0,
      tasks_completed: checkIn.tasks_completed ?? 0,
      notes_count: checkIn.notes_count ?? 0,
      code_runs: checkIn.code_runs ?? 0,
    });

    return action;
  }

  // Settings operations
  getSetting(key: string): string | null {
    if (!this.db) return null;
    const result = this.db.exec(`SELECT value FROM settings WHERE key = ${this.escape(key)}`);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0] as string;
  }

  setSetting(key: string, value: string, category?: string): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT OR REPLACE INTO settings (key, value, category, updated_at)
      VALUES (${this.escape(key)}, ${this.escape(value)}, ${this.escape(category || 'general')}, ${now})
    `);

    this.save();
  }

  getAllSettings(): Setting[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM settings ORDER BY key ASC');
    return this.parseResults<Setting>(result);
  }

  // Pomodoro operations
  getPomodoroSessions(limit: number = 100): any[] {
    if (!this.db) return [];
    const result = this.db.exec(`SELECT * FROM pomodoro_sessions ORDER BY start_time DESC LIMIT ${limit}`);
    return this.parseResults(result);
  }

  createPomodoroSession(session: any): any {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT INTO pomodoro_sessions (start_time, end_time, duration, type, task_id, task_title, completed, created_at)
      VALUES (${session.start_time || now}, ${session.end_time || 'NULL'}, ${session.duration || 25}, '${session.type || 'work'}', ${session.task_id || 'NULL'}, ${session.task_title ? this.escape(session.task_title) : 'NULL'}, ${session.completed || 0}, ${now})
    `);

    this.save();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    const result2 = this.db.exec(`SELECT * FROM pomodoro_sessions WHERE id = ${id}`);
    return this.parseRow(result2[0], 0);
  }

  updatePomodoroSession(id: number, updates: any): void {
    if (!this.db) throw new Error('Database not initialized');

    const setClauses: string[] = [];

    if (updates.end_time !== undefined) {
      setClauses.push(`end_time = ${updates.end_time}`);
    }
    if (updates.completed !== undefined) {
      setClauses.push(`completed = ${updates.completed}`);
    }

    if (setClauses.length > 0) {
      this.db.run(`UPDATE pomodoro_sessions SET ${setClauses.join(', ')} WHERE id = ${id}`);
      this.save();
    }
  }

  getPomodoroStatsByDate(date: number): any {
    if (!this.db) return { totalSessions: 0, totalDuration: 0, completedSessions: 0 };

    const dayStart = date;
    const dayEnd = date + 24 * 60 * 60 * 1000;

    const result = this.db.exec(`
      SELECT 
        COUNT(*) as totalSessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completedSessions,
        SUM(CASE WHEN completed = 1 THEN duration ELSE 0 END) as totalDuration
      FROM pomodoro_sessions
      WHERE start_time >= ${dayStart} AND start_time < ${dayEnd} AND type = 'work'
    `);

    if (result.length === 0 || result[0].values.length === 0) {
      return { totalSessions: 0, totalDuration: 0, completedSessions: 0 };
    }

    return {
      totalSessions: result[0].values[0][0] as number,
      completedSessions: result[0].values[0][1] as number,
      totalDuration: result[0].values[0][2] as number,
    };
  }

  // Study Plan operations
  getStudyPlans(): any[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM study_plans ORDER BY priority ASC, start_date ASC');
    return this.parseResults(result);
  }

  getStudyPlanById(id: number): any | null {
    if (!this.db) return null;
    const result = this.db.exec(`SELECT * FROM study_plans WHERE id = ${id}`);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.parseRow(result[0], 0);
  }

  createStudyPlan(plan: any): any {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT INTO study_plans (title, description, skill_id, skill_name, start_date, end_date, target_hours, completed_hours, status, priority, reminder, reminder_time, created_at, updated_at)
      VALUES (${this.escape(plan.title)}, ${plan.description ? this.escape(plan.description) : 'NULL'}, ${plan.skill_id || 'NULL'}, ${plan.skill_name ? this.escape(plan.skill_name) : 'NULL'}, ${plan.start_date}, ${plan.end_date}, ${plan.target_hours || 0}, ${plan.completed_hours || 0}, ${plan.status || 0}, ${plan.priority || 2}, ${plan.reminder || 0}, ${plan.reminder_time ? this.escape(plan.reminder_time) : 'NULL'}, ${now}, ${now})
    `);

    this.save();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    return this.getStudyPlanById(id);
  }

  updateStudyPlan(id: number, updates: StudyPlanUpdatePayload): void {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    const setClauses: string[] = [];

    if (updates.title !== undefined) setClauses.push(`title = ${this.escape(updates.title)}`);
    if (updates.description !== undefined) setClauses.push(`description = ${updates.description ? this.escape(updates.description) : 'NULL'}`);
    if (updates.skill_id !== undefined) setClauses.push(`skill_id = ${updates.skill_id ?? 'NULL'}`);
    if (updates.skill_name !== undefined) setClauses.push(`skill_name = ${updates.skill_name ? this.escape(updates.skill_name) : 'NULL'}`);
    if (updates.start_date !== undefined) setClauses.push(`start_date = ${updates.start_date}`);
    if (updates.end_date !== undefined) setClauses.push(`end_date = ${updates.end_date}`);
    if (updates.target_hours !== undefined) setClauses.push(`target_hours = ${updates.target_hours}`);
    if (updates.completed_hours !== undefined) setClauses.push(`completed_hours = ${updates.completed_hours}`);
    if (updates.status !== undefined) setClauses.push(`status = ${updates.status}`);
    if (updates.priority !== undefined) setClauses.push(`priority = ${updates.priority}`);

    if (updates.start_date !== undefined || updates.end_date !== undefined) {
      const current = this.getStudyPlanById(id);
      if (!current) {
        throw new Error('Study plan not found');
      }
      const range = resolveStudyPlanDateRange(current.start_date, current.end_date, updates);
      if (range.error) {
        throw new Error(range.error);
      }
    }

    const targetHoursError = validateTargetHours(updates.target_hours);
    if (targetHoursError) {
      throw new Error(targetHoursError);
    }

    setClauses.push(`updated_at = ${now}`);

    this.db.run(`UPDATE study_plans SET ${setClauses.join(', ')} WHERE id = ${id}`);
    this.save();
  }

  deleteStudyPlan(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`DELETE FROM plan_milestones WHERE plan_id = ${id}`);
    this.db.run(`DELETE FROM study_plans WHERE id = ${id}`);
    this.save();
  }

  // Milestone operations
  getMilestonesByPlanId(planId: number): any[] {
    if (!this.db) return [];
    const result = this.db.exec(`SELECT * FROM plan_milestones WHERE plan_id = ${planId} ORDER BY sort_order`);
    return this.parseResults(result);
  }

  createMilestone(milestone: any): any {
    if (!this.db) throw new Error('Database not initialized');
    const now = Date.now();

    this.db.run(`
      INSERT INTO plan_milestones (plan_id, title, description, target_date, completed, sort_order, created_at)
      VALUES (${milestone.plan_id}, ${this.escape(milestone.title)}, ${milestone.description ? this.escape(milestone.description) : 'NULL'}, ${milestone.target_date || 'NULL'}, ${milestone.completed || 0}, ${milestone.sort_order || 0}, ${now})
    `);

    this.save();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    const result2 = this.db.exec(`SELECT * FROM plan_milestones WHERE id = ${id}`);
    return this.parseRow(result2[0], 0);
  }

  updateMilestone(id: number, updates: any): void {
    if (!this.db) throw new Error('Database not initialized');

    const setClauses: string[] = [];

    if (updates.title !== undefined) setClauses.push(`title = ${this.escape(updates.title)}`);
    if (updates.completed !== undefined) {
      setClauses.push(`completed = ${updates.completed}`);
      if (updates.completed === 1) {
        setClauses.push(`completed_at = ${Date.now()}`);
      }
    }

    if (setClauses.length > 0) {
      this.db.run(`UPDATE plan_milestones SET ${setClauses.join(', ')} WHERE id = ${id}`);
      this.save();
    }
  }

  deleteMilestone(id: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(`DELETE FROM plan_milestones WHERE id = ${id}`);
    this.save();
  }

  close(): void {
    if (this.db) {
      this.flushSaveSync();
      this.db.close();
      this.db = null;
    }
  }

  private parseResults<T>(results: any[]): T[] {
    if (results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map((_row: any, idx: number) => this.parseRow<T>({ columns, values }, idx));
  }

  private parseRow<T>(result: any, rowIndex: number): T {
    const row: any = {};
    result.columns.forEach((col: string, i: number) => {
      row[col] = result.values[rowIndex][i];
    });
    return row as T;
  }
}
