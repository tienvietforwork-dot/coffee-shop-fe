import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/store/authStore'

/**
 * Central axios instance. baseURL = VITE_API_URL (the nginx-gateway, which routes
 * /api/crm|promotions|stats/* to their apps and everything else to app-core).
 * A 401 on an admin call logs out and goes back to the admin login.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/login')) {
      useAuthStore.getState().logout()
      window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/'
    }
    return Promise.reject(error)
  },
)

/** Human-readable message from an API error (backend returns { error, fields? }). */
export function errorMessage(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string {
  const e = err as AxiosError<{ error?: string; fields?: Record<string, string> }>
  const data = e?.response?.data
  if (data?.fields) return Object.entries(data.fields).map(([k, v]) => `${k}: ${v}`).join('; ')
  if (data?.error) return data.error
  if (e?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ'
  return fallback
}

/** True when the module's backend is not deployed / not reachable (404, 502-504, network). */
export function isServiceUnavailable(err: unknown): boolean {
  const e = err as AxiosError
  const s = e?.response?.status
  return !e?.response || s === 404 || s === 502 || s === 503 || s === 504
}

export default apiClient
