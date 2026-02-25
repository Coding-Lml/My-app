import { useMemo } from 'react';
import { Menu, Switch, Button } from '@arco-design/web-react';

export type NotesImagePathMode = 'file-relative' | 'app-relative';
export type NotesPdfPageSize = 'A4' | 'Letter';
export type NotesPdfTheme = 'typora' | 'github' | 'custom';

interface UseNotesMenusOptions {
  showSidebar: boolean;
  setShowSidebar: (value: boolean) => void;
  showOutline: boolean;
  setShowOutline: (value: boolean) => void;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
  typewriterMode: boolean;
  setTypewriterMode: (value: boolean) => void;
  imagePathMode: NotesImagePathMode;
  handleImagePathModeChange: (mode: NotesImagePathMode) => void;
  outlineMaxLevel: number;
  handleOutlineMaxLevelChange: (level: number) => void;
  pdfTheme: NotesPdfTheme;
  handlePdfThemeChange: (theme: NotesPdfTheme) => void;
  openPdfTemplateModal: () => void;
  pdfPageSize: NotesPdfPageSize;
  handlePdfPageSizeChange: (pageSize: NotesPdfPageSize) => void;
  pdfPrintBackground: boolean;
  handlePdfPrintBackgroundChange: (enabled: boolean) => void;
  handleInsertCodeBlock: (language?: string) => void;
}

export function useNotesMenus({
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
}: UseNotesMenusOptions) {
  const settingsMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item key="sidebar">
          <div className="settings-menu-item">
            <span>侧边栏</span>
            <Switch size="small" checked={showSidebar} onChange={setShowSidebar} />
          </div>
        </Menu.Item>
        <Menu.Item key="outline">
          <div className="settings-menu-item">
            <span>大纲视图</span>
            <Switch size="small" checked={showOutline} onChange={setShowOutline} />
          </div>
        </Menu.Item>
        <Menu.Item key="focus">
          <div className="settings-menu-item">
            <span>专注模式</span>
            <Switch size="small" checked={focusMode} onChange={setFocusMode} />
          </div>
        </Menu.Item>
        <Menu.Item key="typewriter">
          <div className="settings-menu-item">
            <span>打字机模式</span>
            <Switch size="small" checked={typewriterMode} onChange={setTypewriterMode} />
          </div>
        </Menu.Item>
        <Menu.Item key="imagePathMode">
          <div className="settings-menu-item">
            <span>图片存应用目录</span>
            <Switch
              size="small"
              checked={imagePathMode === 'app-relative'}
              onChange={checked =>
                handleImagePathModeChange(checked ? 'app-relative' : 'file-relative')
              }
            />
          </div>
        </Menu.Item>
        <Menu.Item key="outlineDepth">
          <div className="settings-menu-item settings-menu-item-wide">
            <span>大纲层级</span>
            <div className="settings-inline-actions">
              <Button
                size="mini"
                type={outlineMaxLevel === 3 ? 'primary' : 'outline'}
                onClick={() => handleOutlineMaxLevelChange(3)}
              >
                H1-H3
              </Button>
              <Button
                size="mini"
                type={outlineMaxLevel === 6 ? 'primary' : 'outline'}
                onClick={() => handleOutlineMaxLevelChange(6)}
              >
                全部
              </Button>
            </div>
          </div>
        </Menu.Item>
        <Menu.Item key="pdfTheme">
          <div className="settings-menu-item settings-menu-item-wide">
            <span>PDF 主题</span>
            <div className="settings-inline-actions">
              <Button
                size="mini"
                type={pdfTheme === 'typora' ? 'primary' : 'outline'}
                onClick={() => handlePdfThemeChange('typora')}
              >
                Typora
              </Button>
              <Button
                size="mini"
                type={pdfTheme === 'github' ? 'primary' : 'outline'}
                onClick={() => handlePdfThemeChange('github')}
              >
                GitHub
              </Button>
              <Button
                size="mini"
                type={pdfTheme === 'custom' ? 'primary' : 'outline'}
                onClick={() => handlePdfThemeChange('custom')}
              >
                自定义
              </Button>
            </div>
          </div>
        </Menu.Item>
        <Menu.Item key="pdfTemplateEditor">
          <div className="settings-menu-item settings-menu-item-wide">
            <span>模板 CSS</span>
            <Button size="mini" onClick={openPdfTemplateModal}>
              编辑
            </Button>
          </div>
        </Menu.Item>
        <Menu.Item key="pdfPageSize">
          <div className="settings-menu-item settings-menu-item-wide">
            <span>PDF 纸张</span>
            <div className="settings-inline-actions">
              <Button
                size="mini"
                type={pdfPageSize === 'A4' ? 'primary' : 'outline'}
                onClick={() => handlePdfPageSizeChange('A4')}
              >
                A4
              </Button>
              <Button
                size="mini"
                type={pdfPageSize === 'Letter' ? 'primary' : 'outline'}
                onClick={() => handlePdfPageSizeChange('Letter')}
              >
                Letter
              </Button>
            </div>
          </div>
        </Menu.Item>
        <Menu.Item key="pdfPrintBackground">
          <div className="settings-menu-item">
            <span>PDF 背景</span>
            <Switch size="small" checked={pdfPrintBackground} onChange={handlePdfPrintBackgroundChange} />
          </div>
        </Menu.Item>
      </Menu>
    ),
    [
      focusMode,
      handleImagePathModeChange,
      handleOutlineMaxLevelChange,
      handlePdfPageSizeChange,
      handlePdfPrintBackgroundChange,
      handlePdfThemeChange,
      imagePathMode,
      openPdfTemplateModal,
      outlineMaxLevel,
      pdfPageSize,
      pdfPrintBackground,
      pdfTheme,
      setFocusMode,
      setShowOutline,
      setShowSidebar,
      setTypewriterMode,
      showOutline,
      showSidebar,
      typewriterMode,
    ]
  );

  const codeBlockMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item key="plain" onClick={() => handleInsertCodeBlock()}>
          普通代码块
        </Menu.Item>
        <Menu.Item key="java" onClick={() => handleInsertCodeBlock('java')}>
          Java
        </Menu.Item>
        <Menu.Item key="python" onClick={() => handleInsertCodeBlock('python')}>
          Python
        </Menu.Item>
      </Menu>
    ),
    [handleInsertCodeBlock]
  );

  return {
    settingsMenu,
    codeBlockMenu,
  };
}
