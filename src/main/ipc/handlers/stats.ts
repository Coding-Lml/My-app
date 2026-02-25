import { ipcMain } from 'electron';
import { Database } from '../../database';

export function registerStatsHandlers(db: Database) {
  // Get study progress
  ipcMain.handle('progress:getAll', () => {
    return db.getStudyProgress();
  });

  // Update study progress
  ipcMain.handle('progress:update', (_event, skillName: string, updates) => {
    db.updateStudyProgress(skillName, updates);
    return { success: true };
  });

  // Create skill
  ipcMain.handle(
    'progress:create',
    (
      _event,
      payload: {
        skill_name: string;
        category?: string;
        parent_skill_id?: number | null;
        order_index?: number;
        target_level?: number;
      }
    ) => {
      return (db as any).createStudySkill(payload);
    }
  );

  // Update skill by id
  ipcMain.handle('progress:updateById', (_event, id: number, updates: any) => {
    (db as any).updateStudySkill(id, updates);
    return { success: true };
  });

  // Delete skill
  ipcMain.handle('progress:delete', (_event, id: number) => {
    (db as any).deleteStudySkill(id);
    return { success: true };
  });

  // Get achievements
  ipcMain.handle('achievements:getAll', () => {
    const result = (db as any).db?.exec('SELECT * FROM achievements ORDER BY created_at');
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];
    return values.map((row: any[]) => {
      const achievement: any = {};
      columns.forEach((col: string, i: number) => {
        achievement[col] = row[i];
      });
      return achievement;
    });
  });

  // Get user achievements (unlocked)
  ipcMain.handle('achievements:getUnlocked', () => {
    const result = (db as any).db?.exec(`
      SELECT a.*, ua.unlocked_at
      FROM achievements a
      INNER JOIN user_achievements ua ON a.id = ua.achievement_id
      ORDER BY ua.unlocked_at DESC
    `);
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];
    return values.map((row: any[]) => {
      const achievement: any = {};
      columns.forEach((col: string, i: number) => {
        achievement[col] = row[i];
      });
      return achievement;
    });
  });

  // Get settings
  ipcMain.handle('settings:get', (_event, key: string) => {
    return db.getSetting(key);
  });

  // Set settings
  ipcMain.handle('settings:set', (_event, key: string, value: string, category?: string) => {
    db.setSetting(key, value, category);
    return { success: true };
  });

  // Get all settings
  ipcMain.handle('settings:getAll', () => {
    const result = (db as any).db?.exec('SELECT * FROM settings');
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];
    const settings: Record<string, any> = {};
    values.forEach((row: any[]) => {
      const setting: any = {};
      columns.forEach((col: string, i: number) => {
        setting[col] = row[i];
      });
      settings[setting.key] = setting.value;
    });

    return settings;
  });
}
