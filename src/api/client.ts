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

/** Human-readable message from app-core errors and Spring ProblemDetail responses. */
export function errorMessage(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string {
  const e = err as AxiosError<{ error?: string; fields?: Record<string, string>; detail?: string; message?: string; title?: string }>
  const data = e?.response?.data
  if (data?.fields) {
    const labels: Record<string, string> = {
      coffeeId: 'Sản phẩm', section: 'Khu vực', title: 'Tiêu đề', displayOrder: 'Thứ tự ưu tiên',
      startsAt: 'Thời gian bắt đầu', endsAt: 'Thời gian kết thúc', status: 'Trạng thái',
    }
    return Object.entries(data.fields).map(([key, value]) => `${labels[key] || key}: ${value}`).join('; ')
  }
  if (data?.detail) return data.detail
  if (data?.message) return data.message
  if (data?.error) return data.error
  if (data?.title) return data.title
  switch (e?.response?.status) {
    case 400: return 'Thông tin chưa hợp lệ hoặc thao tác chưa thể thực hiện'
    case 401: return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
    case 403: return 'Tài khoản hiện không có quyền thực hiện thao tác này'
    case 404: return 'Dữ liệu không còn tồn tại, vui lòng tải lại trang'
    case 409: return 'Dữ liệu đã thay đổi hoặc đang xung đột, vui lòng tải lại trang'
    case 422: return 'Dữ liệu chưa đáp ứng điều kiện xử lý'
    case 500: return 'Máy chủ gặp lỗi khi xử lý yêu cầu, vui lòng thử lại sau'
  }
  if (e?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ'
  if (!e?.response && err instanceof Error) return err.message
  return fallback
}

/** True when the module's backend is not deployed / not reachable (404, 502-504, network). */
export function isServiceUnavailable(err: unknown): boolean {
  const e = err as AxiosError
  const s = e?.response?.status
  return !e?.response || s === 404 || s === 502 || s === 503 || s === 504
}

export default apiClient
