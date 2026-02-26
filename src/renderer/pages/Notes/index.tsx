import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Layout,
  Button,
  Input,
  Modal,
  Empty,
  Tooltip,
  Dropdown,
  Menu,
  Message,
  Divider,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconSearch,
  IconSave,
  IconFolder,
  IconFile,
  IconDownload,
  IconMore,
  IconMenu,
  IconArchive,
  IconImage,
} from '@arco-design/web-react/icon';
import MilkdownEditor, {
  HeadingItem,
  MilkdownEditorHandle,
  SearchOptions,
  SearchState,
} from '../../components/MilkdownEditor';
import Outline from '../../components/Outline';
import NotesSidebar, { NoteTreeNode } from './components/NotesSidebar';
import OpenTabsBar from './components/OpenTabsBar';
import FindReplacePanel from './components/FindReplacePanel';
import {
  useNotesMenus,
  type NotesImagePathMode,
  type NotesPdfPageSize,
  type NotesPdfTheme,
} from './hooks/useNotesMenus';
import './styles.css';

const { Content } = Layout;

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface OpenedFile {
  path: string;
  name: string;
  content: string;
  isModified: boolean;
}

type ImagePathMode = NotesImagePathMode;
type PdfPageSize = NotesPdfPageSize;
type PdfTheme = NotesPdfTheme;

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.txt'];
const DEFAULT_FIND_STATE: SearchState = { total: 0, currentIndex: -1 };
const DEFAULT_PDF_CUSTOM_CSS = `.markdown-body {
  font-family: "Times New Roman", "Songti SC", serif;
  line-height: 1.7;
}

.markdown-body h1, .markdown-body h2 {
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.3em;
}`;

function Notes() {
  const [openedFolder, setOpenedFolder] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [openedFiles, setOpenedFiles] = useState<OpenedFile[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  const [editingContent, setEditingContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingFile, setRenamingFile] = useState<{ path: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');

  const [imagePathMode, setImagePathMode] = useState<ImagePathMode>('file-relative');
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>('A4');
  const [pdfPrintBackground, setPdfPrintBackground] = useState(true);
  const [pdfTheme, setPdfTheme] = useState<PdfTheme>('typora');
  const [pdfCustomCss, setPdfCustomCss] = useState(DEFAULT_PDF_CUSTOM_CSS);
  const [pdfCustomCssDraft, setPdfCustomCssDraft] = useState(DEFAULT_PDF_CUSTOM_CSS);
  const [showPdfTemplateModal, setShowPdfTemplateModal] = useState(false);
  const [outlineMaxLevel, setOutlineMaxLevel] = useState(6);
  const [showFindBar, setShowFindBar] = useState(false);
  const [showReplaceBar, setShowReplaceBar] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findRegex, setFindRegex] = useState(false);
  const [findState, setFindState] = useState<SearchState>(DEFAULT_FIND_STATE);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<MilkdownEditorHandle | null>(null);

  const loadRecentFiles = async () => {
    try {
      const saved = await window.electronAPI.settings.get('recentFiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentFiles(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load recent files:', error);
    }
  };

  const loadNotesPreferences = async (): Promise<string | null> => {
    try {
      const [imageMode, pageSize, printBackground, theme, customCss, outlineLevel, autoSave, notesRootFolder] = await Promise.all([
        window.electronAPI.settings.get('notesImagePathMode'),
        window.electronAPI.settings.get('notesPdfPageSize'),
        window.electronAPI.settings.get('notesPdfPrintBackground'),
        window.electronAPI.settings.get('notesPdfTheme'),
        window.electronAPI.settings.get('notesPdfCustomCss'),
        window.electronAPI.settings.get('notesOutlineMaxLevel'),
        window.electronAPI.settings.get('autoSave'),
        window.electronAPI.settings.get('notesRootFolder'),
      ]);

      if (imageMode === 'app-relative' || imageMode === 'file-relative') {
        setImagePathMode(imageMode);
      }
      if (pageSize === 'A4' || pageSize === 'Letter') {
        setPdfPageSize(pageSize);
      }
      if (printBackground === 'true' || printBackground === 'false') {
        setPdfPrintBackground(printBackground === 'true');
      }
      if (theme === 'typora' || theme === 'github' || theme === 'custom') {
        setPdfTheme(theme);
      }
      if (typeof customCss === 'string' && customCss.trim()) {
        setPdfCustomCss(customCss);
        setPdfCustomCssDraft(customCss);
      }
      const parsedOutlineLevel = Number(outlineLevel);
      if (Number.isFinite(parsedOutlineLevel) && parsedOutlineLevel >= 1 && parsedOutlineLevel <= 6) {
        setOutlineMaxLevel(parsedOutlineLevel);
      }

      if (autoSave === 'false') {
        setAutoSaveEnabled(false);
      } else if (autoSave === 'true') {
        setAutoSaveEnabled(true);
      }

      if (typeof notesRootFolder === 'string' && notesRootFolder.trim()) {
        return notesRootFolder;
      }
    } catch (error) {
      console.error('Failed to load notes preferences:', error);
    }
    return null;
  };

  const saveRecentFiles = useCallback(async (files: string[]) => {
    try {
      await window.electronAPI.settings.set('recentFiles', JSON.stringify(files), 'notes');
    } catch (error) {
      console.error('Failed to save recent files:', error);
    }
  }, []);

  const saveNotesPreference = async (key: string, value: string) => {
    try {
      await window.electronAPI.settings.set(key, value, 'notes');
    } catch (error) {
      console.error(`Failed to save notes preference (${key}):`, error);
    }
  };

  const saveImagePathMode = async (mode: ImagePathMode) => {
    await saveNotesPreference('notesImagePathMode', mode);
  };

  const addToRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((p) => p !== filePath);
      const updated = [filePath, ...filtered].slice(0, 20);
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

  const buildFolderTree = useCallback(async (folderPath: string, depth = 0): Promise<FileItem[]> => {
    if (depth > 12) {
      return [];
    }

    const result = await window.electronAPI.fs.readFolder(folderPath);
    if (!result.success) {
      return [];
    }

    const folders = [...(result.folders || [])].sort((a, b) => a.name.localeCompare(b.name));

    const files = [...(result.files || [])].sort((a, b) => a.name.localeCompare(b.name));

    const folderItems = await Promise.all(
      folders.map(async (folder) => ({
        name: folder.name,
        path: folder.path,
        isDirectory: true,
        children: await buildFolderTree(folder.path, depth + 1),
      }))
    );

    const fileItems = files.map((file) => ({
      name: file.name,
      path: file.path,
      isDirectory: false,
    }));

    return [...folderItems, ...fileItems];
  }, []);

  const loadFolder = useCallback(
    async (folderPath: string) => {
      try {
        const treeData = await buildFolderTree(folderPath);
        setFileTree(treeData);
      } catch (error) {
        console.error('Failed to load folder:', error);
        Message.error('加载文件夹失败');
      }
    },
    [buildFolderTree]
  );

  useEffect(() => {
    const initialize = async () => {
      await loadRecentFiles();
      const savedRootFolder = await loadNotesPreferences();
      if (savedRootFolder) {
        setOpenedFolder(savedRootFolder);
        await loadFolder(savedRootFolder);
      }
    };

    void initialize();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [loadFolder]);

  useEffect(() => {
    if (autoSaveEnabled) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, [autoSaveEnabled]);

  useEffect(() => {
    if (!openedFolder) {
      return;
    }

    const handleFolderChange = () => {
      void loadFolder(openedFolder);
    };

    window.electronAPI.fs.onFolderChange(handleFolderChange);
    void window.electronAPI.fs.watchFolder(openedFolder);

    return () => {
      window.electronAPI.fs.removeFolderChangeListener();
      void window.electronAPI.fs.unwatchFolder(openedFolder);
    };
  }, [openedFolder, loadFolder]);

  const getFindOptions = useCallback((): SearchOptions => {
    return {
      query: findText,
      caseSensitive: findCaseSensitive,
      wholeWord: findWholeWord,
      regex: findRegex,
    };
  }, [findCaseSensitive, findRegex, findText, findWholeWord]);

  const refreshFindState = useCallback(() => {
    if (!showFindBar || !editorRef.current) {
      setFindState(DEFAULT_FIND_STATE);
      return;
    }

    const state = editorRef.current.getSearchState(getFindOptions());
    setFindState(state);
  }, [getFindOptions, showFindBar]);

  const openFindPanel = useCallback((withReplace = false) => {
    setShowFindBar(true);
    if (withReplace) {
      setShowReplaceBar(true);
    }
    setTimeout(() => {
      if (editorRef.current) {
        setFindState(editorRef.current.getSearchState(getFindOptions()));
      }
    }, 0);
  }, [getFindOptions]);

  const closeFindPanel = useCallback(() => {
    setShowFindBar(false);
    setShowReplaceBar(false);
    setFindState(DEFAULT_FIND_STATE);
  }, []);

  const handleFindNext = useCallback(() => {
    if (!editorRef.current) return;
    const state = editorRef.current.findNext(getFindOptions());
    setFindState(state);
  }, [getFindOptions]);

  const handleFindPrev = useCallback(() => {
    if (!editorRef.current) return;
    const state = editorRef.current.findPrev(getFindOptions());
    setFindState(state);
  }, [getFindOptions]);

  const handleReplaceCurrent = useCallback(() => {
    if (!editorRef.current) return;
    const state = editorRef.current.replaceCurrent(getFindOptions(), replaceText);
    setFindState(state);
  }, [getFindOptions, replaceText]);

  const handleReplaceAll = useCallback(() => {
    if (!editorRef.current) return;
    const state = editorRef.current.replaceAll(getFindOptions(), replaceText);
    setFindState(state);
    if (state.replacedCount > 0) {
      Message.success(`已替换 ${state.replacedCount} 处`);
    }
  }, [getFindOptions, replaceText]);

  useEffect(() => {
    if (!showFindBar) return;
    refreshFindState();
  }, [editingContent, showFindBar, currentFilePath, findText, findCaseSensitive, findWholeWord, findRegex, refreshFindState]);

  const handleOpenFolder = async () => {
    try {
      const result = await window.electronAPI.fs.openFolder();
      if (result.success && result.folderPath) {
        setOpenedFolder(result.folderPath);
        await window.electronAPI.settings.set('notesRootFolder', result.folderPath, 'notes');
        await loadFolder(result.folderPath);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      Message.error('打开文件夹失败');
    }
  };

  const loadSingleFile = useCallback(async (filePath: string) => {
    try {
      const result = await window.electronAPI.fs.readFile(filePath);
      if (result.success) {
        const fileContent = result.content ?? '';
        const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        setOpenedFolder(dir);
        await window.electronAPI.settings.set('notesRootFolder', dir, 'notes');

        const newFile: OpenedFile = {
          path: filePath,
          name: filePath.split(/[\\/]/).pop() || filePath,
          content: fileContent,
          isModified: false,
        };

        setOpenedFiles((prev) => {
          const existing = prev.find((f) => f.path === filePath);
          if (existing) {
            return prev.map((f) => (f.path === filePath ? { ...f, content: fileContent, isModified: false } : f));
          }
          return [...prev, newFile];
        });
        setCurrentFilePath(filePath);
        setEditingContent(fileContent);
        await loadFolder(dir);
      }
    } catch (error) {
      console.error('Failed to read file:', error);
      Message.error('读取文件失败');
    }
  }, [loadFolder]);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await window.electronAPI.fs.openFile();
      if (result.success && result.filePath) {
        await loadSingleFile(result.filePath);
        addToRecentFiles(result.filePath);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      Message.error('打开文件失败');
    }
  }, [addToRecentFiles, loadSingleFile]);

  const handleSaveAs = useCallback(async () => {
    try {
      const defaultName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'untitled.md';
      const result = await window.electronAPI.fs.saveFileDialog(editingContent, defaultName);
      if (result.success && result.filePath) {
        await loadSingleFile(result.filePath);
        addToRecentFiles(result.filePath);
        Message.success('文件已保存');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      Message.error('保存文件失败');
    }
  }, [addToRecentFiles, currentFilePath, editingContent, loadSingleFile]);

  const handleFileSelect = async (filePath: string) => {
    const existingFile = openedFiles.find((f) => f.path === filePath);
    if (existingFile) {
      setCurrentFilePath(filePath);
      setEditingContent(existingFile.content);
      return;
    }

    await loadSingleFile(filePath);
    addToRecentFiles(filePath);
  };

  const saveFile = useCallback(async (filePath: string, content: string, silent = false) => {
    setIsSaving(true);
    try {
      const result = await window.electronAPI.fs.writeFile(filePath, content);
      if (result.success) {
        setOpenedFiles((prev) => prev.map((f) => (f.path === filePath ? { ...f, isModified: false } : f)));
        if (!silent) {
          Message.success('已保存');
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      Message.error('保存文件失败');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleContentChange = useCallback(
    (content: string) => {
      setEditingContent(content);

      if (currentFilePath) {
        setOpenedFiles((prev) => prev.map((f) => (f.path === currentFilePath ? { ...f, content, isModified: true } : f)));
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      if (!autoSaveEnabled) {
        return;
      }

      autoSaveTimerRef.current = setTimeout(() => {
        if (currentFilePath) {
          void saveFile(currentFilePath, content, true);
        }
      }, 1500);
    },
    [autoSaveEnabled, currentFilePath, saveFile]
  );

  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (currentFilePath) {
      void saveFile(currentFilePath, editingContent);
    } else {
      void handleSaveAs();
    }
  }, [currentFilePath, editingContent, handleSaveAs, saveFile]);

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      Message.warning('请输入文件名');
      return;
    }

    const folderPath =
      openedFolder ||
      (currentFilePath
        ? currentFilePath.substring(0, Math.max(currentFilePath.lastIndexOf('/'), currentFilePath.lastIndexOf('\\')))
        : null);

    if (!folderPath) {
      Message.warning('请先打开文件夹或文件');
      return;
    }

    try {
      const result = await window.electronAPI.fs.createFile(
        folderPath,
        newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`
      );
      if (result.success) {
        setNewFileName('');
        setShowNewFileModal(false);
        await loadFolder(folderPath);
        if (result.filePath) {
          await handleFileSelect(result.filePath);
        }
      } else {
        Message.error(result.error || '创建文件失败');
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      Message.error('创建文件失败');
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文件吗？此操作无法撤销。',
      onOk: async () => {
        try {
          await window.electronAPI.fs.deleteFile(filePath);
          closeFileTab(filePath);
          removeFromRecentFiles(filePath);
          if (openedFolder) {
            await loadFolder(openedFolder);
          }
        } catch (error) {
          console.error('Failed to delete file:', error);
          Message.error('删除文件失败');
        }
      },
    });
  };

  const closeFileTab = useCallback((filePath: string) => {
    setOpenedFiles((prev) => {
      const closingIndex = prev.findIndex((file) => file.path === filePath);
      const remaining = prev.filter((file) => file.path !== filePath);

      if (currentFilePath === filePath) {
        const targetIndex = Math.max(0, closingIndex - 1);
        const nextFile = remaining[targetIndex] || remaining[0] || null;
        setCurrentFilePath(nextFile?.path || null);
        setEditingContent(nextFile?.content || '');
      }

      return remaining;
    });
  }, [currentFilePath]);

  const handleCloseFile = useCallback((filePath: string) => {
    const file = openedFiles.find((f) => f.path === filePath);
    if (file?.isModified) {
      Modal.confirm({
        title: '文件未保存',
        content: '文件有未保存的更改，是否保存？',
        okText: '保存',
        cancelText: '不保存',
        onOk: async () => {
          await saveFile(filePath, file.content);
          closeFileTab(filePath);
        },
        onCancel: () => {
          closeFileTab(filePath);
        },
      });
    } else {
      closeFileTab(filePath);
    }
  }, [closeFileTab, openedFiles, saveFile]);

  const getCurrentFileName = () => {
    if (!currentFilePath) return '未打开文件';
    return currentFilePath.split(/[\\/]/).pop();
  };

  const handleImagePathModeChange = (mode: ImagePathMode) => {
    setImagePathMode(mode);
    void saveImagePathMode(mode);
  };

  const handlePdfPageSizeChange = (size: PdfPageSize) => {
    setPdfPageSize(size);
    void saveNotesPreference('notesPdfPageSize', size);
  };

  const handlePdfPrintBackgroundChange = (enabled: boolean) => {
    setPdfPrintBackground(enabled);
    void saveNotesPreference('notesPdfPrintBackground', enabled ? 'true' : 'false');
  };

  const handlePdfThemeChange = (theme: PdfTheme) => {
    setPdfTheme(theme);
    void saveNotesPreference('notesPdfTheme', theme);
  };

  const openPdfTemplateModal = () => {
    setPdfCustomCssDraft(pdfCustomCss);
    setShowPdfTemplateModal(true);
  };

  const handleSavePdfTemplate = () => {
    const nextCss = pdfCustomCssDraft.trim() ? pdfCustomCssDraft : DEFAULT_PDF_CUSTOM_CSS;
    setPdfCustomCss(nextCss);
    setPdfCustomCssDraft(nextCss);
    setShowPdfTemplateModal(false);
    void saveNotesPreference('notesPdfCustomCss', nextCss);
    Message.success('已保存 PDF 模板');
  };

  const handleOutlineMaxLevelChange = (level: number) => {
    const nextLevel = Math.min(6, Math.max(1, level));
    setOutlineMaxLevel(nextLevel);
    void saveNotesPreference('notesOutlineMaxLevel', String(nextLevel));
  };

  const handleInsertTable = useCallback(() => {
    if (!currentFilePath) {
      Message.warning('请先打开一个 Markdown 文件');
      return;
    }
    editorRef.current?.insertTable(2, 3);
  }, [currentFilePath]);

  const handleInsertCodeBlock = useCallback((language = '') => {
    if (!currentFilePath) {
      Message.warning('请先打开一个 Markdown 文件');
      return;
    }
    editorRef.current?.insertCodeBlock(language);
  }, [currentFilePath]);

  const handleDeleteCurrentTable = useCallback(() => {
    if (!currentFilePath) {
      Message.warning('请先打开一个 Markdown 文件');
      return;
    }
    const deleted = editorRef.current?.deleteCurrentTable();
    if (!deleted) {
      Message.warning('当前光标不在表格中');
    }
  }, [currentFilePath]);
  const { settingsMenu } = useNotesMenus({
    showSidebar,
    setShowSidebar,
    showOutline,
    setShowOutline,
    focusMode,
    setFocusMode,
    typewriterMode,
    setTypewriterMode,
    imagePathMode,
    handleImagePathModeChange,
    outlineMaxLevel,
    handleOutlineMaxLevelChange,
    pdfTheme,
    handlePdfThemeChange,
    openPdfTemplateModal,
    pdfPageSize,
    handlePdfPageSizeChange,
    pdfPrintBackground,
    handlePdfPrintBackgroundChange,
    handleInsertCodeBlock,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void handleSaveAs();
        } else {
          handleManualSave();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        void handleOpenFile();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewFileModal(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && currentFilePath) {
        e.preventDefault();
        handleCloseFile(currentFilePath);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (!currentFilePath) {
          Message.warning('请先打开一个 Markdown 文件');
          return;
        }
        void editorRef.current?.insertImageFromDialog();
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleInsertTable();
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleInsertCodeBlock();
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteCurrentTable();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !e.altKey) {
        e.preventDefault();
        openFindPanel(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFindPanel(true);
      }
      if (showFindBar && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleFindPrev();
        } else {
          handleFindNext();
        }
      }
      if (showFindBar && e.key === 'Escape') {
        e.preventDefault();
        closeFindPanel();
      }
      if (showFindBar && e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (e.shiftKey) {
          handleFindPrev();
        } else {
          handleFindNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    closeFindPanel,
    handleCloseFile,
    handleDeleteCurrentTable,
    handleInsertCodeBlock,
    handleInsertTable,
    currentFilePath,
    handleFindNext,
    handleFindPrev,
    handleManualSave,
    handleOpenFile,
    handleSaveAs,
    openFindPanel,
    showFindBar,
  ]);

  const handleRename = async () => {
    if (!renamingFile || !newName.trim()) return;
    const oldPath = renamingFile.path;
    const lastSlash = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'));
    const dir = oldPath.substring(0, lastSlash);
    const isMd = renamingFile.name.endsWith('.md');

    let finalName = newName;
    if (isMd && !newName.endsWith('.md')) {
      finalName += '.md';
    }

    const pathSep = oldPath.includes('\\') ? '\\' : '/';
    const newPath = `${dir}${pathSep}${finalName}`;

    try {
      const result = await window.electronAPI.fs.renameFile(oldPath, newPath);
      if (result.success) {
        setRenameModalVisible(false);
        setRenamingFile(null);
        setNewName('');
        if (openedFolder) await loadFolder(openedFolder);

        setOpenedFiles((prev) =>
          prev.map((f) => {
            if (f.path === oldPath) {
              return { ...f, path: newPath, name: finalName };
            }
            return f;
          })
        );

        if (currentFilePath === oldPath) {
          setCurrentFilePath(newPath);
        }
        Message.success('重命名成功');
      } else {
        Message.error(result.error || '重命名失败');
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      Message.error('重命名失败');
    }
  };

  const handleRevealFile = async (filePath: string) => {
    try {
      await window.electronAPI.fs.reveal(filePath);
    } catch (error) {
      console.error('Failed to reveal file:', error);
    }
  };

  const handleExportPDF = async () => {
    const title = getCurrentFileName()?.replace('.md', '') || 'document';
    if (!editingContent) {
      Message.warning('没有可导出的内容');
      return;
    }

    const hide = Message.loading('正在导出 PDF...');
    try {
      const result = await window.electronAPI.export.toPDFAdvanced(editingContent, title, {
        pageSize: pdfPageSize,
        printBackground: pdfPrintBackground,
        theme: pdfTheme,
        customCss: pdfTheme === 'custom' ? pdfCustomCss : undefined,
      });
      hide();
      if (result.success) {
        Message.success('导出 PDF 成功');
      } else if (result.error) {
        Message.error(`导出 PDF 失败: ${result.error}`);
      }
    } catch (error) {
      hide();
      console.error('Failed to export PDF:', error);
      Message.error('导出 PDF 失败');
    }
  };

  const exportMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item key="saveAs" onClick={() => void handleSaveAs()}>
          另存为 (Shift+Cmd+S)
        </Menu.Item>
        <Menu.Item key="exportPdf" onClick={() => void handleExportPDF()} disabled={!editingContent}>
          导出 PDF
        </Menu.Item>
      </Menu>
    ),
    [editingContent, handleExportPDF, handleSaveAs]
  );

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isSupported = MARKDOWN_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      const droppedPath = (file as File & { path?: string }).path;
      if (isSupported && droppedPath) {
        await loadSingleFile(droppedPath);
        addToRecentFiles(droppedPath);
      }
    }
  };

  const renderContextMenu = (item: FileItem) => (
    <Menu>
      <Menu.Item
        key="rename"
        onClick={(e) => {
          e.stopPropagation();
          setRenamingFile({ path: item.path, name: item.name });
          setNewName(item.name);
          setRenameModalVisible(true);
        }}
      >
        重命名
      </Menu.Item>
      <Menu.Item
        key="reveal"
        onClick={(e) => {
          e.stopPropagation();
          void handleRevealFile(item.path);
        }}
      >
        在访达中显示
      </Menu.Item>
      {!item.isDirectory && (
        <Menu.Item
          key="delete"
          onClick={(e) => {
            e.stopPropagation();
            void handleDeleteFile(item.path);
          }}
        >
          <span style={{ color: 'var(--danger-soft)' }}>删除</span>
        </Menu.Item>
      )}
    </Menu>
  );

  const handleOpenRecentFile = async (filePath: string) => {
    const existsResult = await window.electronAPI.fs.fileExists(filePath);
    if (!existsResult.success || !existsResult.exists) {
      removeFromRecentFiles(filePath);
      Message.warning('文件不存在，已从最近列表移除');
      return;
    }
    await handleFileSelect(filePath);
  };

  const renderFileTree = (data: FileItem[]): NoteTreeNode[] => {
    return data.map((item) => ({
      title: (
        <Dropdown droplist={renderContextMenu(item)} trigger="contextMenu" position="bl">
          <span className={`file-tree-item ${item.isDirectory ? 'folder' : 'file'}`}>
            {item.isDirectory ? <IconFolder /> : <IconFile />}
            {item.name}
          </span>
        </Dropdown>
      ),
      key: item.path,
      isLeaf: !item.isDirectory,
      children: item.children ? renderFileTree(item.children) : undefined,
    }));
  };

  const getCurrentFileDir = () => {
    if (currentFilePath) {
      const lastSlash = Math.max(currentFilePath.lastIndexOf('/'), currentFilePath.lastIndexOf('\\'));
      if (lastSlash !== -1) {
        return currentFilePath.substring(0, lastSlash);
      }
    }
    return undefined;
  };

  const getImageSavePath = () => {
    if (imagePathMode === 'app-relative') {
      return undefined;
    }
    return getCurrentFileDir();
  };

  const handleInsertImage = async () => {
    if (!currentFilePath) {
      Message.warning('请先打开一个 Markdown 文件');
      return;
    }

    try {
      await editorRef.current?.insertImageFromDialog();
    } catch (error) {
      console.error('Failed to insert image:', error);
      Message.error('插入图片失败');
    }
  };

  const renderFindStatus = () => {
    if (findState.error) {
      return findState.error;
    }
    if (findState.total <= 0) {
      return '0/0';
    }
    const current = findState.currentIndex >= 0 ? findState.currentIndex + 1 : 0;
    return `${current}/${findState.total}`;
  };

  const sidebarTree = renderFileTree(fileTree);

  return (
    <div className={`notes-page ${focusMode ? 'focus-mode' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
      <div className="notes-header typora-header">
        <div className="header-left">
          <IconFile style={{ marginRight: 8, opacity: 0.6 }} />
          <span className="current-file-name">{getCurrentFileName()}</span>
          {currentFilePath && (
            <span className="file-path" title={currentFilePath}>
              {currentFilePath}
            </span>
          )}
        </div>

        <div className="header-right">
          <Tooltip content="打开文件 (Cmd+O)">
            <Button icon={<IconArchive />} onClick={handleOpenFile}>
              <span className="header-action-label">打开</span>
            </Button>
          </Tooltip>
          <Tooltip content="打开文件夹">
            <Button icon={<IconFolder />} onClick={handleOpenFolder}>
              <span className="header-action-label">文件夹</span>
            </Button>
          </Tooltip>
          <Tooltip content="新建文件 (Cmd+N)">
            <Button icon={<IconPlus />} onClick={() => setShowNewFileModal(true)}>
              <span className="header-action-label">新建</span>
            </Button>
          </Tooltip>
          <Tooltip content="保存 (Cmd+S)">
            <Button icon={<IconSave />} onClick={handleManualSave} loading={isSaving}>
              <span className="header-action-label">保存</span>
            </Button>
          </Tooltip>
          <Tooltip content="查找 (Cmd+F)">
            <Button icon={<IconSearch />} onClick={() => openFindPanel(false)} />
          </Tooltip>
          <Tooltip content="插入图片 (Shift+Cmd+I)">
            <Button icon={<IconImage />} onClick={handleInsertImage} disabled={!currentFilePath} />
          </Tooltip>
          <Dropdown droplist={exportMenu} position="bottom">
            <Button icon={<IconDownload />}>导出</Button>
          </Dropdown>
          <Divider type="vertical" />
          <Tooltip content="侧边栏 (Cmd+B)">
            <Button icon={<IconMenu />} onClick={() => setShowSidebar(!showSidebar)} />
          </Tooltip>
          <Dropdown droplist={settingsMenu} position="bottom">
            <Button icon={<IconMore />} />
          </Dropdown>
        </div>
      </div>

      <Layout className={`notes-layout ${showSidebar ? '' : 'sidebar-hidden'}`}>
        <NotesSidebar
          showSidebar={showSidebar}
          openedFolder={openedFolder}
          fileTree={sidebarTree}
          onSelectFile={(path) => void handleFileSelect(path)}
          recentFiles={recentFiles}
          onOpenRecentFile={(path) => void handleOpenRecentFile(path)}
        />

        <Content className="notes-content">
          {openedFiles.length > 0 ? (
            <>
              <OpenTabsBar
                openedFiles={openedFiles}
                currentFilePath={currentFilePath}
                onSelect={(path) => void handleFileSelect(path)}
                onClose={handleCloseFile}
              />

              {showFindBar && (
                <FindReplacePanel
                  findText={findText}
                  replaceText={replaceText}
                  showReplaceBar={showReplaceBar}
                  findCaseSensitive={findCaseSensitive}
                  findWholeWord={findWholeWord}
                  findRegex={findRegex}
                  findStatusText={renderFindStatus()}
                  hasFindError={Boolean(findState.error)}
                  onFindTextChange={setFindText}
                  onReplaceTextChange={setReplaceText}
                  onFindPrev={handleFindPrev}
                  onFindNext={handleFindNext}
                  onToggleReplaceBar={() => setShowReplaceBar((prev) => !prev)}
                  onClose={closeFindPanel}
                  onToggleCaseSensitive={() => setFindCaseSensitive((prev) => !prev)}
                  onToggleWholeWord={() => setFindWholeWord((prev) => !prev)}
                  onToggleRegex={() => setFindRegex((prev) => !prev)}
                  onReplaceCurrent={handleReplaceCurrent}
                  onReplaceAll={handleReplaceAll}
                />
              )}

              <div className="notes-editor-container">
                <div className="notes-editor-main">
                  <MilkdownEditor
                    ref={editorRef}
                    key={currentFilePath}
                    value={editingContent}
                    onChange={handleContentChange}
                    onSave={handleManualSave}
                    onHeadingsChange={setHeadings}
                    onActiveHeadingChange={setActiveHeadingId}
                    focusMode={focusMode}
                    typewriterMode={typewriterMode}
                    imageSavePath={getImageSavePath()}
                    currentFileDir={getCurrentFileDir()}
                  />
                </div>
                {showOutline && (
                  <Outline
                    headings={headings}
                    activeHeadingId={activeHeadingId}
                    maxLevel={outlineMaxLevel}
                    onHeadingClick={(id) => editorRef.current?.scrollToHeading(id)}
                    visible={showOutline}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="notes-empty-wrapper">
              <Empty
                description={
                  <div className="empty-state">
                    <IconFile style={{ fontSize: 64, marginBottom: 16 }} />
                    <p>打开 Markdown 文件开始编辑</p>
                    <div className="empty-actions">
                      <Button type="primary" icon={<IconArchive />} onClick={handleOpenFile}>
                        打开文件
                      </Button>
                      <Button icon={<IconFolder />} onClick={handleOpenFolder}>
                        打开文件夹
                      </Button>
                    </div>
                  </div>
                }
                style={{ marginTop: 0 }}
              />
            </div>
          )}
        </Content>
      </Layout>

      <Modal
        title="新建文件"
        visible={showNewFileModal}
        onOk={handleCreateFile}
        onCancel={() => {
          setShowNewFileModal(false);
          setNewFileName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="文件名 (例如: note.md)"
          value={newFileName}
          onChange={setNewFileName}
          onPressEnter={handleCreateFile}
          autoFocus
        />
      </Modal>

      <Modal
        title="PDF 模板 CSS"
        visible={showPdfTemplateModal}
        onOk={handleSavePdfTemplate}
        onCancel={() => {
          setShowPdfTemplateModal(false);
          setPdfCustomCssDraft(pdfCustomCss);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Input.TextArea
          value={pdfCustomCssDraft}
          onChange={setPdfCustomCssDraft}
          placeholder="输入自定义 CSS，用于 PDF 导出"
          autoSize={{ minRows: 12, maxRows: 22 }}
        />
      </Modal>

      <Modal
        title="重命名"
        visible={renameModalVisible}
        onOk={handleRename}
        onCancel={() => {
          setRenameModalVisible(false);
          setRenamingFile(null);
          setNewName('');
        }}
      >
        <Input value={newName} onChange={setNewName} onPressEnter={handleRename} autoFocus />
      </Modal>
    </div>
  );
}

export default Notes;
