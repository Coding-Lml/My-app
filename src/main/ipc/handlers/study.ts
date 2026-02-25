import { ipcMain } from 'electron';
import dayjs from 'dayjs';
import { Database } from '../../database';

export function registerStudyHandlers(db: Database) {
  // Check-ins
  ipcMain.handle('checkins:getAll', (_event, limit?: number) => {
    return db.getCheckIns(limit);
  });

  ipcMain.handle('checkins:save', (_event, date: number, data) => {
    return db.createOrUpdateCheckIn(date, data);
  });

  ipcMain.handle('checkins:getByDate', (_event, date: number) => {
    const result = (db as any).db?.exec(`SELECT * FROM check_ins WHERE date = ${date}`);
    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const { columns, values } = result[0];
    const checkIn: any = {};
    columns.forEach((col: string, i: number) => {
      checkIn[col] = values[0][i];
    });

    return checkIn;
  });

  ipcMain.handle('checkins:start', (_event, date: number) => {
    return db.createOrUpdateCheckIn(date, { start_time: Date.now() });
  });

  ipcMain.handle('checkins:end', (_event, date: number, duration: number) => {
    return db.createOrUpdateCheckIn(date, {
      end_time: Date.now(),
      duration,
    });
  });

  ipcMain.handle('checkins:stats', () => {
    const checkIns = db.getCheckIns(365);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let consecutiveDays = 0;
    const currentDate = new Date(today);

    const checkInDates = new Set(checkIns.map((c) => new Date(c.date).toDateString()));

    while (checkInDates.has(currentDate.toDateString())) {
      consecutiveDays += 1;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    const totalDays = checkIns.length;
    const totalDuration = checkIns.reduce((sum, c) => sum + c.duration, 0);
    const totalTasks = checkIns.reduce((sum, c) => sum + c.tasks_completed, 0);

    const thisMonth = checkIns.filter((c) => {
      const date = new Date(c.date);
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    });

    return {
      consecutiveDays,
      totalDays,
      totalDuration,
      totalTasks,
      thisMonthDays: thisMonth.length,
      thisMonthDuration: thisMonth.reduce((sum, c) => sum + c.duration, 0),
    };
  });

  ipcMain.handle('pomodoro:getAll', (_event, limit?: number) => {
    return db.getPomodoroSessions(limit);
  });

  ipcMain.handle('pomodoro:save', (_event, session) => {
    return db.createPomodoroSession(session);
  });

  ipcMain.handle('pomodoro:update', (_event, id: number, updates) => {
    db.updatePomodoroSession(id, updates);
    return { success: true };
  });

  ipcMain.handle('pomodoro:getStats', (_event, date: number) => {
    return db.getPomodoroStatsByDate(date);
  });

  ipcMain.handle('pomodoro:getTodayStats', () => {
    const today = dayjs().startOf('day').valueOf();
    return db.getPomodoroStatsByDate(today);
  });
}
