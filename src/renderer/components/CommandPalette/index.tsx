import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Input, List } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconSun, IconMoon, IconDownload } from '@arco-design/web-react/icon';
import { COMMAND_NAV_ITEMS } from '../../config/navigation';
import { ResolvedTheme, ThemeMode } from '../../types/theme';
import { clampSelectionIndex } from '@shared/utils/ui';
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

  useEffect(() => {
    if (filteredCommands.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex(prev => clampSelectionIndex(prev, filteredCommands.length));
  }, [filteredCommands.length]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (filteredCommands.length === 0) {
        setSelectedIndex(0);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => clampSelectionIndex(prev + 1, filteredCommands.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => clampSelectionIndex(prev - 1, filteredCommands.length));
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
      wrapClassName="command-palette-modal"
      unmountOnExit
      autoFocus={false}
      focusLock={false}
    >
      <div className="command-palette-container">
        <Input
          prefix={<IconSearch />}
          placeholder="Type a command or search..."
          value={search}
          onChange={setSearch}
          autoFocus
          className="command-palette-input"
        />
        <div className="command-palette-list-wrapper">
          {navigationCommands.length > 0 && (
            <div className="command-palette-group">
              <div className="command-palette-group-title">Navigation</div>
              <List
                dataSource={navigationCommands}
                render={(cmd, index) => (
                  <List.Item
                    key={cmd.id}
                    className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="command-palette-item-content">
                      <div className="command-palette-item-icon">{cmd.icon}</div>
                      <div className="command-palette-item-text">
                        <span className="command-palette-item-title">{cmd.label}</span>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          )}

          {actionCommands.length > 0 && (
            <div className="command-palette-group">
              <div className="command-palette-group-title">Actions</div>
              <List
                dataSource={actionCommands}
                render={(cmd, index) => (
                  <List.Item
                    key={cmd.id}
                    className={`command-palette-item ${navigationCommands.length + index === selectedIndex ? 'selected' : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(navigationCommands.length + index)}
                  >
                    <div className="command-palette-item-content">
                      <div className="command-palette-item-icon">{cmd.icon}</div>
                      <div className="command-palette-item-text">
                        <span className="command-palette-item-title">{cmd.label}</span>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
          )}

          {filteredCommands.length === 0 && (
            <div className="command-palette-empty">No commands found</div>
          )}
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> to navigate</span>
          <span><kbd>Enter</kbd> to select</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </Modal>
  );
}

export default CommandPalette;
