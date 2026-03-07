import React from 'react';
import { Button, Breadcrumb } from '@arco-design/web-react';
import { IconLeft } from '@arco-design/web-react/icon';
import './PageHeader.css';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  extra?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    type?: 'primary' | 'secondary' | 'text' | 'outline';
    status?: 'success' | 'warning' | 'danger';
    icon?: React.ReactNode;
    disabled?: boolean;
  }>;
  onBack?: () => void;
  breadcrumb?: string[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  extra,
  actions,
  onBack,
  breadcrumb,
  className = '',
}) => {
  const renderBreadcrumbs = () => {
    if (!breadcrumb || breadcrumb.length === 0) return null;
    return (
      <Breadcrumb className="page-header-breadcrumb">
        {breadcrumb.map((item, index) => (
          <Breadcrumb.Item key={`${item}-${index}`}>{item}</Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  };

  const renderActions = () => {
    if (extra) return extra;
    if (!actions?.length) return null;
    return (
      <div className="page-header-actions">
        {actions.map((action, index) => (
          <Button
            key={`${action.label}-${index}`}
            type={action.type}
            status={action.status}
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className={`page-header-container fade-in-fast ${className}`.trim()}>
      {renderBreadcrumbs()}
      <div className="page-header-main">
        <div className="page-header-left">
          {onBack && (
            <Button
              className="page-header-back"
              type="text"
              icon={<IconLeft />}
              onClick={onBack}
              aria-label="返回"
            />
          )}
          <div className="page-header-title-box">
            <h1 className="page-title page-header-title">{title}</h1>
            {subtitle && <div className="page-header-subtitle">{subtitle}</div>}
          </div>
        </div>
        {renderActions()}
      </div>
    </div>
  );
};

export default PageHeader;
