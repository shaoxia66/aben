import { NavItem } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navItems: NavItem[] = [
  {
    title: '概览',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: '工作空间',
    url: '/dashboard/workspaces',
    icon: 'workspace',
    isActive: true,
    items: [
      {
        title: '客户端配置',
        url: '/dashboard/workspaces/clients',
        icon: 'laptop'
      },
      {
        title: '会话管理',
        url: '/dashboard/workspaces/sessions',
        icon: 'post'
      },
      {
        title: 'Skills 管理',
        url: '/dashboard/workspaces/skills',
        icon: 'settings'
      }
    ]
  },
  {
    title: '团队',
    url: '/dashboard/workspaces/team',
    icon: 'teams',
    isActive: false,
    items: [],
    // Require organization to be active
    access: { requireOrg: true }
    // Alternative: require specific permission
    // access: { requireOrg: true, permission: 'org:teams:view' }
  },
  {
    title: '产品',
    url: '/dashboard/product',
    icon: 'product',
    shortcut: ['p', 'p'],
    isActive: false,
    items: []
  },
  {
    title: '任务看板',
    url: '/dashboard/kanban',
    icon: 'kanban',
    shortcut: ['k', 'k'],
    isActive: false,
    items: []
  },


  {
    title: 'API配置',
    url: '/dashboard/api-config',
    icon: 'settings',
    shortcut: ['m', 'm']
  },

  {
    title: '账户',
    url: '/dashboard/profile',
    icon: 'account',
    isActive: false,
    items: []
  }
];
