import { useEffect, useState } from 'react';
import {
  Card,
  Progress,
  Button,
  Modal,
  Input,
  Select,
  InputNumber,
  Tag,
  Empty,
  Message,
} from '@arco-design/web-react';
import { IconEdit } from '@arco-design/web-react/icon';
import { averageProgress } from '@shared/utils/ui';
import './styles.css';

interface Skill {
  id: number;
  skill_name: string;
  category: string | null;
  level: number;
  target_level: number;
  time_spent: number;
  notes_count: number;
  code_count: number;
  parent_skill_id: number | null;
  order_index: number;
  updated_at: number;
  children?: Skill[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Java': '#5d8f79',
  '数据库': '#6e9f88',
  '算法': '#7aa891',
  '基础': '#8ab5a0',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Java': '☕',
  '数据库': '🗄️',
  '算法': '🧮',
  '基础': '📚',
};

function SkillTree() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLevel, setEditLevel] = useState(0);
  const [expandedSkillIds, setExpandedSkillIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [newSkill, setNewSkill] = useState<{ name: string; category: string; parentId: number | null }>({ name: '', category: '', parentId: null });
  const [meta, setMeta] = useState<{ name: string; category: string; parentId: number | null }>({ name: '', category: '', parentId: null });

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const data = await window.electronAPI.progress.getAll();
      const skillMap = new Map<number, Skill>();
      const rootSkills: Skill[] = [];

      data.forEach((skill: Skill) => {
        skillMap.set(skill.id, { ...skill, children: [] });
      });

      data.forEach((skill: Skill) => {
        const node = skillMap.get(skill.id)!;
        if (skill.parent_skill_id) {
          const parent = skillMap.get(skill.parent_skill_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          }
        } else {
          rootSkills.push(node);
        }
      });

      setSkills(rootSkills);
      setExpandedSkillIds(prev => {
        if (prev.size > 0) {
          return prev;
        }
        return new Set(rootSkills.map(skill => skill.id));
      });
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  };

  const handleUpdateProgress = async () => {
    if (!selectedSkill) return;

    try {
      await window.electronAPI.progress.update(selectedSkill.skill_name, {
        level: editLevel,
      });
      Message.success('进度已更新');
      setShowEditModal(false);
      loadSkills();
    } catch (error) {
      console.error('Failed to update skill:', error);
      Message.error('更新失败');
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkill.name.trim()) {
      Message.warning('请输入技能名称');
      return;
    }
    try {
      await window.electronAPI.progress.create({
        skill_name: newSkill.name,
        category: newSkill.category || undefined,
        parent_skill_id: newSkill.parentId ?? null,
      });
      Message.success('已新增技能');
      setShowCreateModal(false);
      setNewSkill({ name: '', category: '', parentId: null });
      loadSkills();
    } catch (e) {
      console.error(e);
      Message.error('新增失败');
    }
  };

  const openMetaEditor = () => {
    if (!selectedSkill) return;
    setMeta({ name: selectedSkill.skill_name, category: selectedSkill.category || '', parentId: selectedSkill.parent_skill_id ?? null });
    setShowMetaModal(true);
  };

  const handleSaveMeta = async () => {
    if (!selectedSkill) return;
    if (!meta.name.trim()) {
      Message.warning('请输入技能名称');
      return;
    }
    try {
      await window.electronAPI.progress.updateById(selectedSkill.id, {
        skill_name: meta.name,
        category: meta.category || null,
        parent_skill_id: meta.parentId ?? null,
      });
      Message.success('已更新技能信息');
      setShowMetaModal(false);
      loadSkills();
    } catch (e) {
      console.error(e);
      Message.error('保存失败');
    }
  };

  const handleDeleteSkill = async () => {
    if (!selectedSkill) return;
    Modal.confirm({
      title: '删除技能',
      content: '删除后其子技能的父子关系会被清除，确认删除？',
      onOk: async () => {
        try {
          await window.electronAPI.progress.delete(selectedSkill.id);
          Message.success('已删除');
          setSelectedSkill(null);
          loadSkills();
        } catch (e) {
          console.error(e);
          Message.error('删除失败');
        }
      }
    });
  };

  const toggleSkill = (id: number) => {
    const newExpanded = new Set(expandedSkillIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSkillIds(newExpanded);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getProgressColor = (level: number) => {
    if (level >= 80) return 'var(--success-strong)';
    if (level >= 50) return 'var(--warn-strong)';
    return 'var(--accent-strong)';
  };

  const renderSkillNode = (skill: Skill, depth: number = 0) => {
    const hasChildren = skill.children && skill.children.length > 0;
    const isExpanded = expandedSkillIds.has(skill.id);

    return (
      <div key={skill.id} className="skill-node" style={{ marginLeft: depth * 24 }}>
        <div
          className={`skill-item ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
          onClick={() => setSelectedSkill(skill)}
        >
          <div className="skill-main">
            {hasChildren && (
              <span
                className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSkill(skill.id);
                }}
              >
                ▶
              </span>
            )}
            {!hasChildren && <span className="expand-placeholder" />}
            <span className="skill-name">{skill.skill_name}</span>
            {skill.level >= 100 && <Tag color="green" size="small">已掌握</Tag>}
          </div>
          <div className="skill-progress-mini">
            <Progress
              percent={skill.level}
              size="small"
              style={{ width: 80, strokeColor: getProgressColor(skill.level) }}
            />
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="skill-children">
            {skill.children!.map(child => renderSkillNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const flattenSkills = (items: Skill[]): Skill[] => {
    return items.flatMap(item => [item, ...(item.children ? flattenSkills(item.children) : [])]);
  };

  const allSkills = flattenSkills(skills);
  const overallProgress = averageProgress(allSkills.map(skill => skill.level));

  return (
    <div className="skill-tree-page">
      <div className="skill-tree-header">
        <h1 className="page-title">技能树</h1>
        <div className="overall-progress">
          <span>总体进度</span>
          <Progress
            percent={overallProgress}
            style={{ width: 200, marginLeft: 12, strokeColor: getProgressColor(overallProgress) }}
          />
          <span className="progress-text">{overallProgress}%</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Button type="primary" onClick={() => setShowCreateModal(true)}>新增技能</Button>
        </div>
      </div>

      <div className="skill-tree-content">
        <Card className="tree-card" title="Java后端工程师技能树">
          {skills.length === 0 ? (
            <Empty description="暂无技能数据" style={{ margin: '40px 0' }} />
          ) : (
            <div className="skill-tree">
              {skills.map(skill => renderSkillNode(skill))}
            </div>
          )}
        </Card>

        {selectedSkill && (
          <Card className="detail-card" title="技能详情">
            <div className="detail-header">
              <div className="detail-title">
                <span className="category-icon">
                  {CATEGORY_ICONS[selectedSkill.category || ''] || '📌'}
                </span>
                <h2>{selectedSkill.skill_name}</h2>
              </div>
              <Tag color={CATEGORY_COLORS[selectedSkill.category || ''] || 'gray'}>
                {selectedSkill.category}
              </Tag>
            </div>

            <div className="detail-progress">
              <div className="progress-header">
                <span>掌握程度</span>
                <span className="progress-value">{selectedSkill.level}%</span>
              </div>
              <Progress
                percent={selectedSkill.level}
                style={{ strokeColor: getProgressColor(selectedSkill.level) }}
                animation
              />
            </div>

            <div className="detail-stats">
              <div className="stat-item">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <div className="stat-value">{formatTime(selectedSkill.time_spent)}</div>
                  <div className="stat-label">学习时长</div>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <div className="stat-value">{selectedSkill.notes_count}</div>
                  <div className="stat-label">相关笔记</div>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">💻</div>
                <div className="stat-info">
                  <div className="stat-value">{selectedSkill.code_count}</div>
                  <div className="stat-label">代码练习</div>
                </div>
              </div>
            </div>

            <div className="detail-actions">
              <Button
                type="primary"
                icon={<IconEdit />}
                onClick={() => {
                  setEditLevel(selectedSkill.level);
                  setShowEditModal(true);
                }}
              >
                更新进度
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={openMetaEditor}>
                编辑信息
              </Button>
              <Button style={{ marginLeft: 8 }} status="danger" onClick={handleDeleteSkill}>
                删除技能
              </Button>
            </div>

            {selectedSkill.children && selectedSkill.children.length > 0 && (
              <div className="sub-skills">
                <h4>子技能</h4>
                <div className="sub-skill-list">
                  {selectedSkill.children.map(child => (
                    <div
                      key={child.id}
                      className="sub-skill-item"
                      onClick={() => setSelectedSkill(child)}
                    >
                      <span className="sub-skill-name">{child.skill_name}</span>
                      <Progress
                        percent={child.level}
                        size="small"
                        style={{ width: 60, strokeColor: getProgressColor(child.level) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal
        title="更新技能进度"
        visible={showEditModal}
        onOk={handleUpdateProgress}
        onCancel={() => setShowEditModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <div className="edit-form">
          <div className="form-item">
            <label>技能名称</label>
            <div className="skill-name-display">{selectedSkill?.skill_name}</div>
          </div>
          <div className="form-item">
            <label>掌握程度 (0-100)</label>
            <InputNumber
              value={editLevel}
              onChange={setEditLevel}
              min={0}
              max={100}
              style={{ width: '100%' }}
            />
          </div>
          <div className="level-hints">
            <div className="hint">
              <span className="dot beginner"></span>
              0-49%: 初学
            </div>
            <div className="hint">
              <span className="dot intermediate"></span>
              50-79%: 进阶
            </div>
            <div className="hint">
              <span className="dot advanced"></span>
              80-100%: 熟练
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="新增技能"
        visible={showCreateModal}
        onOk={handleCreateSkill}
        onCancel={() => {
          setShowCreateModal(false)
          setNewSkill({ name: '', category: '', parentId: null })
        }}
        okText="创建"
        cancelText="取消"
      >
        <div className="edit-form">
          <div className="form-item">
            <label>技能名称 *</label>
            <Input
              placeholder="例如：Kafka 基础"
              value={newSkill.name}
              onChange={v => setNewSkill({ ...newSkill, name: v })}
            />
          </div>
          <div className="form-item">
            <label>分类</label>
            <Input
              placeholder="例如：数据库/Java/算法"
              value={newSkill.category}
              onChange={v => setNewSkill({ ...newSkill, category: v })}
            />
          </div>
          <div className="form-item">
            <label>父级技能（可选）</label>
            <Select
              allowClear
              placeholder="选择父级技能"
              value={newSkill.parentId ?? undefined}
              onChange={v => setNewSkill({ ...newSkill, parentId: (v as number) || null })}
              style={{ width: '100%' }}
            >
              {skills.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.skill_name}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        title="编辑技能信息"
        visible={showMetaModal}
        onOk={handleSaveMeta}
        onCancel={() => setShowMetaModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <div className="edit-form">
          <div className="form-item">
            <label>技能名称 *</label>
            <Input value={meta.name} onChange={v => setMeta({ ...meta, name: v })} />
          </div>
          <div className="form-item">
            <label>分类</label>
            <Input value={meta.category} onChange={v => setMeta({ ...meta, category: v })} />
          </div>
          <div className="form-item">
            <label>父级技能（可选）</label>
            <Select
              allowClear
              value={meta.parentId ?? undefined}
              onChange={v => setMeta({ ...meta, parentId: (v as number) || null })}
              style={{ width: '100%' }}
            >
              {skills.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.skill_name}</Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SkillTree;
