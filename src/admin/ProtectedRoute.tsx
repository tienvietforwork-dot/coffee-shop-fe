import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Result } from 'antd'
import { useAuthStore } from '@/store/authStore'
import { usePerm } from '@/lib/perm'

/** Logged in AND has at least one admin screen (Quản lý / Nhân viên). Customers are sent to their account page. */
export function RequireAdmin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { hasAdminAccess } = usePerm()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (!hasAdminAccess) return <Navigate to="/account" replace />
  return <Outlet />
}

/** Screen-level guard: the account must hold `perm` (one permission per screen, like MES). */
export function RequirePerm({ perm }: { perm: string | string[] }) {
  const { canAny } = usePerm()
  const list = Array.isArray(perm) ? perm : [perm]
  if (!canAny(...list)) {
    return <Result status="403" title="Không có quyền truy cập" subTitle="Liên hệ Quản lý để được cấp quyền cho màn hình này." />
  }
  return <Outlet />
}

/** Wraps one screen: renders it only with its permission, otherwise a 403 page. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = usePerm()
  if (!can(perm)) {
    return <Result status="403" title="Không có quyền truy cập" subTitle="Liên hệ Quản lý để được cấp quyền cho màn hình này." />
  }
  return <>{children}</>
}

/** /admin: the dashboard if allowed, otherwise the first screen the account may open. */
export function AdminHome({ children }: { children: ReactNode }) {
  const { can, firstAdminPath } = usePerm()
  if (can('dashboard')) return <>{children}</>
  return firstAdminPath && firstAdminPath !== '/admin' ? <Navigate to={firstAdminPath} replace /> : <Navigate to="/" replace />
}
