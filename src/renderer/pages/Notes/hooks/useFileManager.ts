import { useState, useCallback, useEffect, useRef } from 'react';
import { Message, Modal } from '@arco-design/web-react';

export interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileItem[];
}

export interface OpenedFile {
    path: string;
    name: string;
    content: string;
    isModified: boolean;
}

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.txt'];

export function useFileManager(options?: {
    onFileSelect?: (filePath: string) => void;
    autoSaveEnabled?: boolean;
}) {
    const [openedFolder, setOpenedFolder] = useState<string | null>(null);
    const [fileTree, setFileTree] = useState<FileItem[]>([]);
    const [openedFiles, setOpenedFiles] = useState<OpenedFile[]>([]);
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [recentFiles, setRecentFiles] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const saveRecentFiles = useCallback(async (files: string[]) => {
        try {
            await window.electronAPI.settings.set('recentFiles', JSON.stringify(files), 'notes');
        } catch (error) {
            console.error('Failed to save recent files:', error);
        }
    }, []);

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

    // File loading logic
    const buildFolderTree = useCallback(async (folderPath: string, depth = 0): Promise<FileItem[]> => {
        if (depth > 12) return [];

        const result = await window.electronAPI.fs.readFolder(folderPath);
        if (!result.success) return [];

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

    const loadSingleFile = useCallback(async (filePath: string): Promise<string | null> => {
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
                await loadFolder(dir);
                return fileContent;
            }
            return null;
        } catch (error) {
            console.error('Failed to read file:', error);
            Message.error('读取文件失败');
            return null;
        }
    }, [loadFolder]);

    const handleFileSelect = useCallback(async (filePath: string) => {
        const existingFile = openedFiles.find((f) => f.path === filePath);
        if (existingFile) {
            setCurrentFilePath(filePath);
            options?.onFileSelect?.(filePath);
            return;
        }
        await loadSingleFile(filePath);
        addToRecentFiles(filePath);
        options?.onFileSelect?.(filePath);
    }, [openedFiles, loadSingleFile, addToRecentFiles, options]);

    const handleOpenFolder = useCallback(async () => {
        try {
            const result = await window.electronAPI.fs.openFolderDialog();
            if (result.success && result.folderPath) {
                setOpenedFolder(result.folderPath);
                await window.electronAPI.settings.set('notesRootFolder', result.folderPath, 'notes');
                await loadFolder(result.folderPath);
            }
        } catch (error) {
            console.error('Failed to open folder:', error);
            Message.error('打开文件夹失败');
        }
    }, [loadFolder]);

    const handleOpenFile = useCallback(async () => {
        try {
            const result = await window.electronAPI.fs.openFile();
            if (result.success && result.filePath) {
                await loadSingleFile(result.filePath);
                addToRecentFiles(result.filePath);
                options?.onFileSelect?.(result.filePath);
            }
        } catch (error) {
            console.error('Failed to open file:', error);
            Message.error('打开文件失败');
        }
    }, [loadSingleFile, addToRecentFiles, options]);

    const handleSaveAs = useCallback(async (editingContent: string) => {
        try {
            const defaultName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'untitled.md';
            const result = await window.electronAPI.fs.saveFileDialog(editingContent, defaultName);
            if (result.success && result.filePath) {
                await loadSingleFile(result.filePath);
                addToRecentFiles(result.filePath);
                options?.onFileSelect?.(result.filePath);
                Message.success('文件已保存');
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            Message.error('保存文件失败');
        }
    }, [currentFilePath, loadSingleFile, addToRecentFiles, options]);

    // Folder watch
    useEffect(() => {
        if (!openedFolder) return;
        const handleFolderChange = () => void loadFolder(openedFolder);
        window.electronAPI.fs.onFolderChange(handleFolderChange);
        void window.electronAPI.fs.watchFolder(openedFolder);

        return () => {
            window.electronAPI.fs.removeFolderChangeListener();
            void window.electronAPI.fs.unwatchFolder(openedFolder);
        };
    }, [openedFolder, loadFolder]);

    // Saving logic
    const saveFile = useCallback(async (filePath: string, content: string, silent = false) => {
        setIsSaving(true);
        try {
            const result = await window.electronAPI.fs.writeFile(filePath, content);
            if (result.success) {
                setOpenedFiles((prev) => prev.map((f) => (f.path === filePath ? { ...f, isModified: false, content } : f)));
                if (!silent) Message.success('已保存');
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            Message.error('保存文件失败');
        } finally {
            setIsSaving(false);
        }
    }, []);

    const closeFileTab = useCallback((filePath: string) => {
        setOpenedFiles((prev) => {
            const closingIndex = prev.findIndex((file) => file.path === filePath);
            const remaining = prev.filter((file) => file.path !== filePath);

            if (currentFilePath === filePath) {
                const targetIndex = Math.max(0, closingIndex - 1);
                const nextFile = remaining[targetIndex] || remaining[0] || null;
                setCurrentFilePath(nextFile?.path || null);
                options?.onFileSelect?.(nextFile?.path || '');
            }
            return remaining;
        });
    }, [currentFilePath, options]);

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
                onCancel: () => closeFileTab(filePath),
            });
        } else {
            closeFileTab(filePath);
        }
    }, [closeFileTab, openedFiles, saveFile]);

    // Helper getters
    const getCurrentFileName = () => {
        if (!currentFilePath) return '未打开文件';
        return currentFilePath.split(/[\\/]/).pop();
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

    return {
        openedFolder,
        setOpenedFolder,
        fileTree,
        openedFiles,
        setOpenedFiles,
        currentFilePath,
        setCurrentFilePath,
        recentFiles,
        setRecentFiles,
        isSaving,
        loadFolder,
        loadSingleFile,
        saveFile,
        closeFileTab,
        handleCloseFile,
        handleOpenFolder,
        handleOpenFile,
        handleSaveAs,
        handleFileSelect,
        removeFromRecentFiles,
        getCurrentFileName,
        getCurrentFileDir,
    };
}
