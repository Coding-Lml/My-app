import { useEffect, useState } from 'react';
import {
  Layout,
  Button,
  Input,
  Modal,
  Card,
  DatePicker,
  Select,
  Radio,
  Message,
} from '@arco-design/web-react';
import { IconPlus, IconCheckCircle } from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import PageHeader from '../../components/UI/PageHeader';
import PageContextBar from '../../components/UI/PageContextBar';
import EmptyState from '../../components/UI/EmptyState';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableTodoItem } from './components/SortableTodoItem';
import './styles.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: number;
  status: number;
  category: string | null;
  due_date: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

const PRIORITIES = [
  { value: 1, label: '高', color: 'red' },
  { value: 2, label: '中', color: 'orange' },
  { value: 3, label: '低', color: 'green' },
];

const CATEGORIES = ['学习', '项目', '面试', '其他'];

function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showNewTodoModal, setShowNewTodoModal] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 2,
    category: '学习',
    due_date: null as number | null,
  });

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const data = await window.electronAPI.todos.getAll();
      setTodos(data);
      if (manualOrder.length === 0 && data.length > 0) {
        setManualOrder(data.map((t: Todo) => t.id));
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    }
  };

  const handleCreateTodo = async () => {
    if (!newTodo.title.trim()) return;

    try {
      await window.electronAPI.todos.create(newTodo);
      setNewTodo({
        title: '',
        description: '',
        priority: 2,
        category: '学习',
        due_date: null,
      });
      setShowNewTodoModal(false);
      loadTodos();
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      await window.electronAPI.todos.update(todo.id, {
        status: todo.status === 2 ? 0 : 2,
      });
      loadTodos();
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个待办事项吗？',
      onOk: async () => {
        try {
          await window.electronAPI.todos.delete(id);
          loadTodos();
        } catch (error) {
          console.error('Failed to delete todo:', error);
        }
      },
    });
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'pending') return todo.status < 2;
    if (filter === 'completed') return todo.status === 2;
    return true;
  });

  const handleClearCompleted = async () => {
    Modal.confirm({
      title: '清空已完成项',
      content: '确定要删除所有已完成的待办事项吗？此操作不可恢复。',
      onOk: async () => {
        try {
          // Since deleting multiple isn't explicitly defined, we'll map delete over completed
          const completedIds = todos.filter(t => t.status === 2).map(t => t.id);
          let allSuccess = true;
          for (const id of completedIds) {
            const result = await window.electronAPI.todos.delete(id);
            if (!result.success) allSuccess = false;
          }
          if (allSuccess) {
            Message.success('已清空');
            await loadTodos();
          } else {
            Message.error('部分清空失败');
            await loadTodos(); // reload anyway to get up-to-date state
          }
        } catch (error) {
          console.error('Failed to clear completed todos:', error);
          Message.error('清空失败');
        }
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setManualOrder((items) => {
        const oldIndex = items.indexOf(active.id as number);
        const newIndex = items.indexOf(over.id as number);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    // If they have manual order, use it. Otherwise fallback to status/priority
    const idxA = manualOrder.indexOf(a.id);
    const idxB = manualOrder.indexOf(b.id);

    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }

    if (a.status !== b.status) return a.status - b.status;
    return a.priority - b.priority;
  });

  const getPriorityLabel = (priority: number) => {
    return PRIORITIES.find(p => p.value === priority)?.label;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    return dayjs(timestamp).format('YYYY-MM-DD');
  };

  const isOverdue = (todo: Todo) => {
    if (!todo.due_date || todo.status === 2) return false;
    return dayjs(todo.due_date).isBefore(dayjs(), 'day');
  };

  const getPriorityColor = (priority: number) => {
    return PRIORITIES.find(p => p.value === priority)?.color || 'gray';
  };

  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status < 2).length,
    completed: todos.filter(t => t.status === 2).length,
  };

  return (
    <div className="todos-page fade-in">
      <PageHeader
        title="待办事项"
        subtitle="管理你的日常任务，保持高效学习"
        actions={[
          {
            label: '添加任务',
            onClick: () => setShowNewTodoModal(true),
            type: 'primary',
            icon: <IconPlus />
          }
        ]}
      />

      <PageContextBar
        label="Filter Status"
        value={filter === 'all' ? '全部任务' : filter === 'pending' ? '进行中' : '已完成'}
        metrics={[
          {
            label: 'Total',
            value: stats.total,
            type: 'default'
          },
          {
            label: 'Pending',
            value: stats.pending,
            type: 'warning'
          },
          {
            label: 'Completed',
            value: stats.completed,
            type: 'success'
          }
        ]}
      />

      <Layout className="todos-layout">
        <Sider width={320} className="todos-sidebar">
          <Card className="stats-card">
            <div className="stat-item">
              <div className="stat-label">总任务</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">进行中</div>
              <div className="stat-value pending">{stats.pending}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">已完成</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {stats.completed > 0 && (
                  <Button type="text" size="mini" status="danger" onClick={handleClearCompleted}>
                    清空
                  </Button>
                )}
                <div className="stat-value completed">{stats.completed}</div>
              </div>
            </div>
          </Card>

          <Card title="筛选" className="filter-card">
            <Radio.Group
              type="button"
              value={filter}
              onChange={setFilter}
              style={{ width: '100%', display: 'flex', gap: 8 }}
            >
              <Radio value="all">全部</Radio>
              <Radio value="pending">进行中</Radio>
              <Radio value="completed">已完成</Radio>
            </Radio.Group>
          </Card>
        </Sider>

        <Content className="todos-content">
          {sortedTodos.length === 0 ? (
            <div className="todos-empty-wrapper">
              <EmptyState
                icon={<IconCheckCircle style={{ fontSize: 64, marginBottom: 16, color: 'var(--status-success)' }} />}
                title="暂无待办事项"
                description="点击下方按钮即可创建。保持专注，逐个击破！"
              >
                <Button type="primary" icon={<IconPlus />} onClick={() => setShowNewTodoModal(true)}>
                  添加第一个任务
                </Button>
              </EmptyState>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedTodos.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="todos-list">
                  {sortedTodos.map((todo) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      isOverdue={isOverdue}
                      getPriorityColor={getPriorityColor}
                      getPriorityLabel={getPriorityLabel}
                      formatDate={formatDate}
                      onToggle={handleToggleTodo}
                      onDelete={handleDeleteTodo}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Content>
      </Layout>

      <Modal
        title="添加任务"
        visible={showNewTodoModal}
        onOk={handleCreateTodo}
        onCancel={() => {
          setShowNewTodoModal(false);
          setNewTodo({
            title: '',
            description: '',
            priority: 2,
            category: '学习',
            due_date: null,
          });
        }}
        okText="添加"
        cancelText="取消"
      >
        <div className="todo-form">
          <div className="form-item">
            <label>任务标题 *</label>
            <Input
              placeholder="输入任务标题"
              value={newTodo.title}
              onChange={value => setNewTodo({ ...newTodo, title: value })}
              autoFocus
            />
          </div>

          <div className="form-item">
            <label>描述</label>
            <TextArea
              placeholder="添加任务描述..."
              value={newTodo.description || ''}
              onChange={value => setNewTodo({ ...newTodo, description: value })}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </div>

          <div className="form-row">
            <div className="form-item">
              <label>优先级</label>
              <Select
                value={newTodo.priority}
                onChange={value => setNewTodo({ ...newTodo, priority: value })}
                style={{ width: '100%' }}
              >
                {PRIORITIES.map(p => (
                  <Select.Option key={p.value} value={p.value}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="form-item">
              <label>分类</label>
              <Select
                value={newTodo.category}
                onChange={value => setNewTodo({ ...newTodo, category: value })}
                style={{ width: '100%' }}
              >
                {CATEGORIES.map(c => (
                  <Select.Option key={c} value={c}>
                    {c}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="form-item">
            <label>截止日期</label>
            <DatePicker
              style={{ width: '100%' }}
              onChange={(date) => {
                setNewTodo({
                  ...newTodo,
                  due_date: date ? Number(date.valueOf()) : null,
                });
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Todos;
