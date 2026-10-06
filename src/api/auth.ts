import apiClient from './client'
import type { AccountInfo, LoginResponse, MyVoucher, Order, PermissionInfo, PointHistory, RoleInfo, User } from './types'

const d = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const authApi = {
  login: (username: string, password: string) => d(apiClient.post<LoginResponse>('/auth/login', { username, password })),
  /** Optional customer sign-up – phone becomes the username. */
  register: (b: { phone: string; password: string; fullName?: string; email?: string }) =>
    d(apiClient.post<LoginResponse>('/auth/register', b)),
  me: () => d(apiClient.get<{ user: User; permissions: PermissionInfo[] }>('/auth/me')),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put('/auth/me/password', { currentPassword, newPassword }),

  // Tài khoản & phân quyền (admin)
  roles: () => d(apiClient.get<RoleInfo[]>('/roles')),
  permissions: () => d(apiClient.get<PermissionInfo[]>('/permissions')),
  setRolePermissions: (roleId: number, permissionCodes: string[]) =>
    d(apiClient.put<RoleInfo>(`/roles/${roleId}/permissions`, { permissionCodes })),
}

/** Logged-in customer: own profile, orders, vouchers, points. */
export const accountApi = {
  profile: () => d(apiClient.get<AccountInfo>('/account')),
  updateProfile: (b: { fullName?: string; email?: string }) => d(apiClient.put<AccountInfo>('/account', b)),
  orders: () => d(apiClient.get<Order[]>('/account/orders')),
  vouchers: () => d(apiClient.get<MyVoucher[]>('/account/vouchers')),
  points: () => d(apiClient.get<PointHistory[]>('/account/points')),
}
