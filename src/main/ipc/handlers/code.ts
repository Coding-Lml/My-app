import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { Database } from '../../database';

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT = 10000;
const MAX_OUTPUT_LENGTH = 10000;
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;

function normalizeExecText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }
  return '';
}

function truncateOutput(text: string | null | undefined): string | null {
  if (!text) return null;
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return `${text.slice(0, MAX_OUTPUT_LENGTH)}\n...truncated...`;
}

function resolveJavaExecutables(javaPath?: string): { javaExe: string; javacExe: string } {
  const configuredJava = (javaPath || '').trim();
  if (!configuredJava) {
    return { javaExe: 'java', javacExe: 'javac' };
  }

  const javaExe = configuredJava;
  const baseName = path.basename(javaExe).toLowerCase();
  if (baseName === 'java' || baseName === 'java.exe') {
    const javacName = baseName.endsWith('.exe') ? 'javac.exe' : 'javac';
    return { javaExe, javacExe: path.join(path.dirname(javaExe), javacName) };
  }

  return { javaExe, javacExe: 'javac' };
}

function detectJavaEntry(code: string): { className: string; packageName: string } {
  const packageMatch = code.match(/^\s*package\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/m);
  const publicClassMatch = code.match(/\bpublic\s+class\s+([A-Za-z_]\w*)/);
  const classMatch = code.match(/\bclass\s+([A-Za-z_]\w*)/);

  return {
    className: publicClassMatch?.[1] || classMatch?.[1] || 'Main',
    packageName: packageMatch?.[1] || '',
  };
}

export function registerCodeHandlers(db: Database) {
  // Get code snippets
  ipcMain.handle('snippets:getAll', () => {
    return db.getCodeSnippets();
  });

  // Create snippet
  ipcMain.handle('snippets:create', (_, snippet) => {
    return db.createCodeSnippet(snippet);
  });

  // Update snippet
  ipcMain.handle('snippets:update', (_, id: number, snippet) => {
    db.updateCodeSnippet(id, snippet);
    return { success: true };
  });

  // Delete snippet
  ipcMain.handle('snippets:delete', (_, id: number) => {
    db.deleteCodeSnippet(id);
    return { success: true };
  });

  // Increment snippet usage
  ipcMain.handle('snippets:incrementUsage', (_, id: number) => {
    db.incrementSnippetUsage(id);
    return { success: true };
  });

  // Run Java code
  ipcMain.handle('code:runJava', async (_, code: string, javaPath?: string) => {
    const { javaExe, javacExe } = resolveJavaExecutables(javaPath);
    const fs = await import('fs');
    const os = await import('os');
    const entry = detectJavaEntry(code);
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'java-'));
    const packagePath = entry.packageName ? entry.packageName.split('.').join(path.sep) : '';
    const javaDir = packagePath ? path.join(tempDir, packagePath) : tempDir;
    const javaFile = path.join(javaDir, `${entry.className}.java`);
    const javaMainClass = entry.packageName ? `${entry.packageName}.${entry.className}` : entry.className;
    const startTime = Date.now();

    try {
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(javaFile, code, 'utf8');

      try {
        await execFileAsync(javacExe, [path.relative(tempDir, javaFile)], {
          cwd: tempDir,
          timeout: EXEC_TIMEOUT,
          maxBuffer: EXEC_MAX_BUFFER,
          encoding: 'utf8',
        });
      } catch (compileError: any) {
        const stdout = truncateOutput(normalizeExecText(compileError?.stdout));
        const stderr = truncateOutput(normalizeExecText(compileError?.stderr));
        const errorText = stderr || stdout || 'Compilation error';
        const outputText = stdout || '';

        db.createCodeExecution({
          snippet_id: null,
          code,
          language: 'java',
          output: outputText || null,
          error: errorText,
          execution_time: Date.now() - startTime,
          status: 'error',
        });

        return {
          success: false,
          output: outputText,
          error: errorText,
          executionTime: Date.now() - startTime,
        };
      }

      try {
        const { stdout, stderr } = await execFileAsync(javaExe, ['-cp', tempDir, javaMainClass], {
          cwd: tempDir,
          timeout: EXEC_TIMEOUT,
          maxBuffer: EXEC_MAX_BUFFER,
          encoding: 'utf8',
        });

        const outputText = truncateOutput(normalizeExecText(stdout)) || '';
        const errorText = truncateOutput(normalizeExecText(stderr));
        const executionTime = Date.now() - startTime;

        const execution = db.createCodeExecution({
          snippet_id: null,
          code,
          language: 'java',
          output: outputText || null,
          error: errorText,
          execution_time: executionTime,
          status: 'success',
        });

        return {
          success: true,
          output: outputText,
          error: errorText || null,
          executionTime: execution.execution_time,
          id: execution.id,
        };
      } catch (runError: any) {
        const outputText = truncateOutput(normalizeExecText(runError?.stdout)) || '';
        const errorText = truncateOutput(normalizeExecText(runError?.stderr)) || 'Runtime error';
        const executionTime = Date.now() - startTime;

        db.createCodeExecution({
          snippet_id: null,
          code,
          language: 'java',
          output: outputText || null,
          error: errorText,
          execution_time: executionTime,
          status: 'error',
        });

        return {
          success: false,
          output: outputText,
          error: errorText,
          executionTime,
        };
      }
    } catch (error: any) {
      db.createCodeExecution({
        snippet_id: null,
        code,
        language: 'java',
        output: null,
        error: error.message,
        execution_time: 0,
        status: 'error',
      });

      return {
        success: false,
        output: '',
        error: error.message,
        executionTime: 0,
      };
    } finally {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup Java temp directory:', cleanupError);
      }
    }
  });

  // Check Java
  ipcMain.handle('code:checkJava', async (_e, javaPath?: string) => {
    const { javaExe } = resolveJavaExecutables(javaPath);
    try {
      const { stdout, stderr } = await execFileAsync(javaExe, ['-version'], {
        timeout: 8000,
        encoding: 'utf8',
      });
      const out = (normalizeExecText(stderr) || normalizeExecText(stdout) || '').trim();
      const versionLine = out.split('\n')[0] || out;
      return { success: true, version: versionLine, raw: out, path: javaExe };
    } catch (err: any) {
      return { success: false, error: err.message, path: javaExe };
    }
  });

  // Check Python
  ipcMain.handle('code:checkPython', async (_e, pythonPath?: string) => {
    const pythonExe = (pythonPath || '').trim() || 'python3';
    try {
      const { stdout, stderr } = await execFileAsync(pythonExe, ['--version'], {
        timeout: 8000,
        encoding: 'utf8',
      });
      const out = (normalizeExecText(stdout) || normalizeExecText(stderr) || '').trim();
      return { success: true, version: out, raw: out, path: pythonExe };
    } catch (err: any) {
      return { success: false, error: err.message, path: pythonExe };
    }
  });

  // Run Python code
  ipcMain.handle('code:runPython', async (_, code: string, pythonPath?: string) => {
    const pythonExe = (pythonPath || '').trim() || 'python3';
    const fs = await import('fs');
    const os = await import('os');
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'py-'));
    const pyFile = path.join(tempDir, 'main.py');
    const startTime = Date.now();

    try {
      await fs.promises.writeFile(pyFile, code, 'utf8');

      try {
        const { stdout, stderr } = await execFileAsync(pythonExe, [pyFile], {
          timeout: EXEC_TIMEOUT,
          maxBuffer: EXEC_MAX_BUFFER,
          encoding: 'utf8',
        });

        const outputText = truncateOutput(normalizeExecText(stdout)) || '';
        const errorText = truncateOutput(normalizeExecText(stderr));
        const executionTime = Date.now() - startTime;

        const execution = db.createCodeExecution({
          snippet_id: null,
          code,
          language: 'python',
          output: outputText || null,
          error: errorText,
          execution_time: executionTime,
          status: 'success',
        });

        return {
          success: true,
          output: outputText,
          error: errorText || null,
          executionTime: execution.execution_time,
          id: execution.id,
        };
      } catch (runError: any) {
        const outputText = truncateOutput(normalizeExecText(runError?.stdout)) || '';
        const errorText = truncateOutput(normalizeExecText(runError?.stderr)) || 'Runtime error';
        const executionTime = Date.now() - startTime;

        db.createCodeExecution({
          snippet_id: null,
          code,
          language: 'python',
          output: outputText || null,
          error: errorText,
          execution_time: executionTime,
          status: 'error',
        });

        return {
          success: false,
          output: outputText,
          error: errorText,
          executionTime,
        };
      }
    } catch (error: any) {
      db.createCodeExecution({
        snippet_id: null,
        code,
        language: 'python',
        output: null,
        error: error.message,
        execution_time: 0,
        status: 'error',
      });
      return {
        success: false,
        output: '',
        error: error.message,
        executionTime: 0,
      };
    } finally {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup Python temp directory:', cleanupError);
      }
    }
  });
}
