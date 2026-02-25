import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Switch, InputNumber, Button, Message, Divider, Space, Modal } from '@arco-design/web-react';
import { IconSave, IconDownload, IconUpload } from '@arco-design/web-react/icon';
import { ThemeMode } from '../../types/theme';
import { summarizeBackupImport } from '@shared/utils/backup';
import type { RuntimeCheckResult } from '@shared/types/ipc';
import './styles.css';

interface SettingsState {
  theme: ThemeMode;
  fontSize: string;
  javaPath: string;
  pythonPath: string;
  autoSave: 'true' | 'false';
  dailyGoal: string;
}

type CoreSettings = Partial<
  Record<'theme' | 'fontSize' | 'javaPath' | 'pythonPath' | 'autoSave' | 'dailyGoal', string>
>;

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
  const [importLoading, setImportLoading] = useState(false);
  const [checkingJava, setCheckingJava] = useState(false);
  const [checkingPython, setCheckingPython] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data: CoreSettings = await window.electronAPI.settings.getAll();
        const theme: ThemeMode = data.theme === 'dark' || data.theme === 'auto' ? data.theme : 'light';
        const autoSave: 'true' | 'false' = data.autoSave === 'false' ? 'false' : 'true';
        setSettings({
          theme,
          fontSize: data.fontSize || '14',
          javaPath: data.javaPath || '',
          pythonPath: data.pythonPath || '',
          autoSave,
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
      await window.electronAPI.settings.set('theme', settings.theme, 'appearance');
      await window.electronAPI.settings.set('fontSize', settings.fontSize, 'editor');
      await window.electronAPI.settings.set('javaPath', settings.javaPath, 'code');
      await window.electronAPI.settings.set('pythonPath', settings.pythonPath, 'code');
      await window.electronAPI.settings.set('autoSave', settings.autoSave, 'editor');
      await window.electronAPI.settings.set('dailyGoal', settings.dailyGoal, 'study');
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
      const result = await window.electronAPI.export.backup();
      if (result.success) {
        const counts = result.counts;
        const summary = counts
          ? `，包含 ${counts.todos} 个待办 / ${counts.studyPlans} 个计划 / ${counts.milestones} 个里程碑`
          : '';
        Message.success(`备份已保存到: ${result.path}${summary}`);
      } else {
        Message.error(result.error || '导出失败');
      }
    } catch (error) {
      console.error('Export failed:', error);
      Message.error('导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportBackup = async () => {
    const preview = await window.electronAPI.export.previewBackup();
    if (!preview.success) {
      if (preview.message !== '已取消选择') {
        Message.error(preview.message);
      }
      return;
    }

    const counts = preview.summary?.counts;
    const summary = counts
      ? `待办 ${counts.todos} / 打卡 ${counts.checkIns} / 技能 ${counts.studyProgress} / 计划 ${counts.studyPlans} / 里程碑 ${counts.milestones}`
      : '未知';
    const warningText = preview.warnings?.length
      ? `\n注意：预览发现 ${preview.warnings.length} 项潜在异常，导入时会尝试跳过无效数据。`
      : '';

    Modal.confirm({
      title: '导入备份',
      content: `检测到备份数据：${summary}。导入将合并现有数据，不会删除已有数据，确定继续吗？${warningText}`,
      onOk: async () => {
        setImportLoading(true);
        const hide = Message.loading('正在导入备份...');
        try {
          const result = await window.electronAPI.export.importBackup(preview.filePath);
          hide();
          if (result.success) {
            const stats = result.stats;
            const totals = stats ? summarizeBackupImport(stats) : null;
            const summary = totals
              ? `新增 ${totals.created} / 更新 ${totals.updated} / 跳过 ${totals.skipped}`
              : '';
            Message.success(summary ? `${result.message}（${summary}）` : result.message);
            if (result.warnings && result.warnings.length > 0) {
              Message.warning(`部分数据已跳过：${result.warnings.length} 项`);
            }
          } else {
            Message.error(result.message);
          }
        } catch (error) {
          hide();
          console.error('Import failed:', error);
          Message.error(error instanceof Error ? `导入失败：${error.message}` : '导入失败');
        } finally {
          setImportLoading(false);
        }
      },
    });
  };

  const handleCheckJava = async () => {
    setCheckingJava(true);
    try {
      const result: RuntimeCheckResult = await window.electronAPI.code.checkJava(settings.javaPath || undefined);
      if (result.success) {
        Message.success(`Java 可用：${result.version}`);
      } else {
        Message.error(`Java 检测失败：${result.error}`);
      }
    } catch (error) {
      Message.error(`Java 检测异常：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setCheckingJava(false);
    }
  };

  const handleCheckPython = async () => {
    setCheckingPython(true);
    try {
      const result: RuntimeCheckResult = await window.electronAPI.code.checkPython(settings.pythonPath || undefined);
      if (result.success) {
        Message.success(`Python 可用：${result.version}`);
      } else {
        Message.error(`Python 检测失败：${result.error}`);
      }
    } catch (error) {
      Message.error(`Python 检测异常：${error instanceof Error ? error.message : '未知错误'}`);
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
              <Button icon={<IconUpload />} loading={importLoading} onClick={handleImportBackup}>
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
