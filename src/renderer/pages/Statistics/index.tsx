import { useEffect, useState } from 'react';
import {
  Card,
  Grid,
  Progress,
  Empty,
  Tabs,
} from '@arco-design/web-react';
import { IconBook, IconCode, IconClockCircle } from '@arco-design/web-react/icon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './styles.css';

const { Row, Col } = Grid;

interface StudyProgress {
  id: number;
  skill_name: string;
  category: string | null;
  level: number;
  target_level: number;
  time_spent: number;
  notes_count: number;
  code_count: number;
  order_index: number;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  unlocked: number;
  unlocked_at: number | null;
}

function Statistics() {
  const [progress, setProgress] = useState<StudyProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [progressData, allAchievements, unlockedData] = await Promise.all([
        (window as any).electronAPI.progress.getAll(),
        (window as any).electronAPI.achievements.getAll(),
        (window as any).electronAPI.achievements.getUnlocked(),
      ]);
      setProgress(progressData);
      setAchievements(allAchievements);
      setUnlockedAchievements(unlockedData);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const chartData = progress.map(p => ({
    name: p.skill_name,
    notes: p.notes_count,
    code: p.code_count,
    time: Math.round(p.time_spent / 60),
  }));

  const categoryData = [
    { name: 'Java', value: progress.filter(p => p.category === 'Java').reduce((sum, p) => sum + p.level, 0) },
    { name: '算法', value: progress.filter(p => p.category === '算法').reduce((sum, p) => sum + p.level, 0) },
    { name: '数据库', value: progress.filter(p => p.category === '数据库').reduce((sum, p) => sum + p.level, 0) },
    { name: '其他', value: progress.filter(p => !['Java', '算法', '数据库'].includes(p.category || '')).reduce((sum, p) => sum + p.level, 0) },
  ].filter(d => d.value > 0);

  const CHART_COLORS = ['#5d8f79', '#4c8a68', '#b88c4f', '#bf6a70', '#7aa891'];

  if (loading) {
    return <Empty description="加载中..." style={{ marginTop: 100 }} />;
  }

  return (
    <div className="stats-page">
      <h1 className="page-title">统计分析</h1>

      <Tabs defaultActiveTab="progress">
        <Tabs.TabPane key="progress" title="学习进度">
          <div className="stats-content">
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card title="技能分布" style={{ borderRadius: 12, height: 350 }}>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill={CHART_COLORS[0]}
                          dataKey="value"
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" style={{ marginTop: 80 }} />
                  )}
                </Card>
              </Col>

              <Col span={12}>
                <Card title="学习活动" style={{ borderRadius: 12, height: 350 }}>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="notes" fill={CHART_COLORS[0]} name="笔记数" />
                        <Bar dataKey="code" fill={CHART_COLORS[1]} name="代码数" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="暂无数据" style={{ marginTop: 80 }} />
                  )}
                </Card>
              </Col>
            </Row>

            <Card title="技能详情" style={{ borderRadius: 12 }}>
              <div className="skills-grid">
                {progress.map(skill => (
                  <Card key={skill.id} className="skill-card">
                    <div className="skill-header">
                      <h3 className="skill-name">{skill.skill_name}</h3>
                      {skill.category && <span className="skill-tag">{skill.category}</span>}
                    </div>

                    <div className="skill-stats">
                      <div className="stat-row">
                        <IconBook />
                        <span>{skill.notes_count} 篇笔记</span>
                      </div>
                      <div className="stat-row">
                        <IconCode />
                        <span>{skill.code_count} 段代码</span>
                      </div>
                      <div className="stat-row">
                        <IconClockCircle />
                        <span>{formatTime(skill.time_spent)} 学习时长</span>
                      </div>
                    </div>

                    <div className="skill-progress">
                      <div className="progress-label">
                        <span>进度</span>
                        <span>{Math.round(skill.level)}%</span>
                      </div>
                      <Progress
                        percent={skill.level}
                        style={{
                          strokeColor:
                            skill.level >= 80
                              ? 'var(--success-strong)'
                              : skill.level >= 50
                                ? 'var(--warn-strong)'
                                : 'var(--accent-strong)',
                        }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane key="achievements" title="成就系统">
          <div className="stats-content">
            <Card title="已解锁成就" style={{ borderRadius: 12, marginBottom: 24 }}>
              {unlockedAchievements.length > 0 ? (
                <div className="achievements-grid">
                  {unlockedAchievements.map((achievement: Achievement) => (
                    <Card key={achievement.id} className="achievement-card unlocked">
                      <div className="achievement-icon">{achievement.icon}</div>
                      <div className="achievement-info">
                        <div className="achievement-name">{achievement.name}</div>
                        <div className="achievement-desc">{achievement.description}</div>
                        <div className="achievement-date">
                          {achievement.unlocked_at
                            ? new Date(achievement.unlocked_at).toLocaleDateString('zh-CN')
                            : ''}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty description="暂无已解锁成就" style={{ marginTop: 60 }} />
              )}
            </Card>

            <Card title="待解锁成就" style={{ borderRadius: 12 }}>
              <div className="achievements-grid">
                {achievements
                  .filter(a => !unlockedAchievements.some(ua => ua.id === a.id))
                  .map(achievement => (
                    <Card key={achievement.id} className="achievement-card locked">
                      <div className="achievement-icon">{achievement.icon}</div>
                      <div className="achievement-info">
                        <div className="achievement-name">{achievement.name}</div>
                        <div className="achievement-desc">{achievement.description}</div>
                        <div className="achievement-condition">
                          条件: {achievement.condition_type} ≥ {achievement.condition_value}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </Card>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}

export default Statistics;
