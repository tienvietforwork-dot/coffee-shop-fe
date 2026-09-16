import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types'

interface ProtectedRouteProps {
  /** If provided, only these roles may access the nested routes. */
  roles?: Role[]
}

/**
 * Guards nested <Route> elements: redirects to /login when not authenticated,
 * and to / (dashboard) when authenticated but lacking the required role.
 */
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
