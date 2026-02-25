import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { Database } from '../../database';
import type { BackupCountMap, PdfExportOptions } from '@shared/types/ipc';
import { allowPath, isPathAllowed } from '../../security/pathAccess';

type BackupPayload = {
  version: string;
  exportedAt: string;
  todos: unknown[];
  checkIns: unknown[];
  studyProgress: unknown[];
  studyPlans: unknown[];
  milestones: unknown[];
  settings: Array<{ key: string; value: string; category?: string | null; updated_at?: number }>;
};

const createEmptyCountMap = (): BackupCountMap => ({
  todos: 0,
  checkIns: 0,
  studyProgress: 0,
  studyPlans: 0,
  milestones: 0,
  settings: 0,
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toArrayCount(input: unknown): number {
  return Array.isArray(input) ? input.length : 0;
}

export function registerExportHandlers(db: Database) {
  const getPdfThemeStyle = (theme: PdfExportOptions['theme'], customCss?: string) => {
    if (theme === 'custom') {
      const css = (customCss || '').trim();
      if (css) {
        return css;
      }
    }

    if (theme === 'github') {
      return `
        .markdown-body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #24292f;
          background: #ffffff;
        }
        .markdown-body h1, .markdown-body h2 { border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
        .markdown-body code { background: rgba(175,184,193,0.2); padding: 0.2em 0.35em; border-radius: 4px; }
        .markdown-body pre { background: #f6f8fa; padding: 14px; border-radius: 6px; overflow: auto; }
        .markdown-body blockquote { border-left: 4px solid #d0d7de; margin: 0; padding: 0 1em; color: #57606a; }
      `;
    }

    return `
      .markdown-body {
        font-family: "Times New Roman", "Songti SC", "STSong", serif;
        color: #2a2a2a;
        background: #fffdfa;
      }
      .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .markdown-body h1::after, .markdown-body h2::after {
        content: '';
        display: block;
        border-bottom: 1px solid #e8e3d9;
        margin-top: 0.45em;
      }
      .markdown-body code { background: #f5efe3; padding: 0.18em 0.35em; border-radius: 4px; }
      .markdown-body pre { background: #f8f3e8; padding: 14px; border-radius: 6px; overflow: auto; }
      .markdown-body blockquote { border-left: 4px solid #cbb89b; margin: 0; padding: 0 1em; color: #6a6358; }
      .markdown-body table { border-collapse: collapse; width: 100%; }
      .markdown-body th, .markdown-body td { border: 1px solid #ddd5c5; padding: 6px 10px; }
      .markdown-body hr { border: none; border-top: 1px solid #ddd5c5; }
    `;
  };

  const exportMarkdownToPdf = async (
    content: string,
    title: string,
    options?: PdfExportOptions
  ) => {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导出 PDF',
      defaultPath: `${title}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }
    allowPath(result.filePath);

    const { marked } = await import('marked');

    const win = new BrowserWindow({ show: false, width: 900, height: 680 });
    const themeStyle = getPdfThemeStyle(options?.theme, options?.customCss);
    const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { margin: 0; background: white; }
        .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 36px 45px;
            line-height: 1.7;
            font-size: 14px;
        }
        .markdown-body pre { white-space: pre-wrap; word-break: break-word; }
        .markdown-body img { max-width: 100%; height: auto; }
        ${themeStyle}
        @media (max-width: 767px) {
            .markdown-body { padding: 15px; }
        }
      </style>
    </head>
    <body class="markdown-body">
      ${await marked(content)}
    </body>
    </html>
    `;

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const data = await win.webContents.printToPDF({
        printBackground: options?.printBackground ?? true,
        pageSize: options?.pageSize ?? 'A4',
      });
      await fs.promises.writeFile(result.filePath, data);
      win.close();
      return { success: true, path: result.filePath };
    } catch (error) {
      win.close();
      console.error('Failed to print PDF:', error);
      return { success: false, error: (error as Error).message };
    }
  };

  // Export backup (full database)
  ipcMain.handle('export:backup', async () => {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导出备份',
      defaultPath: `learning_app_backup_${new Date().toISOString().split('T')[0]}`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!result.filePath) {
      return { success: false };
    }
    allowPath(result.filePath);

    const studyPlans = db.getStudyPlans();
    const milestones = studyPlans.flatMap((plan: { id: number }) => db.getMilestonesByPlanId(plan.id));
    const settings = db.getAllSettings().map(setting => ({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      updated_at: setting.updated_at,
    }));

    const backup: BackupPayload = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      todos: db.getTodos(),
      checkIns: db.getCheckIns(3650),
      studyProgress: db.getStudyProgress(),
      studyPlans,
      milestones,
      settings,
    };

    await fs.promises.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf-8');
    return {
      success: true,
      path: result.filePath,
      version: backup.version,
      counts: {
        todos: backup.todos.length,
        checkIns: backup.checkIns.length,
        studyProgress: backup.studyProgress.length,
        studyPlans: backup.studyPlans.length,
        milestones: backup.milestones.length,
        settings: backup.settings.length,
      } satisfies BackupCountMap,
    };
  });

  // Preview backup summary before import
  ipcMain.handle('export:previewBackup', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '选择备份文件',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (!result.filePaths || result.filePaths.length === 0) {
      return { success: false, message: '已取消选择' };
    }

    const filePath = result.filePaths[0];
    allowPath(filePath);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const backup = JSON.parse(content) as Partial<BackupPayload>;
      const warnings: string[] = [];
      if (!backup.version) {
        warnings.push('缺少版本字段');
      }

      return {
        success: true,
        message: '备份解析成功',
        filePath,
        summary: {
          version: backup.version,
          exportedAt: backup.exportedAt,
          counts: {
            todos: toArrayCount(backup.todos),
            checkIns: toArrayCount(backup.checkIns),
            studyProgress: toArrayCount(backup.studyProgress),
            studyPlans: toArrayCount(backup.studyPlans),
            milestones: toArrayCount(backup.milestones),
            settings: toArrayCount(backup.settings),
          } satisfies BackupCountMap,
        },
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        message: '备份预览失败',
        error: (error as Error).message,
      };
    }
  });

  // Import backup
  ipcMain.handle('import:backup', async (_event, selectedFilePath?: string) => {
    let filePath = selectedFilePath;
    if (filePath && !isPathAllowed(filePath)) {
      return { success: false, message: `无权限访问备份文件: ${filePath}` };
    }
    if (!filePath) {
      const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        title: '导入备份',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (!result.filePaths || result.filePaths.length === 0) {
        return { success: false, message: '已取消导入' };
      }
      filePath = result.filePaths[0];
      allowPath(filePath);
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const backup = JSON.parse(content) as Partial<BackupPayload>;
      const stats = {
        created: createEmptyCountMap(),
        updated: createEmptyCountMap(),
        skipped: createEmptyCountMap(),
      };
      const warnings: string[] = [];

      if (Array.isArray(backup.todos)) {
        backup.todos.forEach((todo, index) => {
          if (!isObject(todo) || typeof todo.title !== 'string' || !todo.title.trim()) {
            stats.skipped.todos += 1;
            warnings.push(`todos[${index}] 缺少有效标题，已跳过`);
            return;
          }
          db.createTodo({
            title: todo.title,
            description: typeof todo.description === 'string' ? todo.description : null,
            priority: Number(todo.priority) || 2,
            status: Number(todo.status) || 0,
            due_date: typeof todo.due_date === 'number' ? todo.due_date : null,
            category: typeof todo.category === 'string' ? todo.category : null,
            estimated_hours:
              typeof todo.estimated_hours === 'number' ? todo.estimated_hours : null,
          });
          stats.created.todos += 1;
        });
      }

      if (Array.isArray(backup.checkIns)) {
        backup.checkIns.forEach((checkIn, index) => {
          if (!isObject(checkIn) || typeof checkIn.date !== 'number') {
            stats.skipped.checkIns += 1;
            warnings.push(`checkIns[${index}] 缺少有效日期，已跳过`);
            return;
          }
          const action = db.createOrUpdateCheckInFromBackup({
            date: checkIn.date,
            start_time: typeof checkIn.start_time === 'number' ? checkIn.start_time : null,
            end_time: typeof checkIn.end_time === 'number' ? checkIn.end_time : null,
            duration: Number(checkIn.duration) || 0,
            tasks_completed: Number(checkIn.tasks_completed) || 0,
            notes_count: Number(checkIn.notes_count) || 0,
            code_runs: Number(checkIn.code_runs) || 0,
          });
          stats[action].checkIns += 1;
        });
      }

      const progressIdToName = new Map<number, string>();
      const progressItems = Array.isArray(backup.studyProgress) ? backup.studyProgress : [];
      progressItems.forEach(item => {
        if (isObject(item) && typeof item.id === 'number' && typeof item.skill_name === 'string') {
          progressIdToName.set(item.id, item.skill_name);
        }
      });

      if (progressItems.length > 0) {
        const applyProgress = (item: unknown, index: number) => {
          if (!isObject(item) || typeof item.skill_name !== 'string' || !item.skill_name.trim()) {
            stats.skipped.studyProgress += 1;
            warnings.push(`studyProgress[${index}] 缺少有效技能名，已跳过`);
            return;
          }

          const parentSkillName =
            typeof item.parent_skill_id === 'number'
              ? progressIdToName.get(item.parent_skill_id) || null
              : null;

          const action = db.upsertStudyProgressByName({
            skill_name: item.skill_name,
            category: typeof item.category === 'string' ? item.category : null,
            level: Number(item.level) || 0,
            target_level: Number(item.target_level) || 100,
            time_spent: Number(item.time_spent) || 0,
            notes_count: Number(item.notes_count) || 0,
            code_count: Number(item.code_count) || 0,
            order_index: Number(item.order_index) || 0,
            updated_at: typeof item.updated_at === 'number' ? item.updated_at : Date.now(),
            parent_skill_name: parentSkillName,
          });
          stats[action].studyProgress += 1;
        };

        progressItems.forEach(applyProgress);
        // Second pass ensures parent links are repaired after all skills exist.
        progressItems.forEach(applyProgress);
      }

      const planIdMap = new Map<number, number>();
      if (Array.isArray(backup.studyPlans)) {
        backup.studyPlans.forEach((plan, index) => {
          if (
            !isObject(plan) ||
            typeof plan.title !== 'string' ||
            typeof plan.start_date !== 'number' ||
            typeof plan.end_date !== 'number'
          ) {
            stats.skipped.studyPlans += 1;
            warnings.push(`studyPlans[${index}] 数据不完整，已跳过`);
            return;
          }

          const startDate = plan.start_date;
          const endDate = Math.max(plan.end_date, startDate);
          const targetHours = Math.max(1, Number(plan.target_hours) || 1);
          const createdPlan = db.createStudyPlan({
            title: plan.title,
            description: typeof plan.description === 'string' ? plan.description : null,
            skill_id: typeof plan.skill_id === 'number' ? plan.skill_id : null,
            skill_name: typeof plan.skill_name === 'string' ? plan.skill_name : null,
            start_date: startDate,
            end_date: endDate,
            target_hours: targetHours,
            completed_hours: Number(plan.completed_hours) || 0,
            status: Number(plan.status) || 0,
            priority: Number(plan.priority) || 2,
            reminder: Number(plan.reminder) || 0,
            reminder_time: typeof plan.reminder_time === 'string' ? plan.reminder_time : null,
          });
          stats.created.studyPlans += 1;
          if (typeof plan.id === 'number' && createdPlan?.id) {
            planIdMap.set(plan.id, createdPlan.id);
          }
        });
      }

      const milestoneSource = Array.isArray(backup.milestones) ? backup.milestones : [];
      milestoneSource.forEach((milestone, index) => {
        if (!isObject(milestone) || typeof milestone.title !== 'string') {
          stats.skipped.milestones += 1;
          warnings.push(`milestones[${index}] 缺少有效标题，已跳过`);
          return;
        }
        if (typeof milestone.plan_id !== 'number') {
          stats.skipped.milestones += 1;
          warnings.push(`milestones[${index}] 缺少有效计划 ID，已跳过`);
          return;
        }

        const mappedPlanId = planIdMap.get(milestone.plan_id);
        if (!mappedPlanId) {
          stats.skipped.milestones += 1;
          warnings.push(`milestones[${index}] 找不到对应计划，已跳过`);
          return;
        }

        db.createMilestone({
          plan_id: mappedPlanId,
          title: milestone.title,
          description: typeof milestone.description === 'string' ? milestone.description : null,
          target_date: typeof milestone.target_date === 'number' ? milestone.target_date : null,
          completed: Number(milestone.completed) ? 1 : 0,
          sort_order: Number(milestone.sort_order) || 0,
        });
        stats.created.milestones += 1;
      });

      if (Array.isArray(backup.settings)) {
        backup.settings.forEach((setting, index) => {
          if (!isObject(setting) || typeof setting.key !== 'string') {
            stats.skipped.settings += 1;
            warnings.push(`settings[${index}] 缺少有效 key，已跳过`);
            return;
          }
          db.setSetting(
            setting.key,
            typeof setting.value === 'string' ? setting.value : String(setting.value ?? ''),
            typeof setting.category === 'string' ? setting.category : undefined
          );
          stats.updated.settings += 1;
        });
      } else if (isObject(backup.settings)) {
        Object.entries(backup.settings).forEach(([key, value]) => {
          db.setSetting(key, typeof value === 'string' ? value : String(value ?? ''));
          stats.updated.settings += 1;
        });
      }

      return {
        success: true,
        message: '备份导入成功',
        stats,
        warnings,
      };
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        message: '导入失败：文件格式错误',
        error: (error as Error).message,
      };
    }
  });

  // Export PDF
  ipcMain.handle('export:pdf', async (_, content: string, title: string) => {
    return exportMarkdownToPdf(content, title);
  });

  ipcMain.handle(
    'export:pdfAdvanced',
    async (_event, content: string, title: string, options?: PdfExportOptions) => {
      return exportMarkdownToPdf(content, title, options);
    }
  );
}
