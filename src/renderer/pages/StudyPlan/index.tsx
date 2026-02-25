import { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Modal,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Tag,
  Progress,
  Empty,
  Message,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconDelete,
  IconEdit,
  IconCheckCircle,
  IconCalendar,
} from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import './styles.css';

const { TextArea } = Input;

interface StudyPlan {
  id: number;
  title: string;
  description: string | null;
  skill_id: number | null;
  skill_name: string | null;
  start_date: number;
  end_date: number;
  target_hours: number;
  completed_hours: number;
  status: number;
  priority: number;
  created_at: number;
  updated_at: number;
}

interface Milestone {
  id: number;
  plan_id: number;
  title: string;
  description: string | null;
  target_date: number | null;
  completed: number;
  completed_at: number | null;
  sort_order: number;
}

interface Skill {
  id: number;
  skill_name: string;
  category: string | null;
  parent_skill_id: number | null;
}

const PRIORITIES = [
  { value: 1, label: '高', color: 'red' },
  { value: 2, label: '中', color: 'orange' },
  { value: 3, label: '低', color: 'green' },
];

function StudyPlan() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<StudyPlan | null>(null);
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    skill_id: null as number | null,
    skill_name: '',
    start_date: dayjs().startOf('day').valueOf(),
    end_date: dayjs().add(30, 'day').endOf('day').valueOf(),
    target_hours: 20,
    priority: 2,
  });
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    description: '',
    target_date: null as number | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansData, skillsData] = await Promise.all([
        (window as any).electronAPI.plans.getAll(),
        (window as any).electronAPI.progress.getAll(),
      ]);
      setPlans(plansData);
      setSkills(skillsData.filter((s: Skill) => !s.parent_skill_id));
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadMilestones = async (planId: number) => {
    try {
      const data = await (window as any).electronAPI.milestones.getByPlanId(planId);
      setMilestones(data);
    } catch (error) {
      console.error('Failed to load milestones:', error);
    }
  };

  const handleSelectPlan = (plan: StudyPlan) => {
    setSelectedPlan(plan);
    loadMilestones(plan.id);
  };

  const handleCreatePlan = async () => {
    if (!newPlan.title.trim()) {
      Message.warning('请输入计划标题');
      return;
    }

    try {
      await (window as any).electronAPI.plans.create(newPlan);
      Message.success('计划创建成功');
      setShowPlanModal(false);
      resetPlanForm();
      loadData();
    } catch (error) {
      console.error('Failed to create plan:', error);
      Message.error('创建失败');
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan || !newPlan.title.trim()) return;

    try {
      await (window as any).electronAPI.plans.update(editingPlan.id, {
        title: newPlan.title,
        description: newPlan.description,
        target_hours: newPlan.target_hours,
        priority: newPlan.priority,
      });
      Message.success('更新成功');
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanForm();
      loadData();
    } catch (error) {
      console.error('Failed to update plan:', error);
      Message.error('更新失败');
    }
  };

  const handleDeletePlan = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个学习计划吗？相关的里程碑也会被删除。',
      onOk: async () => {
        try {
          await (window as any).electronAPI.plans.delete(id);
          Message.success('删除成功');
          if (selectedPlan?.id === id) {
            setSelectedPlan(null);
            setMilestones([]);
          }
          loadData();
        } catch (error) {
          console.error('Failed to delete plan:', error);
          Message.error('删除失败');
        }
      },
    });
  };

  const handleCreateMilestone = async () => {
    if (!selectedPlan || !newMilestone.title.trim()) {
      Message.warning('请输入里程碑标题');
      return;
    }

    try {
      await (window as any).electronAPI.milestones.create({
        plan_id: selectedPlan.id,
        title: newMilestone.title,
        description: newMilestone.description,
        target_date: newMilestone.target_date,
        sort_order: milestones.length,
      });
      Message.success('里程碑创建成功');
      setShowMilestoneModal(false);
      resetMilestoneForm();
      loadMilestones(selectedPlan.id);
    } catch (error) {
      console.error('Failed to create milestone:', error);
      Message.error('创建失败');
    }
  };

  const handleToggleMilestone = async (milestone: Milestone) => {
    try {
      await (window as any).electronAPI.milestones.update(milestone.id, {
        completed: milestone.completed ? 0 : 1,
      });
      loadMilestones(selectedPlan!.id);
    } catch (error) {
      console.error('Failed to update milestone:', error);
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      await (window as any).electronAPI.milestones.delete(id);
      loadMilestones(selectedPlan!.id);
    } catch (error) {
      console.error('Failed to delete milestone:', error);
    }
  };

  const resetPlanForm = () => {
    setNewPlan({
      title: '',
      description: '',
      skill_id: null,
      skill_name: '',
      start_date: dayjs().startOf('day').valueOf(),
      end_date: dayjs().add(30, 'day').endOf('day').valueOf(),
      target_hours: 20,
      priority: 2,
    });
  };

  const resetMilestoneForm = () => {
    setNewMilestone({
      title: '',
      description: '',
      target_date: null,
    });
  };

  const openEditPlan = (plan: StudyPlan) => {
    setEditingPlan(plan);
    setNewPlan({
      title: plan.title,
      description: plan.description || '',
      skill_id: plan.skill_id,
      skill_name: plan.skill_name || '',
      start_date: plan.start_date,
      end_date: plan.end_date,
      target_hours: plan.target_hours,
      priority: plan.priority,
    });
    setShowPlanModal(true);
  };

  const formatDate = (timestamp: number) => {
    return dayjs(timestamp).format('YYYY-MM-DD');
  };

  const getProgressPercent = (plan: StudyPlan) => {
    if (plan.target_hours === 0) return 0;
    return Math.min(100, Math.round((plan.completed_hours / plan.target_hours) * 100));
  };

  const getDaysRemaining = (plan: StudyPlan) => {
    const end = dayjs(plan.end_date);
    const now = dayjs();
    return end.diff(now, 'day');
  };

  const completedMilestones = milestones.filter(m => m.completed).length;

  return (
    <div className="plan-page">
      <div className="plan-header">
        <h1 className="page-title">学习计划</h1>
        <Button
          type="primary"
          icon={<IconPlus />}
          onClick={() => {
            setEditingPlan(null);
            resetPlanForm();
            setShowPlanModal(true);
          }}
        >
          新建计划
        </Button>
      </div>

      <div className="plan-content">
        <Card className="plans-list-card" title="我的计划">
          {plans.length === 0 ? (
            <div style={{ margin: '40px 0', textAlign: 'center' }}>
              <Empty description="暂无学习计划" />
              <Button type="primary" style={{ marginTop: 16 }} onClick={() => setShowPlanModal(true)}>
                创建第一个计划
              </Button>
            </div>
          ) : (
            <div className="plans-list">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  className={`plan-item ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
                  onClick={() => handleSelectPlan(plan)}
                >
                  <div className="plan-item-header">
                    <div className="plan-item-title">
                      <span>{plan.title}</span>
                      <Tag color={PRIORITIES.find(p => p.value === plan.priority)?.color} size="small">
                        {PRIORITIES.find(p => p.value === plan.priority)?.label}
                      </Tag>
                    </div>
                    <div className="plan-item-actions">
                      <Button
                        type="text"
                        size="small"
                        icon={<IconEdit />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditPlan(plan);
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        status="danger"
                        icon={<IconDelete />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                      />
                    </div>
                  </div>
                  <div className="plan-item-date">
                    <IconCalendar />
                    <span>{formatDate(plan.start_date)} - {formatDate(plan.end_date)}</span>
                    {getDaysRemaining(plan) > 0 && (
                      <Tag color="green" size="small">剩余 {getDaysRemaining(plan)} 天</Tag>
                    )}
                    {getDaysRemaining(plan) < 0 && (
                      <Tag color="red" size="small">已过期</Tag>
                    )}
                  </div>
                  <div className="plan-item-progress">
                    <Progress
                      percent={getProgressPercent(plan)}
                      size="small"
                      style={{
                        strokeColor: getProgressPercent(plan) >= 100 ? 'var(--success-strong)' : 'var(--accent-strong)',
                      }}
                    />
                    <span className="progress-text">
                      {plan.completed_hours}/{plan.target_hours}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {selectedPlan && (
          <Card className="plan-detail-card">
            <div className="detail-header">
              <h2>{selectedPlan.title}</h2>
              <Tag color={PRIORITIES.find(p => p.value === selectedPlan.priority)?.color}>
                {PRIORITIES.find(p => p.value === selectedPlan.priority)?.label}优先级
              </Tag>
            </div>

            {selectedPlan.description && (
              <p className="detail-description">{selectedPlan.description}</p>
            )}

            <div className="detail-info">
              <div className="info-item">
                <span className="label">时间范围</span>
                <span className="value">
                  {formatDate(selectedPlan.start_date)} 至 {formatDate(selectedPlan.end_date)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">关联技能</span>
                <span className="value">{selectedPlan.skill_name || '未关联'}</span>
              </div>
              <div className="info-item">
                <span className="label">学习进度</span>
                <span className="value">{selectedPlan.completed_hours}/{selectedPlan.target_hours} 小时</span>
              </div>
            </div>

            <div className="detail-progress">
              <Progress
                percent={getProgressPercent(selectedPlan)}
                style={{
                  strokeColor: getProgressPercent(selectedPlan) >= 100 ? 'var(--success-strong)' : 'var(--accent-strong)',
                }}
                animation
              />
            </div>

            <div className="milestones-section">
              <div className="section-header">
                <h3>里程碑 ({completedMilestones}/{milestones.length})</h3>
                <Button
                  size="small"
                  icon={<IconPlus />}
                  onClick={() => {
                    resetMilestoneForm();
                    setShowMilestoneModal(true);
                  }}
                >
                  添加
                </Button>
              </div>

              {milestones.length === 0 ? (
                <Empty description="暂无里程碑" style={{ margin: '20px 0' }} />
              ) : (
                <div className="milestones-list">
                  {milestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
                    >
                      <Button
                        type="text"
                        icon={<IconCheckCircle />}
                        className={`milestone-check ${milestone.completed ? 'checked' : ''}`}
                        onClick={() => handleToggleMilestone(milestone)}
                      />
                      <div className="milestone-content">
                        <div className="milestone-title">{milestone.title}</div>
                        {milestone.target_date && (
                          <div className="milestone-date">
                            截止: {formatDate(milestone.target_date)}
                          </div>
                        )}
                      </div>
                      <Button
                        type="text"
                        size="small"
                        status="danger"
                        icon={<IconDelete />}
                        onClick={() => handleDeleteMilestone(milestone.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <Modal
        title={editingPlan ? '编辑计划' : '新建学习计划'}
        visible={showPlanModal}
        onOk={editingPlan ? handleUpdatePlan : handleCreatePlan}
        onCancel={() => {
          setShowPlanModal(false);
          setEditingPlan(null);
          resetPlanForm();
        }}
        okText={editingPlan ? '保存' : '创建'}
        cancelText="取消"
        style={{ width: 520 }}
      >
        <div className="plan-form">
          <div className="form-item">
            <label>计划标题 *</label>
            <Input
              placeholder="例如：Spring Boot 学习计划"
              value={newPlan.title}
              onChange={value => setNewPlan({ ...newPlan, title: value })}
            />
          </div>

          <div className="form-item">
            <label>描述</label>
            <TextArea
              placeholder="详细描述这个学习计划..."
              value={newPlan.description}
              onChange={value => setNewPlan({ ...newPlan, description: value })}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>关联技能</label>
              <Select
                placeholder="选择关联技能"
                value={newPlan.skill_id || undefined}
                onChange={(value) => {
                  const skill = skills.find(s => s.id === value);
                  setNewPlan({
                    ...newPlan,
                    skill_id: value || null,
                    skill_name: skill?.skill_name || '',
                  });
                }}
                allowClear
                style={{ width: '100%' }}
              >
                {skills.map(skill => (
                  <Select.Option key={skill.id} value={skill.id}>
                    {skill.skill_name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="form-item">
              <label>优先级</label>
              <Select
                value={newPlan.priority}
                onChange={value => setNewPlan({ ...newPlan, priority: value })}
                style={{ width: '100%' }}
              >
                {PRIORITIES.map(p => (
                  <Select.Option key={p.value} value={p.value}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="form-item">
            <label>目标学习时长（小时）</label>
            <InputNumber
              value={newPlan.target_hours}
              onChange={value => setNewPlan({ ...newPlan, target_hours: value || 0 })}
              min={1}
              max={1000}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>开始日期</label>
              <DatePicker
                value={dayjs(newPlan.start_date)}
                onChange={(value) => setNewPlan({ ...newPlan, start_date: dayjs(value).startOf('day').valueOf() })}
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-item">
              <label>结束日期</label>
              <DatePicker
                value={dayjs(newPlan.end_date)}
                onChange={(value) => setNewPlan({ ...newPlan, end_date: dayjs(value).endOf('day').valueOf() })}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="添加里程碑"
        visible={showMilestoneModal}
        onOk={handleCreateMilestone}
        onCancel={() => {
          setShowMilestoneModal(false);
          resetMilestoneForm();
        }}
        okText="添加"
        cancelText="取消"
      >
        <div className="milestone-form">
          <div className="form-item">
            <label>里程碑标题 *</label>
            <Input
              placeholder="例如：完成第一章学习"
              value={newMilestone.title}
              onChange={value => setNewMilestone({ ...newMilestone, title: value })}
            />
          </div>

          <div className="form-item">
            <label>描述</label>
            <TextArea
              placeholder="里程碑详情..."
              value={newMilestone.description}
              onChange={value => setNewMilestone({ ...newMilestone, description: value })}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </div>

          <div className="form-item">
            <label>目标日期</label>
            <DatePicker
              style={{ width: '100%' }}
              onChange={(date) => {
                setNewMilestone({
                  ...newMilestone,
                  target_date: date ? Number(date.valueOf()) : null,
                });
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default StudyPlan;
