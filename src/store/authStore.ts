import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoginResponse, PermissionInfo, User } from '@/api/types'

interface AuthState {
  token: string | null
  user: User | null
  /** Screens / actions this account may use (permissions of all its roles). */
  permissions: PermissionInfo[]
  isAuthenticated: boolean
  setSession: (r: LoginResponse) => void
  setMe: (user: User, permissions: PermissionInfo[]) => void
  logout: () => void
}

/** One session for everyone (Quản lý, Nhân viên, Khách hàng) – JWT from app-core /api/auth/login. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: [],
      isAuthenticated: false,
      setSession: (r) => set({ token: r.token, user: r.user, permissions: r.permissions, isAuthenticated: true }),
      setMe: (user, permissions) => set({ user, permissions }),
      logout: () => set({ token: null, user: null, permissions: [], isAuthenticated: false }),
    }),
    { name: 'coffeeholic-auth' },
  ),
)
