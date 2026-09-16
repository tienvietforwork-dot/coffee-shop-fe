import apiClient from './client'
import type { LoginRequest, LoginResponse } from '@/types'

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  return data
}
