import { Layout, Tabs, Input, Tree, Empty, List } from '@arco-design/web-react';
import { IconSearch, IconFile } from '@arco-design/web-react/icon';

const { Sider } = Layout;
const TabPane = Tabs.TabPane;

export interface NoteTreeNode {
  title: React.ReactNode;
  key: string;
  isLeaf: boolean;
  children?: NoteTreeNode[];
}

interface NotesSidebarProps {
  showSidebar: boolean;
  openedFolder: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  fileTree: NoteTreeNode[];
  onSelectFile: (path: string) => void;
  recentFiles: string[];
  onOpenRecentFile: (path: string) => void;
}

function NotesSidebar({
  showSidebar,
  openedFolder,
  searchQuery,
  onSearchQueryChange,
  fileTree,
  onSelectFile,
  recentFiles,
  onOpenRecentFile,
}: NotesSidebarProps) {
  return (
    <Sider width={260} className="notes-sider" collapsed={!showSidebar} collapsedWidth={0}>
      <Tabs defaultActiveTab="files" type="line">
        <TabPane key="files" title="文件树">
          <div className="notes-search">
            <Input
              placeholder="搜索文件..."
              prefix={<IconSearch />}
              value={searchQuery}
              onChange={onSearchQueryChange}
              allowClear
            />
          </div>
          {fileTree.length > 0 ? (
            <Tree
              className="file-tree"
              treeData={fileTree}
              onSelect={(keys) => {
                if (keys.length > 0) {
                  onSelectFile(keys[0] as string);
                }
              }}
            />
          ) : (
            <Empty description={openedFolder ? '文件夹为空' : '点击"打开文件夹"开始'} style={{ marginTop: 40 }} />
          )}
        </TabPane>
        <TabPane key="recent" title="最近">
          {recentFiles.length > 0 ? (
            <List
              className="recent-files-list"
              dataSource={recentFiles}
              render={(filePath: string) => (
                <List.Item className="recent-file-item" onClick={() => onOpenRecentFile(filePath)}>
                  <IconFile style={{ marginRight: 8 }} />
                  <div className="recent-file-info">
                    <div className="recent-file-name">{filePath.split(/[\\/]/).pop()}</div>
                    <div className="recent-file-path">{filePath}</div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无最近打开的文件" style={{ marginTop: 40 }} />
          )}
        </TabPane>
      </Tabs>
    </Sider>
  );
}

export default NotesSidebar;
