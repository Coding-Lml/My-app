import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button } from '@arco-design/web-react';
import { IconSun, IconMoon, IconLeft, IconRight } from '@arco-design/web-react/icon';
import React, { Suspense } from 'react';
import CommandPalette from './components/CommandPalette';
import BrandMark from './components/BrandMark';
import PageSkeleton from './components/UI/PageSkeleton';
import { MENU_ITEMS } from './config/navigation';
import { normalizeFontFamily, resolveFontFamilyRoles } from './config/fontFamily';
import { EditorChromeTheme, ResolvedTheme, ThemeMode, UiDensity } from './types/theme';
import './styles/global.css';

const Notes = React.lazy(() => import('./pages/Notes'));
const Todos = React.lazy(() => import('./pages/Todos'));
const CodeRunner = React.lazy(() => import('./pages/CodeRunner'));
const Settings = React.lazy(() => import('./pages/Settings'));
const CheckIn = React.lazy(() => import('./pages/CheckIn'));
const SkillTree = React.lazy(() => import('./pages/SkillTree'));
const StudyPlan = React.lazy(() => import('./pages/StudyPlan'));

const MenuItem = Menu.Item;
const { Sider, Content } = Layout;

const normalizeUiDensity = (value: string | null | undefined): UiDensity => {
  return value === 'compact' ? 'compact' : 'comfortable';
};

const normalizeEditorChromeTheme = (value: string | null | undefined): EditorChromeTheme => {
  return value === 'light' || value === 'dark' ? value : 'auto';
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isNotesRoute = location.pathname === '/notes';
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState(location.pathname);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [uiDensity, setUiDensity] = useState<UiDensity>('comfortable');
  const [editorChromeTheme, setEditorChromeTheme] = useState<EditorChromeTheme>('auto');
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  useEffect(() => {
    setSelectedKey(location.pathname);
  }, [location.pathname]);

  const resolveTheme = useCallback((mode: ThemeMode): ResolvedTheme => {
    if (mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
  }, []);

  const applyTheme = useCallback(
    async (mode: ThemeMode, persist = false) => {
      const nextResolved = resolveTheme(mode);
      setThemeMode(mode);
      setResolvedTheme(nextResolved);
      document.documentElement.setAttribute('data-theme', nextResolved);
      document.documentElement.setAttribute('data-theme-mode', mode);
      document.body.setAttribute('arco-theme', nextResolved === 'dark' ? 'dark' : '');

      if (!persist) {
        return;
      }

      try {
        await window.electronAPI?.settings?.set('theme', mode, 'appearance');
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    },
    [resolveTheme]
  );

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await window.electronAPI?.settings?.get('theme');
        const mode: ThemeMode = savedTheme === 'dark' || savedTheme === 'auto' ? savedTheme : 'light';
        await applyTheme(mode);
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    };

    void loadTheme();
  }, [applyTheme]);

  const applyFontFamily = useCallback((value: string | null | undefined) => {
    const normalized = normalizeFontFamily(value);
    const roles = resolveFontFamilyRoles(normalized);
    document.documentElement.setAttribute('data-font-family', normalized);
    document.documentElement.style.setProperty('--app-font-family', roles.body);
    document.documentElement.style.setProperty('--app-font-display-family', roles.display);
    document.documentElement.style.setProperty('--app-font-mono-family', roles.mono);
  }, []);

  useEffect(() => {
    const loadFontFamily = async () => {
      try {
        const savedFontFamily = await window.electronAPI?.settings?.get('fontFamily');
        applyFontFamily(savedFontFamily);
      } catch (error) {
        console.error('Failed to load font family:', error);
      }
    };

    void loadFontFamily();
  }, [applyFontFamily]);

  useEffect(() => {
    const loadUiPreferences = async () => {
      try {
        const [savedDensity, savedEditorChromeTheme] = await Promise.all([
          window.electronAPI?.settings?.get('uiDensity'),
          window.electronAPI?.settings?.get('editorChromeTheme'),
        ]);

        setUiDensity(normalizeUiDensity(savedDensity));
        setEditorChromeTheme(normalizeEditorChromeTheme(savedEditorChromeTheme));
      } catch (error) {
        console.error('Failed to load UI preferences:', error);
      }
    };

    void loadUiPreferences();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-density', uiDensity);
  }, [uiDensity]);

  useEffect(() => {
    const resolvedEditorChrome = editorChromeTheme === 'auto' ? resolvedTheme : editorChromeTheme;
    document.documentElement.setAttribute('data-editor-chrome-mode', editorChromeTheme);
    document.documentElement.setAttribute('data-editor-chrome', resolvedEditorChrome);
  }, [editorChromeTheme, resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (themeMode === 'auto') {
        void applyTheme('auto');
      }
    };

    media.addEventListener('change', handleSystemThemeChange);
    return () => media.removeEventListener('change', handleSystemThemeChange);
  }, [applyTheme, themeMode]);

  useEffect(() => {
    const handleThemeModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: ThemeMode }>;
      const nextMode = customEvent.detail?.mode;
      if (nextMode === 'light' || nextMode === 'dark' || nextMode === 'auto') {
        void applyTheme(nextMode);
      }
    };

    window.addEventListener('theme-mode-change', handleThemeModeChange as EventListener);
    return () => window.removeEventListener('theme-mode-change', handleThemeModeChange as EventListener);
  }, [applyTheme]);

  useEffect(() => {
    const handleFontFamilyChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ fontFamily?: string }>;
      applyFontFamily(customEvent.detail?.fontFamily);
    };

    window.addEventListener('app-font-family-change', handleFontFamilyChange as EventListener);
    return () => window.removeEventListener('app-font-family-change', handleFontFamilyChange as EventListener);
  }, [applyFontFamily]);

  useEffect(() => {
    const handleUiDensityChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ density?: UiDensity }>;
      setUiDensity(normalizeUiDensity(customEvent.detail?.density));
    };

    window.addEventListener('app-ui-density-change', handleUiDensityChange as EventListener);
    return () => window.removeEventListener('app-ui-density-change', handleUiDensityChange as EventListener);
  }, []);

  useEffect(() => {
    const handleEditorChromeThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: EditorChromeTheme }>;
      setEditorChromeTheme(normalizeEditorChromeTheme(customEvent.detail?.mode));
    };

    window.addEventListener('editor-chrome-theme-change', handleEditorChromeThemeChange as EventListener);
    return () =>
      window.removeEventListener('editor-chrome-theme-change', handleEditorChromeThemeChange as EventListener);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = resolvedTheme === 'light' ? 'dark' : 'light';
    void applyTheme(nextMode, true);
  }, [applyTheme, resolvedTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMenuClick = (path: string) => {
    setSelectedKey(path);
    navigate(path);
  };

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''} ${uiDensity === 'compact' ? 'is-compact' : ''}`}>
      <Layout className="layout">
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={236}
          collapsedWidth={52}
          trigger={null}
          className="sider"
        >
          <div className="brand">
            <div className="brand-main">
              <BrandMark className="brand-mark-svg" decorative />
              {!collapsed && (
                <div className="brand-text-group">
                  <span className="brand-title">Academia</span>
                  <span className="brand-subtitle">Learning Console</span>
                </div>
              )}
            </div>
            <Button
              type="text"
              size="mini"
              className="sider-collapse-btn"
              icon={collapsed ? <IconRight /> : <IconLeft />}
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            />
          </div>

          <Menu selectedKeys={[selectedKey]} onClickMenuItem={handleMenuClick} className="sider-menu" collapse={collapsed}>
            {MENU_ITEMS.map((item) => (
              <MenuItem
                key={item.path}
                title={item.label}
                renderItemInTooltip={() => <span>{item.label}</span>}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </MenuItem>
            ))}
          </Menu>

          <div className="sider-footer">
            {!collapsed ? (
              <Button
                type="text"
                size="small"
                icon={resolvedTheme === 'light' ? <IconMoon /> : <IconSun />}
                onClick={toggleTheme}
                className="theme-btn"
              >
                {resolvedTheme === 'light' ? '切到深色' : '切到浅色'}
                {themeMode === 'auto' ? ' · 自动' : ''}
              </Button>
            ) : (
              <Button
                type="text"
                size="small"
                icon={resolvedTheme === 'light' ? <IconMoon /> : <IconSun />}
                onClick={toggleTheme}
                className="theme-btn-icon"
              />
            )}
          </div>
        </Sider>

        <Layout className="content-layout">
          <Content className={`content${isNotesRoute ? ' content-notes' : ''}`}>
            <Suspense fallback={<PageSkeleton />}>
              <div key={location.pathname} className={`page-enter${isNotesRoute ? ' page-enter-notes' : ''}`}>
                <Routes>
                  <Route path="/" element={<Navigate to="/checkin" replace />} />
                  <Route path="/skills" element={<SkillTree />} />
                  <Route path="/plans" element={<StudyPlan />} />
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/todos" element={<Todos />} />
                  <Route path="/checkin" element={<CheckIn />} />
                  <Route path="/code" element={<CodeRunner />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/checkin" replace />} />
                </Routes>
              </div>
            </Suspense>
          </Content>
        </Layout>
      </Layout>

      <CommandPalette
        visible={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onToggleTheme={toggleTheme}
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
      />
    </div>
  );
}

export default App;
