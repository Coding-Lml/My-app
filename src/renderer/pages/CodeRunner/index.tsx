import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout, Button, Select, Card, Message, Modal } from '@arco-design/web-react';
import {
  IconPlayCircle,
  IconSave,
  IconFolder,
  IconFile,
  IconDownload,
  IconPlus,
} from '@arco-design/web-react/icon';
import Editor from '@monaco-editor/react';
import WorkspaceSidebar, { WorkspaceFileItem } from './components/WorkspaceSidebar';
import RunOutputCard from './components/RunOutputCard';
import './styles.css';

const { Content } = Layout;

type CodeLanguage = 'java' | 'python';

interface OpenedCodeFile {
  path: string;
  name: string;
  content: string;
  isModified: boolean;
}

interface DraftCodeFile {
  name: string;
  content: string;
  language: CodeLanguage;
  isModified: boolean;
}

const CODE_EXTENSIONS = ['java', 'py'];
const CODE_FILE_FILTERS = [
  { name: 'Code Files', extensions: ['java', 'py'] },
  { name: 'Java Files', extensions: ['java'] },
  { name: 'Python Files', extensions: ['py'] },
  { name: 'All Files', extensions: ['*'] },
];

const CODE_TEMPLATES: Record<CodeLanguage, string> = {
  java: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello Java");
  }
}
`,
  python: `def main():
    print("Hello Python")

if __name__ == "__main__":
    main()
`,
};

function getLanguageByPath(filePath: string): CodeLanguage {
  return filePath.toLowerCase().endsWith('.py') ? 'python' : 'java';
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function getDirPath(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSlash <= 0) {
    return filePath;
  }
  return filePath.substring(0, lastSlash);
}

function ensureCodeExtension(fileName: string, language: CodeLanguage): string {
  const normalized = fileName.trim();
  if (!normalized) {
    return language === 'python' ? 'untitled.py' : 'untitled.java';
  }

  if (normalized.endsWith('.java') || normalized.endsWith('.py')) {
    return normalized;
  }
  return language === 'python' ? `${normalized}.py` : `${normalized}.java`;
}

function createDraft(language: CodeLanguage): DraftCodeFile {
  return {
    name: language === 'python' ? 'untitled.py' : 'untitled.java',
    content: CODE_TEMPLATES[language],
    language,
    isModified: false,
  };
}

function CodeRunner() {
  const [openedFolder, setOpenedFolder] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<WorkspaceFileItem[]>([]);
  const [openedFiles, setOpenedFiles] = useState<OpenedCodeFile[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [draftFile, setDraftFile] = useState<DraftCodeFile>(() => createDraft('java'));
  const [language, setLanguage] = useState<CodeLanguage>('java');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [editorFontSize, setEditorFontSize] = useState(14);

  const currentFile = useMemo(() => {
    if (!currentFilePath) return null;
    return openedFiles.find((file) => file.path === currentFilePath) || null;
  }, [openedFiles, currentFilePath]);

  const editorContent = currentFile ? currentFile.content : draftFile.content;
  const activeFileName = currentFile ? currentFile.name : draftFile.name;
  const isCurrentModified = currentFile ? currentFile.isModified : draftFile.isModified;
  const lineCount = editorContent ? editorContent.split('\n').length : 0;
  const charCount = editorContent.length;

  const saveRecentFiles = useCallback(async (files: string[]) => {
    try {
      await window.electronAPI.settings.set('codeRecentFiles', JSON.stringify(files), 'code');
    } catch (error) {
      console.error('Failed to save code recent files:', error);
    }
  }, []);

  const addToRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const updated = [filePath, ...prev.filter((item) => item !== filePath)].slice(0, 20);
      void saveRecentFiles(updated);
      return updated;
    });
  }, [saveRecentFiles]);

  const removeFromRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const updated = prev.filter((item) => item !== filePath);
      void saveRecentFiles(updated);
      return updated;
    });
  }, [saveRecentFiles]);

  const buildFolderTree = useCallback(async (folderPath: string, depth = 0): Promise<WorkspaceFileItem[]> => {
    if (depth > 12) return [];

    const result = await window.electronAPI.fs.readFolder(folderPath, { extensions: CODE_EXTENSIONS });
    if (!result.success) return [];

    const folderItems = (result.folders || [])
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map(async (folder) => ({
        name: folder.name,
        path: folder.path,
        isDirectory: true,
        children: await buildFolderTree(folder.path, depth + 1),
      }));

    const fileItems = (result.files || [])
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: false,
      }));

    const resolvedFolders = await Promise.all(folderItems);
    return [...resolvedFolders, ...fileItems];
  }, []);

  const loadFolder = useCallback(async (folderPath: string) => {
    try {
      const tree = await buildFolderTree(folderPath);
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load code folder:', error);
      Message.error('加载代码目录失败');
    }
  }, [buildFolderTree]);

  const loadCodeFile = useCallback(async (filePath: string) => {
    try {
      const result = await window.electronAPI.fs.readFile(filePath);
      if (!result.success || typeof result.content !== 'string') {
        Message.error(result.error || '读取文件失败');
        return;
      }

      setOpenedFiles((prev) => {
        const existing = prev.find((file) => file.path === filePath);
        if (existing) {
          return prev.map((file) => (
            file.path === filePath
              ? { ...file, content: result.content || '', isModified: false }
              : file
          ));
        }

        return [
          ...prev,
          {
            path: filePath,
            name: getFileName(filePath),
            content: result.content || '',
            isModified: false,
          },
        ];
      });

      setCurrentFilePath(filePath);
      setLanguage(getLanguageByPath(filePath));
      setOutput('');
      setExecutionTime(0);
      setLastSavedAt(Date.now());
      addToRecentFiles(filePath);

      const dirPath = getDirPath(filePath);
      if (dirPath) {
        setOpenedFolder(dirPath);
        await window.electronAPI.settings.set('codeWorkspaceFolder', dirPath, 'code');
        await loadFolder(dirPath);
      }
    } catch (error) {
      console.error('Failed to open code file:', error);
      Message.error('打开代码文件失败');
    }
  }, [addToRecentFiles, loadFolder]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [recentRaw, lastFolder, fontSizeRaw] = await Promise.all([
          window.electronAPI.settings.get('codeRecentFiles'),
          window.electronAPI.settings.get('codeWorkspaceFolder'),
          window.electronAPI.settings.get('fontSize'),
        ]);

        if (recentRaw) {
          const parsed = JSON.parse(recentRaw);
          if (Array.isArray(parsed)) {
            setRecentFiles(parsed.filter((item) => typeof item === 'string').slice(0, 20));
          }
        }

        if (lastFolder) {
          setOpenedFolder(lastFolder);
          await loadFolder(lastFolder);
        }

        if (fontSizeRaw) {
          const parsed = Number(fontSizeRaw);
          if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 32) {
            setEditorFontSize(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to initialize code workspace:', error);
      }
    };

    void initialize();
  }, [loadFolder]);

  const closeFileTab = useCallback((filePath: string) => {
    setOpenedFiles((prev) => {
      const index = prev.findIndex((file) => file.path === filePath);
      const nextFiles = prev.filter((file) => file.path !== filePath);

      if (currentFilePath === filePath) {
        const nextActive = nextFiles[Math.max(0, index - 1)] || nextFiles[0] || null;
        setCurrentFilePath(nextActive?.path || null);
        setLanguage(nextActive ? getLanguageByPath(nextActive.path) : draftFile.language);
      }

      return nextFiles;
    });
  }, [currentFilePath, draftFile.language]);

  const handleCloseFile = useCallback((filePath: string) => {
    const target = openedFiles.find((item) => item.path === filePath);
    if (!target) return;

    if (target.isModified) {
      Modal.confirm({
        title: '文件未保存',
        content: `文件 ${target.name} 有未保存修改，是否直接关闭？`,
        okText: '关闭',
        cancelText: '取消',
        onOk: () => closeFileTab(filePath),
      });
      return;
    }

    closeFileTab(filePath);
  }, [closeFileTab, openedFiles]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const result = await window.electronAPI.fs.openFolder();
      if (!result.success || !result.folderPath) return;

      setOpenedFolder(result.folderPath);
      await window.electronAPI.settings.set('codeWorkspaceFolder', result.folderPath, 'code');
      await loadFolder(result.folderPath);
    } catch (error) {
      console.error('Failed to open code folder:', error);
      Message.error('打开目录失败');
    }
  }, [loadFolder]);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await window.electronAPI.fs.openFile({
        title: '打开 Java / Python 文件',
        filters: CODE_FILE_FILTERS,
      });
      if (result.success && result.filePath) {
        await loadCodeFile(result.filePath);
      }
    } catch (error) {
      console.error('Failed to open code file:', error);
      Message.error('打开文件失败');
    }
  }, [loadCodeFile]);

  const handleOpenRecentFile = useCallback(async (filePath: string) => {
    try {
      const result = await window.electronAPI.fs.fileExists(filePath);
      if (!result.success || !result.exists) {
        removeFromRecentFiles(filePath);
        Message.warning('最近文件不存在，已移除');
        return;
      }
      await loadCodeFile(filePath);
    } catch (error) {
      console.error('Failed to open recent file:', error);
      Message.error('打开最近文件失败');
    }
  }, [loadCodeFile, removeFromRecentFiles]);

  const handleSave = useCallback(async () => {
    if (!currentFilePath) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electronAPI.fs.writeFile(currentFilePath, editorContent);
      if (!result.success) {
        Message.error(result.error || '保存失败');
        return;
      }

      setOpenedFiles((prev) => prev.map((file) => (
        file.path === currentFilePath ? { ...file, isModified: false } : file
      )));
      setLastSavedAt(Date.now());
      addToRecentFiles(currentFilePath);
      Message.success('已保存');
    } catch (error) {
      console.error('Failed to save code file:', error);
      Message.error('保存文件失败');
    } finally {
      setIsSaving(false);
    }
  }, [addToRecentFiles, currentFilePath, editorContent]);

  const handleSaveAs = useCallback(async () => {
    const defaultName = ensureCodeExtension(activeFileName, language);
    try {
      const result = await window.electronAPI.fs.saveFileDialog(editorContent, defaultName, {
        title: '另存为代码文件',
        filters: CODE_FILE_FILTERS,
      });
      if (!result.success || !result.filePath) {
        return;
      }

      await loadCodeFile(result.filePath);
      setLastSavedAt(Date.now());
      Message.success('文件已保存');
    } catch (error) {
      console.error('Failed to save as code file:', error);
      Message.error('另存为失败');
    }
  }, [activeFileName, editorContent, language, loadCodeFile]);

  const handleManualSave = useCallback(async () => {
    if (currentFilePath) {
      await handleSave();
    } else {
      await handleSaveAs();
    }
  }, [currentFilePath, handleSave, handleSaveAs]);

  const handleNewFile = useCallback(() => {
    if (!currentFilePath && draftFile.isModified) {
      Modal.confirm({
        title: '放弃未保存草稿',
        content: '当前草稿尚未保存，是否创建新草稿？',
        okText: '创建',
        cancelText: '取消',
        onOk: () => {
          const next = createDraft(language);
          setDraftFile(next);
          setCurrentFilePath(null);
          setLanguage(next.language);
          setOutput('');
          setExecutionTime(0);
          setLastSavedAt(null);
        },
      });
      return;
    }

    const next = createDraft(language);
    setDraftFile(next);
    setCurrentFilePath(null);
    setLanguage(next.language);
    setOutput('');
    setExecutionTime(0);
    setLastSavedAt(null);
  }, [currentFilePath, draftFile.isModified, language]);

  const handleRun = useCallback(async () => {
    if (!editorContent.trim()) {
      Message.warning('请先输入代码');
      return;
    }

    setIsRunning(true);
    setOutput('');
    setExecutionTime(0);

    try {
      const settings = await window.electronAPI.settings.getAll();
      const javaPath = settings.javaPath || '';
      const pythonPath = settings.pythonPath || '';
      const result = language === 'java'
        ? await window.electronAPI.code.runJava(editorContent, javaPath)
        : await window.electronAPI.code.runPython(editorContent, pythonPath);

      const stdout = String(result.output || '');
      const stderr = String(result.error || '');
      const mergedOutput = [stdout, stderr].filter(Boolean).join(stdout && stderr ? '\n' : '');
      setOutput(mergedOutput || '(无输出)');
      setExecutionTime(Number(result.executionTime || 0));

      if (result.success) {
        Message.success('执行完成');
      } else {
        Message.error('执行失败');
      }
    } catch (error: any) {
      console.error('Run code failed:', error);
      setOutput(`执行异常：${error?.message || '未知错误'}`);
      Message.error('执行异常');
    } finally {
      setIsRunning(false);
    }
  }, [editorContent, language]);

  const handleEditorChange = useCallback((value: string) => {
    if (currentFilePath) {
      setOpenedFiles((prev) => prev.map((file) => (
        file.path === currentFilePath ? { ...file, content: value, isModified: true } : file
      )));
      return;
    }

    setDraftFile((prev) => ({ ...prev, content: value, isModified: true }));
  }, [currentFilePath]);

  const handleLanguageChange = useCallback((nextValue: string) => {
    const nextLanguage = nextValue as CodeLanguage;
    setLanguage(nextLanguage);
    if (!currentFilePath) {
      setDraftFile((prev) => ({
        ...prev,
        language: nextLanguage,
        name: ensureCodeExtension(prev.name, nextLanguage),
      }));
    }
  }, [currentFilePath]);

  const formatSaveStatus = useCallback(() => {
    if (isSaving) return '保存中...';
    if (isCurrentModified) return '未保存';
    if (!lastSavedAt) return '未保存';

    const seconds = Math.floor((Date.now() - lastSavedAt) / 1000);
    if (seconds < 60) return '刚刚已保存';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前已保存`;
    return '已保存';
  }, [isCurrentModified, isSaving, lastSavedAt]);

  const copyOutput = useCallback(() => {
    navigator.clipboard.writeText(output);
    Message.success('已复制输出');
  }, [output]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          void handleSaveAs();
        } else {
          void handleManualSave();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void handleOpenFile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleNewFile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave, handleNewFile, handleOpenFile, handleRun, handleSaveAs]);

  return (
    <div className="code-page">
      <div className="code-header">
        <h1 className="page-title">代码工作台</h1>
        <div className="code-actions">
          <Select value={language} onChange={handleLanguageChange} style={{ width: 120 }}>
            <Select.Option value="java">Java ☕</Select.Option>
            <Select.Option value="python">Python 🐍</Select.Option>
          </Select>
          <Button icon={<IconPlus />} onClick={handleNewFile}>新建</Button>
          <Button icon={<IconFile />} onClick={() => void handleOpenFile()}>打开文件</Button>
          <Button icon={<IconFolder />} onClick={() => void handleOpenFolder()}>打开目录</Button>
          <Button icon={<IconSave />} onClick={() => void handleManualSave()}>保存</Button>
          <Button icon={<IconDownload />} onClick={() => void handleSaveAs()}>另存为</Button>
          <Button type="primary" icon={<IconPlayCircle />} onClick={() => void handleRun()} loading={isRunning}>
            运行
          </Button>
        </div>
      </div>

      <Layout className="code-layout">
        <WorkspaceSidebar
          openedFolder={openedFolder}
          fileTree={fileTree}
          recentFiles={recentFiles}
          currentFilePath={currentFilePath}
          onRefresh={() => {
            if (openedFolder) {
              void loadFolder(openedFolder);
            }
          }}
          onOpenFromTree={(filePath) => void loadCodeFile(filePath)}
          onOpenRecentFile={(filePath) => void handleOpenRecentFile(filePath)}
        />

        <Content className="code-content">
          <Card className="editor-card" bodyStyle={{ padding: 0, height: 'calc(100% - 120px)' }}>
            <div className="vscode-tabs">
              <div
                className={`tab ${!currentFilePath ? 'active' : ''}`}
                onClick={() => {
                  setCurrentFilePath(null);
                  setLanguage(draftFile.language);
                }}
              >
                <span className="tab-icon">●</span>
                <span className="tab-title">{draftFile.name}{draftFile.isModified ? ' *' : ''}</span>
              </div>
              {openedFiles.map((file) => (
                <div
                  key={file.path}
                  className={`tab ${currentFilePath === file.path ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentFilePath(file.path);
                    setLanguage(getLanguageByPath(file.path));
                  }}
                >
                  <span className="tab-icon">{file.name.endsWith('.py') ? '🐍' : '☕'}</span>
                  <span className="tab-title">{file.name}{file.isModified ? ' *' : ''}</span>
                  <button
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseFile(file.path);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={editorContent}
              onChange={(value) => handleEditorChange(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: editorFontSize,
                lineNumbers: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />

            <div className="vscode-statusbar">
              <div className="status-left">
                <span>{language.toUpperCase()}</span>
                <span>{activeFileName}</span>
              </div>
              <div className="status-right">
                <span>{lineCount} 行</span>
                <span>{charCount} 字符</span>
                <span>{formatSaveStatus()}</span>
              </div>
            </div>
          </Card>

          <RunOutputCard
            output={output}
            executionTime={executionTime}
            onCopy={copyOutput}
          />
        </Content>
      </Layout>
    </div>
  );
}

export default CodeRunner;
