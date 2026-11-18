import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/store/authStore'

// In local development CRM runs as its own Spring Boot service. In production this
// can point at the gateway route, for example https://gateway.example/api/crm/v1.
const baseURL = import.meta.env.VITE_CRM_API_URL || `${import.meta.env.VITE_API_URL}/crm/v1`

const crmClient = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

crmClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

crmClient.interceptors.response.use((response) => response, (error: AxiosError) => {
  if (error.response?.status === 401) {
    useAuthStore.getState().logout()
    window.location.href = '/admin/login'
  }
  return Promise.reject(error)
})

export default crmClient
