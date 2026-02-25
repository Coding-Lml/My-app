import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card,
  Button,
  Select,
  Modal,
  Input,
  Tag,
  Empty,
  Message,
} from '@arco-design/web-react';
import {
  IconPlayCircle,
  IconPauseCircle,
  IconRefresh,
  IconSettings,
  IconCheckCircle,
  IconClose,
} from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import './styles.css';

interface Todo {
  id: number;
  title: string;
  status: number;
}

interface PomodoroSession {
  id: number;
  start_time: number;
  end_time: number | null;
  duration: number;
  type: string;
  task_id: number | null;
  task_title: string | null;
  completed: number;
}

interface PomodoroStats {
  totalSessions: number;
  completedSessions: number;
  totalDuration: number;
}

const DEFAULT_WORK_TIME = 25;
const DEFAULT_SHORT_BREAK = 5;
const DEFAULT_LONG_BREAK = 15;

function Pomodoro() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [todayStats, setTodayStats] = useState<PomodoroStats>({
    totalSessions: 0,
    completedSessions: 0,
    totalDuration: 0,
  });

  const [mode, setMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_TIME * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);

  const [workTime, setWorkTime] = useState(DEFAULT_WORK_TIME);
  const [shortBreakTime, setShortBreakTime] = useState(DEFAULT_SHORT_BREAK);
  const [longBreakTime, setLongBreakTime] = useState(DEFAULT_LONG_BREAK);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sessionsUntilLongBreak, setSessionsUntilLongBreak] = useState(4);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [todosData, sessionsData, statsData] = await Promise.all([
        (window as any).electronAPI.todos.getAll(),
        (window as any).electronAPI.pomodoro.getAll(20),
        (window as any).electronAPI.pomodoro.getTodayStats(),
      ]);
      setTodos(todosData.filter((t: Todo) => t.status < 2));
      setSessions(sessionsData);
      setTodayStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQkAOJWzqHoJADaQr6F3CQA1kaageAkANZGmoHgJADWRpaB3CQA1kqWgdwkANZKloHcJADWTpaB3CQA1k6WgdwkANZSloHcJADWUpaB3CQA1lKWgdwkANZSloHcJADWUpaB3CQA=');
      void audio.play();
    } catch (error) {
      console.log('Audio notification failed');
    }
  }, []);

  const handleTimerComplete = useCallback(async () => {
    setIsRunning(false);
    playNotificationSound();

    if (mode === 'work' && currentSession) {
      await (window as any).electronAPI.pomodoro.update(currentSession.id, {
        completed: 1,
        end_time: Date.now(),
      });

      const newSessionsUntilLongBreak = sessionsUntilLongBreak - 1;
      setSessionsUntilLongBreak(newSessionsUntilLongBreak);

      if (newSessionsUntilLongBreak <= 0) {
        setMode('longBreak');
        setTimeLeft(longBreakTime * 60);
        setSessionsUntilLongBreak(4);
        Message.success('太棒了！完成了4个番茄钟，休息一下吧！');
      } else {
        setMode('shortBreak');
        setTimeLeft(shortBreakTime * 60);
        Message.success('番茄钟完成！休息一下~');
      }
    } else {
      setMode('work');
      setTimeLeft(workTime * 60);
      Message.info('休息结束，继续加油！');
    }

    setCurrentSession(null);
    void loadData();
  }, [currentSession, loadData, longBreakTime, mode, playNotificationSound, sessionsUntilLongBreak, shortBreakTime, workTime]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      void handleTimerComplete();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [handleTimerComplete, isRunning, timeLeft]);

  const handleStart = async () => {
    if (mode === 'work') {
      const session = await (window as any).electronAPI.pomodoro.save({
        start_time: Date.now(),
        duration: workTime,
        type: 'work',
        task_id: selectedTask?.id || null,
        task_title: selectedTask?.title || null,
        completed: 0,
      });
      setCurrentSession(session);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    const times = {
      work: workTime * 60,
      shortBreak: shortBreakTime * 60,
      longBreak: longBreakTime * 60,
    };
    setTimeLeft(times[mode]);
    if (currentSession && !currentSession.completed) {
      (window as any).electronAPI.pomodoro.update(currentSession.id, {
        completed: 0,
        end_time: Date.now(),
      });
      setCurrentSession(null);
    }
  };

  const handleModeChange = (newMode: 'work' | 'shortBreak' | 'longBreak') => {
    if (isRunning) {
      Modal.confirm({
        title: '切换模式',
        content: '计时器正在运行，确定要切换吗？',
        onOk: () => {
          setIsRunning(false);
          setMode(newMode);
          const times = {
            work: workTime * 60,
            shortBreak: shortBreakTime * 60,
            longBreak: longBreakTime * 60,
          };
          setTimeLeft(times[newMode]);
          if (currentSession) {
            (window as any).electronAPI.pomodoro.update(currentSession.id, {
              completed: 0,
              end_time: Date.now(),
            });
            setCurrentSession(null);
          }
        },
      });
    } else {
      setMode(newMode);
      const times = {
        work: workTime * 60,
        shortBreak: shortBreakTime * 60,
        longBreak: longBreakTime * 60,
      };
      setTimeLeft(times[newMode]);
    }
  };

  const handleSaveSettings = () => {
    setShowSettingsModal(false);
    if (!isRunning) {
      const times = {
        work: workTime * 60,
        shortBreak: shortBreakTime * 60,
        longBreak: longBreakTime * 60,
      };
      setTimeLeft(times[mode]);
    }
    Message.success('设置已保存');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
  };

  const progress = mode === 'work'
    ? ((workTime * 60 - timeLeft) / (workTime * 60)) * 100
    : mode === 'shortBreak'
    ? ((shortBreakTime * 60 - timeLeft) / (shortBreakTime * 60)) * 100
    : ((longBreakTime * 60 - timeLeft) / (longBreakTime * 60)) * 100;

  const modeLabels = {
    work: '专注时间',
    shortBreak: '短休息',
    longBreak: '长休息',
  };

  const modeColors = {
    work: 'var(--danger-strong)',
    shortBreak: 'var(--success-strong)',
    longBreak: 'var(--accent-strong)',
  };

  return (
    <div className="pomodoro-page">
      <div className="pomodoro-header">
        <h1 className="page-title">番茄钟</h1>
        <Button
          icon={<IconSettings />}
          onClick={() => setShowSettingsModal(true)}
        >
          设置
        </Button>
      </div>

      <div className="pomodoro-content">
        <div className="pomodoro-main">
          <Card className="timer-card">
            <div className="mode-tabs">
              {(['work', 'shortBreak', 'longBreak'] as const).map(m => (
                <div
                  key={m}
                  className={`mode-tab ${mode === m ? 'active' : ''}`}
                  onClick={() => handleModeChange(m)}
                  style={{ '--active-color': modeColors[m] } as React.CSSProperties}
                >
                  {modeLabels[m]}
                </div>
              ))}
            </div>

            <div className="timer-display">
              <div className="timer-circle" style={{ borderColor: modeColors[mode] }}>
                <div className="timer-inner">
                  <div className="timer-time">{formatTime(timeLeft)}</div>
                  <div className="timer-label">{modeLabels[mode]}</div>
                </div>
                <svg className="timer-svg" viewBox="0 0 100 100">
                  <circle
                    className="timer-bg"
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="4"
                  />
                  <circle
                    className="timer-progress"
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="4"
                    stroke={modeColors[mode]}
                    strokeDasharray={`${progress * 2.83} ${283 - progress * 2.83}`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            </div>

            <div className="timer-controls">
              {!isRunning ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<IconPlayCircle />}
                  onClick={handleStart}
                  style={{ background: modeColors[mode], borderColor: modeColors[mode] }}
                >
                  开始
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<IconPauseCircle />}
                  onClick={handlePause}
                  status="warning"
                >
                  暂停
                </Button>
              )}
              <Button
                size="large"
                icon={<IconRefresh />}
                onClick={handleReset}
              >
                重置
              </Button>
            </div>

            {mode === 'work' && (
              <div className="task-selector">
                <label>关联任务</label>
                <Select
                  placeholder="选择一个任务（可选）"
                  value={selectedTask?.id}
                  onChange={(value) => {
                    const task = todos.find(t => t.id === value);
                    setSelectedTask(task || null);
                  }}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {todos.map(todo => (
                    <Select.Option key={todo.id} value={todo.id}>
                      {todo.title}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            )}

            <div className="session-indicator">
              <span>距离长休息还有</span>
              <div className="session-dots">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`session-dot ${i < sessionsUntilLongBreak ? '' : 'completed'}`}
                  />
                ))}
              </div>
              <span>{sessionsUntilLongBreak} 个番茄钟</span>
            </div>
          </Card>

          <Card title="今日统计" className="stats-card">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{todayStats.completedSessions}</div>
                <div className="stat-label">完成番茄钟</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatDuration(todayStats.totalDuration)}</div>
                <div className="stat-label">专注时长</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{todayStats.totalSessions}</div>
                <div className="stat-label">总番茄钟</div>
              </div>
            </div>
          </Card>
        </div>

        <Card title="历史记录" className="history-card">
          {sessions.length === 0 ? (
            <Empty description="暂无记录" style={{ margin: '20px 0' }} />
          ) : (
            <div className="history-list">
              {sessions.map(session => (
                <div key={session.id} className="history-item">
                  <div className="history-icon">
                    {session.completed ? (
                      <IconCheckCircle style={{ color: 'var(--success-strong)', fontSize: 20 }} />
                    ) : (
                      <IconClose style={{ color: 'var(--danger-strong)', fontSize: 20 }} />
                    )}
                  </div>
                  <div className="history-info">
                    <div className="history-title">
                      {session.task_title || '专注时间'}
                      {session.completed && <Tag color="green" size="small">完成</Tag>}
                    </div>
                    <div className="history-meta">
                      {dayjs(session.start_time).format('MM-DD HH:mm')}
                      {' · '}
                      {session.duration}分钟
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        title="番茄钟设置"
        visible={showSettingsModal}
        onOk={handleSaveSettings}
        onCancel={() => setShowSettingsModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <div className="settings-form">
          <div className="form-item">
            <label>专注时长（分钟）</label>
            <Input
              type="number"
              value={String(workTime)}
              onChange={value => setWorkTime(Math.max(1, Math.min(120, parseInt(value) || 25)))}
              min={1}
              max={120}
            />
          </div>
          <div className="form-item">
            <label>短休息时长（分钟）</label>
            <Input
              type="number"
              value={String(shortBreakTime)}
              onChange={value => setShortBreakTime(Math.max(1, Math.min(30, parseInt(value) || 5)))}
              min={1}
              max={30}
            />
          </div>
          <div className="form-item">
            <label>长休息时长（分钟）</label>
            <Input
              type="number"
              value={String(longBreakTime)}
              onChange={value => setLongBreakTime(Math.max(1, Math.min(60, parseInt(value) || 15)))}
              min={1}
              max={60}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Pomodoro;
