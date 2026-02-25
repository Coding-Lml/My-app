import React from 'react';
import {
  IconBook,
  IconCheckCircle,
  IconCode,
  IconSettings,
  IconFire,
  IconApps,
  IconList,
} from '@arco-design/web-react/icon';

export interface NavItemConfig {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  showInMenu: boolean;
  showInCommand: boolean;
  showInQuickActions: boolean;
  quickActionIcon?: string;
  quickActionLabel?: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    key: 'checkin',
    path: '/checkin',
    label: '打卡',
    icon: <IconFire />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: true,
    quickActionIcon: '🔥',
    quickActionLabel: '今日打卡',
  },
  {
    key: 'skills',
    path: '/skills',
    label: '技能树',
    icon: <IconApps />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: false,
  },
  {
    key: 'plans',
    path: '/plans',
    label: '学习计划',
    icon: <IconList />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: true,
    quickActionIcon: '🎯',
    quickActionLabel: '查看计划',
  },
  {
    key: 'notes',
    path: '/notes',
    label: '笔记',
    icon: <IconBook />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: true,
    quickActionIcon: '📝',
    quickActionLabel: '写笔记',
  },
  {
    key: 'todos',
    path: '/todos',
    label: '待办',
    icon: <IconCheckCircle />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: true,
    quickActionIcon: '✅',
    quickActionLabel: '添加待办',
  },
  {
    key: 'code',
    path: '/code',
    label: '代码',
    icon: <IconCode />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: false,
  },
  {
    key: 'settings',
    path: '/settings',
    label: '设置',
    icon: <IconSettings />,
    showInMenu: true,
    showInCommand: true,
    showInQuickActions: false,
  },
];

export const MENU_ITEMS = NAV_ITEMS.filter((item) => item.showInMenu);
export const COMMAND_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInCommand);
export const QUICK_ACTION_ITEMS = NAV_ITEMS.filter((item) => item.showInQuickActions);
