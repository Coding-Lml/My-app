import React from 'react';
import { Button, Tooltip, Dropdown, Menu } from '@arco-design/web-react';
import {
    IconFile,
    IconArchive,
    IconFolder,
    IconPlus,
    IconSave,
    IconSearch,
    IconImage,
    IconDownload,
    IconMenu,
    IconMore,
} from '@arco-design/web-react/icon';

interface NotesHeaderProps {
    currentFileName: string | undefined;
    currentFilePath: string | null;
    isSaving: boolean;
    showSidebar: boolean;
    setShowSidebar: (v: boolean) => void;
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onNewFile: () => void;
    onManualSave: () => void;
    onOpenFindPanel: () => void;
    onInsertImage: () => void;
    exportMenu: React.ReactElement;
    settingsMenu: React.ReactElement;
}

export function NotesHeader({
    currentFileName,
    currentFilePath,
    isSaving,
    showSidebar,
    setShowSidebar,
    onOpenFile,
    onOpenFolder,
    onNewFile,
    onManualSave,
    onOpenFindPanel,
    onInsertImage,
    exportMenu,
    settingsMenu,
}: NotesHeaderProps) {
    return (
        <div className="notes-header typora-header">
            <div className="header-left">
                <IconFile style={{ marginRight: 8, opacity: 0.6 }} />
                <span className="current-file-name">{currentFileName}</span>
                {currentFilePath && (
                    <span className="file-path" title={currentFilePath}>
                        {currentFilePath}
                    </span>
                )}
            </div>

            <div className="header-right">
                <div className="notes-action-group">
                    <Tooltip content="打开文件 (Cmd+O)">
                        <Button icon={<IconArchive />} onClick={onOpenFile}>
                            <span className="header-action-label">打开</span>
                        </Button>
                    </Tooltip>
                    <Tooltip content="打开文件夹">
                        <Button icon={<IconFolder />} onClick={onOpenFolder}>
                            <span className="header-action-label">文件夹</span>
                        </Button>
                    </Tooltip>
                    <Tooltip content="新建文件 (Cmd+N)">
                        <Button icon={<IconPlus />} onClick={onNewFile}>
                            <span className="header-action-label">新建</span>
                        </Button>
                    </Tooltip>
                    <Tooltip content="保存 (Cmd+S)">
                        <Button icon={<IconSave />} onClick={onManualSave} loading={isSaving}>
                            <span className="header-action-label">保存</span>
                        </Button>
                    </Tooltip>
                </div>

                <div className="notes-action-group">
                    <Tooltip content="查找 (Cmd+F)">
                        <Button icon={<IconSearch />} onClick={onOpenFindPanel} />
                    </Tooltip>
                    <Tooltip content="插入图片 (Shift+Cmd+I)">
                        <Button icon={<IconImage />} onClick={onInsertImage} disabled={!currentFilePath} />
                    </Tooltip>
                    <Dropdown droplist={exportMenu} position="bottom">
                        <Button icon={<IconDownload />}>导出</Button>
                    </Dropdown>
                </div>

                <div className="notes-action-group notes-action-group-utility">
                    <Tooltip content="侧边栏 (Cmd+B)">
                        <Button icon={<IconMenu />} onClick={() => setShowSidebar(!showSidebar)} />
                    </Tooltip>
                    <Dropdown droplist={settingsMenu} position="bottom">
                        <Button icon={<IconMore />} />
                    </Dropdown>
                </div>
            </div>
        </div>
    );
}

export default NotesHeader;
