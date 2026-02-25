export interface OpenTabItem {
  path: string;
  name: string;
  isModified: boolean;
}

interface OpenTabsBarProps {
  openedFiles: OpenTabItem[];
  currentFilePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

function OpenTabsBar({ openedFiles, currentFilePath, onSelect, onClose }: OpenTabsBarProps) {
  return (
    <div className="open-tabs-bar">
      {openedFiles.map(file => (
        <div
          key={file.path}
          className={`open-tab-item ${currentFilePath === file.path ? 'active' : ''}`}
          onClick={() => onSelect(file.path)}
        >
          <span className="open-tab-name">
            {file.name}
            {file.isModified ? ' *' : ''}
          </span>
          <span
            className="open-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(file.path);
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}

export default OpenTabsBar;
