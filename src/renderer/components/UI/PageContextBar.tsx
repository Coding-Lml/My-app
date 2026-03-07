import React from 'react';
import './PageContextBar.css';

interface ContextMetric {
    label: string;
    value: string | number;
    type?: 'success' | 'warning' | 'error' | 'accent' | 'default';
    title?: string;
}

interface PageContextBarProps {
    label?: string;
    value?: string;
    metrics?: ContextMetric[];
    children?: React.ReactNode;
    className?: string;
}

export const PageContextBar: React.FC<PageContextBarProps> = ({
    label = 'Context',
    value,
    metrics = [],
    children,
    className = ''
}) => {
    return (
        <div className={`page-context-bar ${className}`}>
            <div className="page-context-main">
                {label && <span className="page-context-label">{label}</span>}
                {value && <span className="page-context-value" title={value}>{value}</span>}
            </div>
            <div className="page-context-metrics">
                {metrics.map((metric, index) => (
                    <span
                        key={index}
                        className={`page-context-pill ${metric.type || 'default'}`}
                        title={metric.title || ''}
                    >
                        {metric.label}: {metric.value}
                    </span>
                ))}
                {children}
            </div>
        </div>
    );
};

export default PageContextBar;
