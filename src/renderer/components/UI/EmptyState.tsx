import React from 'react';
import { Empty, Button, Typography } from '@arco-design/web-react';
import './EmptyState.css';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title?: string;
    description?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    children?: React.ReactNode;
    type?: 'default' | 'error' | 'search';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    children,
    type = 'default'
}) => {
    return (
        <div className={`empty-state-wrapper ${type}`}>
            <Empty
                icon={icon}
                description={
                    <div className="empty-state-content">
                        {title && <Typography.Title heading={5} className="empty-state-title">{title}</Typography.Title>}
                        {description && <div className="empty-state-description">{description}</div>}
                        {(actionLabel || children) && (
                            <div className="empty-state-actions">
                                {actionLabel && (
                                    <Button type="primary" onClick={onAction}>
                                        {actionLabel}
                                    </Button>
                                )}
                                {children}
                            </div>
                        )}
                    </div>
                }
            />
        </div>
    );
};

export default EmptyState;
