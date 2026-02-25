import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Input, List } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconSun, IconMoon, IconDownload } from '@arco-design/web-react/icon';
import { COMMAND_NAV_ITEMS } from '../../config/navigation';
import { ResolvedTheme, ThemeMode } from '../../types/theme';
import './styles.css';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action';
}

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

function CommandPalette({ visible, onClose, onToggleTheme, themeMode, resolvedTheme }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands: Command[] = useMemo(
    () => [
      ...COMMAND_NAV_ITEMS.map((item) => ({
        id: `nav-${item.key}`,
        label: item.label,
        icon: item.icon,
        action: () => {
          navigate(item.path);
          onClose();
        },
        category: 'navigation' as const,
      })),
      {
        id: 'action-theme',
        label: `切换到${resolvedTheme === 'light' ? '深色' : '浅色'}主题`,
        icon: resolvedTheme === 'light' ? <IconMoon /> : <IconSun />,
        action: () => {
          onToggleTheme();
          onClose();
        },
        category: 'action' as const,
      },
      {
        id: 'action-backup',
        label: '导出数据备份',
        icon: <IconDownload />,
        action: () => {
          navigate('/settings');
          onClose();
        },
        category: 'action' as const,
      },
    ],
    [navigate, onClose, onToggleTheme, resolvedTheme]
  );

  const filteredCommands = commands.filter((cmd) => cmd.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter' && filteredCommands[selectedIndex]) {
        event.preventDefault();
        filteredCommands[selectedIndex].action();
      }
    },
    [filteredCommands, selectedIndex]
  );

  useEffect(() => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [visible, handleKeyDown]);

  const navigationCommands = filteredCommands.filter((item) => item.category === 'navigation');
  const actionCommands = filteredCommands.filter((item) => item.category === 'action');

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      className="command-palette-modal"
      autoFocus={false}
      focusLock={false}
    >
      <div className="command-palette">
        <Input
          prefix={<IconSearch />}
          placeholder="搜索命令或页面..."
          value={search}
          onChange={setSearch}
          autoFocus
          className="command-input"
        />

        <div className="command-meta">主题模式：{themeMode === 'auto' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}</div>

        <div className="command-list">
          {navigationCommands.length > 0 && (
            <div className="command-group">
              <div className="command-group-title">导航</div>
              <List
                dataSource={navigationCommands}
                render={(cmd: Command, index: number) => (
                  <div
                    className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-icon">{cmd.icon}</span>
                    <span className="command-label">{cmd.label}</span>
                  </div>
                )}
              />
            </div>
          )}

          {actionCommands.length > 0 && (
            <div className="command-group">
              <div className="command-group-title">操作</div>
              <List
                dataSource={actionCommands}
                render={(cmd: Command, index: number) => (
                  <div
                    className={`command-item ${navigationCommands.length + index === selectedIndex ? 'selected' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(navigationCommands.length + index)}
                  >
                    <span className="command-icon">{cmd.icon}</span>
                    <span className="command-label">{cmd.label}</span>
                  </div>
                )}
              />
            </div>
          )}

          {filteredCommands.length === 0 && <div className="command-empty">没有找到匹配的命令</div>}
        </div>

        <div className="command-hints">
          <span>↑↓ 选择</span>
          <span>↵ 确认</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </Modal>
  );
}

export default CommandPalette;
