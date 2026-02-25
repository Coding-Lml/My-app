import { useEffect, useState } from 'react';
import {
  Layout,
  List,
  Button,
  Input,
  Modal,
  Tag,
  Empty,
  Card,
  DatePicker,
  Select,
  Radio,
} from '@arco-design/web-react';
import { IconPlus, IconDelete, IconCheckCircle } from '@arco-design/web-react/icon';
import dayjs from 'dayjs';
import './styles.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;

interface Todo {
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

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (a.status !== b.status) return a.status - b.status;
    return a.priority - b.priority;
  });

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
    <div className="todos-page">
      <div className="todos-header">
        <h1 className="page-title">待办事项</h1>
        <Button type="primary" icon={<IconPlus />} onClick={() => setShowNewTodoModal(true)}>
          添加任务
        </Button>
      </div>

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
              <div className="stat-value completed">{stats.completed}</div>
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
            <Empty description="暂无待办事项" style={{ marginTop: 80 }} />
          ) : (
            <List
              className="todos-list"
              dataSource={sortedTodos}
              render={(todo: Todo) => (
                <List.Item
                  key={todo.id}
                  className={`todo-item ${todo.status === 2 ? 'completed' : ''} ${isOverdue(todo) ? 'overdue' : ''}`}
                >
                  <div className="todo-item-content">
                    <div className="todo-item-main">
                      <Button
                        type="text"
                        icon={<IconCheckCircle />}
                        className={`todo-checkbox ${todo.status === 2 ? 'checked' : ''}`}
                        onClick={() => handleToggleTodo(todo)}
                      />
                      <div className="todo-info">
                        <div className="todo-title">{todo.title}</div>
                        {todo.description && (
                          <div className="todo-description">{todo.description}</div>
                        )}
                        <div className="todo-meta">
                          <Tag color={getPriorityColor(todo.priority)} bordered>
                            {PRIORITIES.find(p => p.value === todo.priority)?.label}优先级
                          </Tag>
                          {todo.category && <Tag>{todo.category}</Tag>}
                          {todo.due_date && (
                            <Tag color={isOverdue(todo) ? 'red' : 'green'}>
                              {formatDate(todo.due_date)}
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="text"
                      status="danger"
                      icon={<IconDelete />}
                      onClick={() => handleDeleteTodo(todo.id)}
                    />
                  </div>
                </List.Item>
              )}
            />
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
