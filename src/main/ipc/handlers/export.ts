import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { Database } from '../../database';

type PdfExportOptions = {
  pageSize?: 'A4' | 'Letter';
  printBackground?: boolean;
  theme?: 'typora' | 'github' | 'custom';
  customCss?: string;
};

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
      await new Promise((resolve) => setTimeout(resolve, 800));
      const data = await win.webContents.printToPDF({
        printBackground: options?.printBackground ?? true,
        pageSize: options?.pageSize ?? 'A4',
      });
      fs.writeFileSync(result.filePath, data);
      win.close();
      return { success: true, path: result.filePath };
    } catch (error) {
      win.close();
      console.error('Failed to print PDF:', error);
      return { success: false, error: (error as Error).message };
    }
  };

  // Save file with dialog
  ipcMain.handle('file:save', async (_, content: string, defaultPath?: string, filters?: any[]) => {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
      title: '保存文件',
      defaultPath: defaultPath || 'untitled.md',
      filters: filters || [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, path: result.filePath };
    }

    return { success: false };
  });
  // Export backup (full database)
  ipcMain.handle('export:backup', async () => {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导出备份',
      defaultPath: `learning_app_backup_${new Date().toISOString().split('T')[0]}`,
      filters: [
        { name: 'JSON', extensions: ['json'] },
      ],
    });

    if (result.filePath) {
      const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        todos: db.getTodos(),
        checkIns: db.getCheckIns(365),
        studyProgress: db.getStudyProgress(),
        studyPlans: db.getStudyPlans(),
        settings: [],
      };

      fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    }

    return { success: false };
  });

  // Import backup
  ipcMain.handle('import:backup', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      title: '导入备份',
      filters: [
        { name: 'JSON', extensions: ['json'] },
      ],
      properties: ['openFile'],
    });

    if (result.filePaths && result.filePaths.length > 0) {
      try {
        const content = fs.readFileSync(result.filePaths[0], 'utf-8');
        const backup = JSON.parse(content);

        // Import todos
        if (backup.todos) {
          backup.todos.forEach((todo: any) => {
            try {
              db.createTodo({
                title: todo.title,
                description: todo.description,
                priority: todo.priority,
                due_date: todo.due_date,
                category: todo.category,
              });
            } catch (e) {
              console.log('Skip duplicate todo:', todo.title);
            }
          });
        }

        // Import settings
        if (backup.settings) {
          backup.settings.forEach((setting: any) => {
            db.setSetting(setting.key, setting.value, setting.category);
          });
        }

        return { success: true, message: '备份导入成功' };
      } catch (error) {
        console.error('Import failed:', error);
        return { success: false, message: '导入失败：文件格式错误' };
      }
    }

    return { success: false };
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
