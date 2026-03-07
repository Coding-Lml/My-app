import React from 'react';
import { Card, Statistic, Typography } from '@arco-design/web-react';
import './KpiCard.css';

interface KpiCardProps {
    title: string;
    value: string | number;
    precision?: number;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    icon?: React.ReactNode;
    trendLabel?: string;
    trendType?: 'success' | 'warning' | 'error';
    trend?: {
        value: string | number;
        isUp?: boolean;
    };
    loading?: boolean;
    className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
    title,
    value,
    precision,
    prefix,
    suffix,
    icon,
    trendLabel,
    trendType = 'success',
    trend,
    loading = false,
    className = ''
}) => {
    const renderTrend = () => {
        if (trendLabel) {
            return <span className={`kpi-card-trend ${trendType}`}>{trendLabel}</span>;
        }
        if (trend) {
            const isUp = trend.isUp ?? true;
            return (
                <span className={`kpi-card-trend ${isUp ? 'success' : 'error'}`}>
                    {isUp ? '↑' : '↓'} {trend.value}%
                </span>
            );
        }
        return null;
    };

    return (
        <Card
            className={`kpi-card lift-on-hover glass-surface ${className}`}
            bordered={false}
            loading={loading}
        >
            <div className="kpi-card-content">
                <div className="kpi-card-main">
                    <Typography.Text className="kpi-card-title" disabled>
                        {title}
                    </Typography.Text>
                    <div className="kpi-card-value-row">
                        <Statistic
                            value={value}
                            precision={precision}
                            prefix={prefix}
                            suffix={suffix}
                        />
                        {renderTrend()}
                    </div>
                </div>
                {icon && <div className="kpi-card-icon-box">{icon}</div>}
            </div>
        </Card>
    );
};

export default KpiCard;
