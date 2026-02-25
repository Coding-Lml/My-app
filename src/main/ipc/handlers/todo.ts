import { ipcMain } from 'electron';
import { Database } from '../../database';

export function registerTodoHandlers(db: Database) {
  // Get all todos
  ipcMain.handle('todos:getAll', () => {
    return db.getTodos();
  });

  // Create todo
  ipcMain.handle('todos:create', (_, todo) => {
    return db.createTodo(todo);
  });

  // Update todo
  ipcMain.handle('todos:update', (_, id: number, todo) => {
    db.updateTodo(id, todo);
    return { success: true };
  });

  // Delete todo
  ipcMain.handle('todos:delete', (_, id: number) => {
    db.deleteTodo(id);
    return { success: true };
  });
}
