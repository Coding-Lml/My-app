import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Progress, InputNumber, Message } from '@arco-design/web-react';
import {
  IconFire,
  IconClockCircle,
  IconCalendar,
  IconCheckCircle,
  IconPlayCircle,
  IconPauseCircle,
} from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import PageHeader from '../../components/UI/PageHeader';
import PageContextBar from '../../components/UI/PageContextBar';
import KpiCard from '../../components/UI/KpiCard';
import './styles.css';

interface CheckIn {
  id: number;
  date: number;
  start_time: number | null;
  end_time: number | null;
  duration: number;
  tasks_completed: number;
  notes_count: number;
  code_runs: number;
  created_at: number;
}

interface CheckInStats {
  consecutiveDays: number;
  totalDays: number;
  totalDuration: number;
  totalTasks: number;
  thisMonthDays: number;
  thisMonthDuration: number;
}

interface HeatmapDay {
  date: string;
  duration: number;
  isToday: boolean;
  isFuture: boolean;
}

function CheckIn() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState<CheckInStats>({
    consecutiveDays: 0,
    totalDays: 0,
    totalDuration: 0,
    totalTasks: 0,
    thisMonthDays: 0,
    thisMonthDuration: 0,
  });
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<number | null>(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(120);

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isStudying && studyStartTime) {
      interval = setInterval(() => {
        setCurrentDuration(Math.floor((Date.now() - studyStartTime) / 1000 / 60));
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isStudying, studyStartTime]);

  const loadData = async () => {
    try {
      const [checkInsData, statsData, today] = await Promise.all([
        window.electronAPI.checkins.getAll(200),
        window.electronAPI.checkins.stats(),
        window.electronAPI.checkins.getByDate(dayjs().startOf('day').valueOf()),
      ]);

      setCheckIns(checkInsData);
      setStats(statsData);
      setTodayCheckIn(today);

      if (today && today.start_time && !today.end_time) {
        setIsStudying(true);
        setStudyStartTime(today.start_time);
        setCurrentDuration(Math.floor((Date.now() - today.start_time) / 1000 / 60));
      } else {
        setIsStudying(false);
        setStudyStartTime(null);
      }
    } catch (error) {
      console.error('Failed to load check-in data:', error);
      Message.error('加载打卡数据失败');
    }
  };

  const loadSettings = async () => {
    try {
      const goal = await window.electronAPI.settings.get('dailyGoal');
      if (goal) {
        const parsed = parseInt(goal, 10);
        if (!Number.isNaN(parsed)) {
          setDailyGoal(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleStartStudy = async () => {
    try {
      const today = dayjs().startOf('day').valueOf();
      const checkIn = await window.electronAPI.checkins.start(today);
      const startTime = checkIn?.start_time ?? Date.now();
      setTodayCheckIn(checkIn);
      setIsStudying(true);
      setStudyStartTime(startTime);
      setCurrentDuration(Math.floor((Date.now() - startTime) / 1000 / 60));
      Message.success('已开始学习');
    } catch (error) {
      console.error('Failed to start study:', error);
      Message.error('开始失败');
    }
  };

  const handleEndStudy = async () => {
    const date = todayCheckIn?.date ?? dayjs().startOf('day').valueOf();
    try {
      const checkIn = await window.electronAPI.checkins.end(date, currentDuration);
      setTodayCheckIn(checkIn);
      setIsStudying(false);
      setStudyStartTime(null);
      setCurrentDuration(checkIn?.duration ?? currentDuration);
      await loadData();
      Message.success(`本次学习 ${currentDuration} 分钟`);
    } catch (error) {
      console.error('Failed to end study:', error);
      Message.error('结束失败');
    }
  };

  const handleGoalChange = async (value: number | undefined) => {
    const normalized = Math.min(720, Math.max(10, Number(value) || 120));
    setDailyGoal(normalized);

    try {
      await window.electronAPI.settings.set('dailyGoal', String(normalized), 'study');
    } catch (error) {
      console.error('Failed to save daily goal:', error);
      Message.error('保存目标失败');
    }
  };

  const formatDuration = (minutes: number) => {
    const safe = Math.max(0, minutes);
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getHeatmapColor = (duration: number) => {
    if (duration === 0) return 'var(--surface-soft-hover)';
    if (duration < 30) return 'var(--accent-step-3)';
    if (duration < 60) return 'var(--accent-step-4)';
    if (duration < 120) return 'var(--accent-step-5)';
    return 'var(--accent-strong)';
  };

  const weeks = useMemo(() => {
    const map: Record<string, CheckIn> = {};
    checkIns.forEach((item) => {
      map[dayjs(item.date).format('YYYY-MM-DD')] = item;
    });

    const weekList: HeatmapDay[][] = [];
    const today = dayjs();
    const startDate = today.startOf('week').subtract(25, 'week');

    for (let week = 0; week < 26; week += 1) {
      const days: HeatmapDay[] = [];
      for (let day = 0; day < 7; day += 1) {
        const date = startDate.add(week * 7 + day, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const checkIn = map[dateStr];
        days.push({
          date: dateStr,
          duration: checkIn?.duration || 0,
          isToday: date.isSame(today, 'day'),
          isFuture: date.isAfter(today, 'day'),
        });
      }
      weekList.push(days);
    }

    return weekList;
  }, [checkIns]);

  const todayDuration = todayCheckIn?.duration || currentDuration;
  const progressPercent = Math.min((todayDuration / Math.max(1, dailyGoal)) * 100, 100);
  const goalRemaining = Math.max(dailyGoal - todayDuration, 0);

  const statusText = isStudying ? '学习中' : todayDuration > 0 ? '今日已打卡' : '尚未开始';
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="checkin-page fade-in">
      <PageHeader
        title="学习打卡"
        subtitle="记录你的学习历程，保持专注与坚持"
      />

      <PageContextBar
        label="Today Deck"
        value={`${dayjs().format('YYYY年MM月DD日')} · 星期${weekdays[dayjs().day()]}`}
        metrics={[
          {
            label: 'Status',
            value: statusText,
            type: isStudying ? 'accent' : todayDuration > 0 ? 'success' : 'warning'
          },
          {
            label: 'Streak',
            value: `连续 ${stats.consecutiveDays} 天`,
            type: 'accent'
          },
          {
            label: 'Remaining',
            value: `剩余 ${goalRemaining} 分钟`,
            type: 'warning'
          }
        ]}
      />

      <div className="checkin-deck stagger-children">
        <Card className="checkin-primary-card">
          <div className="checkin-primary-header">
            <div className="today-date">
              <IconCalendar />
              <span>{dayjs().format('YYYY年MM月DD日')} {weekdays[dayjs().day()]}</span>
            </div>
            <span className={`status-badge ${isStudying ? 'active' : todayDuration > 0 ? 'done' : 'idle'}`}>
              {statusText}
            </span>
          </div>

          <div className={`timer-display${isStudying ? ' is-studying pulse-active' : ''}`}>{formatDuration(todayDuration)}</div>
          <div className="timer-hint">今日累计学习时长</div>

          <div className="checkin-actions">
            {isStudying ? (
              <Button
                type="primary"
                status="danger"
                size="large"
                icon={<IconPauseCircle />}
                onClick={handleEndStudy}
              >
                结束学习
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<IconPlayCircle />}
                onClick={handleStartStudy}
              >
                开始学习
              </Button>
            )}
          </div>

          <div className="goal-section">
            <div className="goal-header">
              <span>每日目标（分钟）</span>
              <InputNumber
                min={10}
                max={720}
                value={dailyGoal}
                onChange={(value) => handleGoalChange(value as number)}
                size="small"
              />
            </div>

            <div className="goal-progress-info">
              <span>{todayDuration} / {dailyGoal} 分钟</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <Progress percent={progressPercent} animation />
            {progressPercent >= 100 && (
              <div className="goal-achieved">今日目标已完成</div>
            )}
          </div>
        </Card>

        <Card className="checkin-stats-card" title="学习概览" bordered={false}>
          <div className="kpi-grid stagger-children">
            <KpiCard
              title="连续打卡"
              value={stats.consecutiveDays}
              icon={<IconFire />}
              trend={{ value: 12, isUp: true }}
              className="fire"
            />
            <KpiCard
              title="累计打卡"
              value={stats.totalDays}
              icon={<IconCalendar />}
              className="calendar"
            />
            <KpiCard
              title="累计学习"
              value={formatDuration(stats.totalDuration)}
              icon={<IconClockCircle />}
              className="clock"
            />
            <KpiCard
              title="本月打卡"
              value={stats.thisMonthDays}
              icon={<IconCalendar />}
              className="month"
            />
            <KpiCard
              title="本月学习"
              value={formatDuration(stats.thisMonthDuration)}
              icon={<IconClockCircle />}
              className="month-clock"
            />
            <KpiCard
              title="完成任务"
              value={stats.totalTasks}
              icon={<IconCheckCircle />}
              className="tasks"
            />
          </div>
        </Card>
      </div>

      <Card title="最近 26 周热力图" className="heatmap-card">
        <div className="heatmap-grid-wrapper">
          <div className="heatmap-weekdays">
            {weekdays.map((day, index) => (
              <div key={day} className="heatmap-weekday">{index % 2 === 0 ? day : ''}</div>
            ))}
          </div>

          <div className="heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="heatmap-week">
                {week.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`heatmap-day ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`}
                    style={{ backgroundColor: getHeatmapColor(day.duration) }}
                    title={`${day.date} · ${day.duration} 分钟`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="heatmap-legend">
          <span>少</span>
          <div className="heatmap-legend-item" style={{ background: 'var(--surface-soft-hover)' }} />
          <div className="heatmap-legend-item" style={{ background: 'var(--accent-step-3)' }} />
          <div className="heatmap-legend-item" style={{ background: 'var(--accent-step-4)' }} />
          <div className="heatmap-legend-item" style={{ background: 'var(--accent-step-5)' }} />
          <div className="heatmap-legend-item" style={{ background: 'var(--accent-strong)' }} />
          <span>多</span>
        </div>
      </Card>
    </div>
  );
}

export default CheckIn;
