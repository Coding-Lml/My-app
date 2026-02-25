import { ipcMain } from 'electron';
import { Database } from '../../database';
import type { StudyPlanUpdatePayload } from '@shared/types/ipc';

export function registerPlanHandlers(db: Database) {
  // Study Plans
  ipcMain.handle('plans:getAll', () => {
    return db.getStudyPlans();
  });

  ipcMain.handle('plans:getById', (_, id: number) => {
    return db.getStudyPlanById(id);
  });

  ipcMain.handle('plans:create', (_, plan) => {
    return db.createStudyPlan(plan);
  });

  ipcMain.handle('plans:update', (_, id: number, updates: StudyPlanUpdatePayload) => {
    try {
      db.updateStudyPlan(id, updates);
      const plan = db.getStudyPlanById(id);
      return { success: true, plan };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新失败',
      };
    }
  });

  ipcMain.handle('plans:delete', (_, id: number) => {
    db.deleteStudyPlan(id);
    return { success: true };
  });

  // Milestones
  ipcMain.handle('milestones:getByPlanId', (_, planId: number) => {
    return db.getMilestonesByPlanId(planId);
  });

  ipcMain.handle('milestones:create', (_, milestone) => {
    return db.createMilestone(milestone);
  });

  ipcMain.handle('milestones:update', (_, id: number, updates) => {
    db.updateMilestone(id, updates);
    return { success: true };
  });

  ipcMain.handle('milestones:delete', (_, id: number) => {
    db.deleteMilestone(id);
    return { success: true };
  });
}
