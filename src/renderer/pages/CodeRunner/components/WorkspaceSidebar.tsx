import { Button, Empty } from '@arco-design/web-react';
import { IconFile, IconFolder, IconRefresh } from '@arco-design/web-react/icon';

export interface WorkspaceFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: WorkspaceFileItem[];
}

interface WorkspaceSidebarProps {
  openedFolder: string | null;
  fileTree: WorkspaceFileItem[];
  recentFiles: string[];
  currentFilePath: string | null;
  onRefresh: () => void;
  onOpenFromTree: (filePath: string) => void;
  onOpenRecentFile: (filePath: string) => void;
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function renderFileTree(
  items: WorkspaceFileItem[],
  currentFilePath: string | null,
  onOpenFromTree: (filePath: string) => void,
  depth = 0
): React.ReactNode {
  return items.map(item => {
    if (item.isDirectory) {
      return (
        <div key={item.path}>
          <div className="tree-item tree-folder" style={{ paddingLeft: 12 + depth * 14 }}>
            <IconFolder />
            <span>{item.name}</span>
          </div>
          {item.children && item.children.length > 0
            ? renderFileTree(item.children, currentFilePath, onOpenFromTree, depth + 1)
            : null}
        </div>
      );
    }

    return (
      <div
        key={item.path}
        className={`tree-item tree-file ${currentFilePath === item.path ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onOpenFromTree(item.path)}
      >
        <IconFile />
        <span>{item.name}</span>
      </div>
    );
  });
}

function WorkspaceSidebar({
  openedFolder,
  fileTree,
  recentFiles,
  currentFilePath,
  onRefresh,
  onOpenFromTree,
  onOpenRecentFile,
}: WorkspaceSidebarProps) {
  return (
    <aside className="code-sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title-row">
          <span className="sidebar-title">工作区</span>
          <Button size="mini" type="text" icon={<IconRefresh />} onClick={onRefresh} />
        </div>
        <div className="workspace-path" title={openedFolder || ''}>
          {openedFolder || '未打开目录'}
        </div>
      </div>

      <div className="sidebar-section sidebar-tree">
        {fileTree.length === 0 ? (
          <Empty description="打开目录后显示 .java / .py 文件" />
        ) : (
          <div className="tree-list">{renderFileTree(fileTree, currentFilePath, onOpenFromTree)}</div>
        )}
      </div>

      <div className="sidebar-section sidebar-recent">
        <div className="sidebar-title-row">
          <span className="sidebar-title">最近文件</span>
        </div>
        {recentFiles.length === 0 ? (
          <div className="recent-empty">暂无</div>
        ) : (
          <div className="recent-list">
            {recentFiles.map(filePath => (
              <div
                className="recent-item"
                key={filePath}
                title={filePath}
                onClick={() => onOpenRecentFile(filePath)}
              >
                {getFileName(filePath)}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default WorkspaceSidebar;
