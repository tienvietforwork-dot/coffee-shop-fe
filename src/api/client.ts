import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

/**
 * Central axios instance used by every src/api/*.ts file.
 *
 * - baseURL comes from VITE_API_URL (build-time env var, see .env.example)
 * - request interceptor attaches the JWT bearer token from the auth store
 * - response interceptor logs the user out and redirects to /login on 401
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
