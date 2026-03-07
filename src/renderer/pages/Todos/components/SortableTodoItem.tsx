import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Tag } from '@arco-design/web-react';
import { IconCheckCircle, IconDelete, IconDragDotVertical } from '@arco-design/web-react/icon';
import type { Todo } from '../index';

interface SortableTodoItemProps {
    todo: Todo;
    isOverdue: (todo: Todo) => boolean;
    getPriorityColor: (p: number) => string;
    getPriorityLabel: (p: number) => string | undefined;
    formatDate: (ts: number | null) => string;
    onToggle: (todo: Todo) => void;
    onDelete: (id: number) => void;
}

export function SortableTodoItem({
    todo,
    isOverdue,
    getPriorityColor,
    getPriorityLabel,
    formatDate,
    onToggle,
    onDelete,
}: SortableTodoItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: todo.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 1 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`todo-item ${todo.status === 2 ? 'completed' : ''} ${isOverdue(todo) ? 'overdue' : ''}`}
        >
            <div className="todo-item-content">
                <div className="todo-item-main">
                    <div
                        className="todo-drag-handle"
                        {...attributes}
                        {...listeners}
                        style={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'var(--text-faint)' }}
                    >
                        <IconDragDotVertical style={{ fontSize: 16 }} />
                    </div>
                    <Button
                        type="text"
                        icon={<IconCheckCircle />}
                        className={`todo-checkbox ${todo.status === 2 ? 'checked' : ''}`}
                        onClick={() => onToggle(todo)}
                    />
                    <div className="todo-info">
                        <div className="todo-title">{todo.title}</div>
                        {todo.description && <div className="todo-description">{todo.description}</div>}
                        <div className="todo-meta">
                            <Tag color={getPriorityColor(todo.priority)} bordered>
                                {getPriorityLabel(todo.priority)}优先级
                            </Tag>
                            {todo.category && <Tag>{todo.category}</Tag>}
                            {todo.due_date && (
                                <Tag color={isOverdue(todo) ? 'red' : 'green'}>{formatDate(todo.due_date)}</Tag>
                            )}
                        </div>
                    </div>
                </div>
                <Button
                    type="text"
                    status="danger"
                    icon={<IconDelete />}
                    onClick={() => onDelete(todo.id)}
                />
            </div>
        </div>
    );
}
