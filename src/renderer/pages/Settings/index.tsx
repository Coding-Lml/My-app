import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Switch, InputNumber, Button, Message, Divider, Space, Modal } from '@arco-design/web-react';
import { IconSave, IconDownload, IconUpload } from '@arco-design/web-react/icon';
import { ThemeMode } from '../../types/theme';
import './styles.css';

interface SettingsState {
  theme: ThemeMode;
  fontSize: string;
  javaPath: string;
  pythonPath: string;
  autoSave: 'true' | 'false';
  dailyGoal: string;
}

function Settings() {
  const [settings, setSettings] = useState<SettingsState>({
    theme: 'light',
    fontSize: '14',
    javaPath: '',
    pythonPath: '',
    autoSave: 'true',
    dailyGoal: '120',
  });
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [checkingJava, setCheckingJava] = useState(false);
  const [checkingPython, setCheckingPython] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await (window as any).electronAPI.settings.getAll();
        const theme: ThemeMode = data.theme === 'dark' || data.theme === 'auto' ? data.theme : 'light';
        setSettings({
          theme,
          fontSize: data.fontSize || '14',
          javaPath: data.javaPath || '',
          pythonPath: data.pythonPath || '',
          autoSave: data.autoSave || 'true',
          dailyGoal: data.dailyGoal || '120',
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    void loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await (window as any).electronAPI.settings.set('theme', settings.theme, 'appearance');
      await (window as any).electronAPI.settings.set('fontSize', settings.fontSize, 'editor');
      await (window as any).electronAPI.settings.set('javaPath', settings.javaPath, 'code');
      await (window as any).electronAPI.settings.set('pythonPath', settings.pythonPath, 'code');
      await (window as any).electronAPI.settings.set('autoSave', settings.autoSave, 'editor');
      await (window as any).electronAPI.settings.set('dailyGoal', settings.dailyGoal, 'study');
      window.dispatchEvent(new CustomEvent('theme-mode-change', { detail: { mode: settings.theme } }));
      Message.success('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      Message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    setExportLoading(true);
    try {
      const result = await (window as any).electronAPI.export.backup();
      if (result.success) {
        Message.success(`备份已保存到: ${result.path}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      Message.error('导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportBackup = async () => {
    Modal.confirm({
      title: '导入备份',
      content: '导入备份将会合并现有数据，不会删除已有数据。确定要继续吗？',
      onOk: async () => {
        try {
          const result = await (window as any).electronAPI.export.importBackup();
          if (result.success) {
            Message.success(result.message);
          } else {
            Message.error(result.message);
          }
        } catch (error) {
          console.error('Import failed:', error);
          Message.error('导入失败');
        }
      },
    });
  };

  const handleCheckJava = async () => {
    setCheckingJava(true);
    try {
      const result = await (window as any).electronAPI.code.checkJava(settings.javaPath || undefined);
      if (result.success) {
        Message.success(`Java 可用：${result.version}`);
      } else {
        Message.error(`Java 检测失败：${result.error}`);
      }
    } catch (error: any) {
      Message.error(`Java 检测异常：${error.message}`);
    } finally {
      setCheckingJava(false);
    }
  };

  const handleCheckPython = async () => {
    setCheckingPython(true);
    try {
      const result = await (window as any).electronAPI.code.checkPython(settings.pythonPath || undefined);
      if (result.success) {
        Message.success(`Python 可用：${result.version}`);
      } else {
        Message.error(`Python 检测失败：${result.error}`);
      }
    } catch (error: any) {
      Message.error(`Python 检测异常：${error.message}`);
    } finally {
      setCheckingPython(false);
    }
  };

  return (
    <div className="settings-page fade-in">
      <h1 className="page-title">设置</h1>

      <div className="settings-content">
        <Card title="外观设置" className="settings-card">
          <Form layout="vertical">
            <Form.Item label="主题">
              <Select
                value={settings.theme}
                onChange={(value) => setSettings({ ...settings, theme: value as ThemeMode })}
                className="settings-select-md"
              >
                <Select.Option value="light">浅色</Select.Option>
                <Select.Option value="dark">深色</Select.Option>
                <Select.Option value="auto">跟随系统</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Card>

        <Card title="编辑器设置" className="settings-card">
          <Form layout="vertical">
            <Form.Item label="字体大小">
              <Select
                value={settings.fontSize}
                onChange={(value) => setSettings({ ...settings, fontSize: value })}
                className="settings-select-sm"
              >
                <Select.Option value="12">12px</Select.Option>
                <Select.Option value="14">14px</Select.Option>
                <Select.Option value="16">16px</Select.Option>
                <Select.Option value="18">18px</Select.Option>
                <Select.Option value="20">20px</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="自动保存">
              <div className="settings-inline-field">
                <Switch
                  checked={settings.autoSave === 'true'}
                  onChange={(checked) => setSettings({ ...settings, autoSave: checked ? 'true' : 'false' })}
                />
                <span className="settings-help">编辑笔记时自动保存</span>
              </div>
            </Form.Item>
          </Form>
        </Card>

        <Card title="代码环境" className="settings-card">
          <Form layout="vertical">
            <Form.Item label="Java 路径" extra="留空使用系统默认 java。需要指定版本时输入完整路径。">
              <Space>
                <Input
                  placeholder="/usr/bin/java 或 C:\\Program Files\\Java\\jdk-xx\\bin\\java.exe"
                  value={settings.javaPath}
                  onChange={(value) => setSettings({ ...settings, javaPath: value })}
                  className="settings-input-wide"
                />
                <Button loading={checkingJava} onClick={handleCheckJava}>
                  检测
                </Button>
              </Space>
            </Form.Item>

            <Form.Item label="Python 路径" extra="留空使用系统默认 python3。需要指定版本时输入完整路径。">
              <Space>
                <Input
                  placeholder="/usr/bin/python3 或 C:\\Python3xx\\python.exe"
                  value={settings.pythonPath}
                  onChange={(value) => setSettings({ ...settings, pythonPath: value })}
                  className="settings-input-wide"
                />
                <Button loading={checkingPython} onClick={handleCheckPython}>
                  检测
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card title="学习目标" className="settings-card">
          <Form layout="vertical">
            <Form.Item label="每日学习目标（分钟）">
              <div className="settings-inline-field">
                <InputNumber
                  min={0}
                  max={720}
                  value={parseInt(settings.dailyGoal, 10)}
                  onChange={(value) => setSettings({ ...settings, dailyGoal: String(value || 120) })}
                  className="settings-select-sm"
                />
                <span className="settings-help">
                  约 {Math.round((parseInt(settings.dailyGoal, 10) / 60) * 10) / 10} 小时
                </span>
              </div>
            </Form.Item>
          </Form>
        </Card>

        <Card title="数据备份与导出" className="settings-card">
          <div className="backup-section">
            <div className="backup-item">
              <div className="backup-info">
                <h4>导出备份</h4>
                <p>将数据库数据（待办、打卡记录、学习计划等）导出为 JSON 文件</p>
              </div>
              <Button type="primary" icon={<IconDownload />} loading={exportLoading} onClick={handleExportBackup}>
                导出备份
              </Button>
            </div>

            <Divider />

            <div className="backup-item">
              <div className="backup-info">
                <h4>导入备份</h4>
                <p>从 JSON 备份文件恢复数据（会与现有数据合并）</p>
              </div>
              <Button icon={<IconUpload />} onClick={handleImportBackup}>
                导入备份
              </Button>
            </div>
          </div>
        </Card>

        <Divider />

        <div className="settings-actions">
          <Button type="primary" icon={<IconSave />} loading={loading} onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
