import { useAuthStore } from '@/store/authStore'

/**
 * Permission codes – one per screen (+ a few action permissions), same as permissions.code in the DB
 * and com.coffeeshop.security.Perm in app-core.
 */
export const P = {
  DASHBOARD: 'dashboard',
  ORDERS: 'orders',
  ORDERS_REFUND: 'orders.refund',
  POS: 'pos',
  SHIPMENTS: 'shipments',
  INCIDENTS: 'incidents',
  INCIDENTS_RESOLVE: 'incidents.resolve',
  MENU: 'menu',
  MENU_EDIT: 'menu.edit',
  CATEGORIES: 'categories',
  MATERIALS: 'materials',
  MATERIALS_EDIT: 'materials.edit',
  STOCK: 'stock',
  STOCK_HISTORY: 'stock-history',
  TABLES: 'tables',
  TABLES_EDIT: 'tables.edit',
  CRM_CUSTOMERS: 'crm.customers',
  CRM_INTERACTIONS: 'crm.interactions',
  CRM_FEEDBACKS: 'crm.feedbacks',
  CRM_GROUPS: 'crm.groups',
  CRM_INSIGHTS: 'crm.insights',
  PROMOTIONS: 'promotions',
  VOUCHERS: 'vouchers',
  PROMOTIONS_ANALYTICS: 'promotions.analytics',
  STATS: 'stats',
  STAFF: 'staff',
  USERS: 'users',
  ROLES: 'roles',
  ACCOUNT: 'account',
} as const

/** `can(code)` – true when the logged-in account has the permission. */
export function usePerm() {
  const permissions = useAuthStore((s) => s.permissions)
  const codes = new Set(permissions.map((p) => p.code))
  return {
    can: (code: string) => codes.has(code),
    canAny: (...list: string[]) => list.some((c) => codes.has(c)),
    /** Has at least one admin-system screen (i.e. Quản lý / Nhân viên). */
    hasAdminAccess: permissions.some((p) => p.module !== 'customer'),
    /** First admin screen the account may open – where to land after login. */
    firstAdminPath: permissions.filter((p) => p.path && p.module !== 'customer').sort((a, b) => a.sortOrder - b.sortOrder)[0]?.path,
  }
}

export const ROLE_LABEL: Record<string, { text: string; color: string }> = {
  ADMIN: { text: 'Quản lý', color: 'gold' },
  STAFF: { text: 'Nhân viên', color: 'blue' },
  CUSTOMER: { text: 'Khách hàng', color: 'green' },
}
