import apiClient from './client'
import type { User } from '@/types'

export type CreateUserPayload = Partial<User> & {
  username: string
  password: string
  fullName: string
  role: User['role']
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>> & {
  password?: string
}

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users')
  return data
}

export async function getShippers(): Promise<User[]> {
  const users = await getUsers()
  return users.filter((u) => u.role === 'SHIPPER')
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload)
  return data
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<User> {
  const { data } = await apiClient.put<User>(`/users/${id}`, payload)
  return data
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}
