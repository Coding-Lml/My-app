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
    const rows = db.getAllSettings();
    const settings: Record<string, string> = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  });
}
