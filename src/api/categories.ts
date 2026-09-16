import apiClient from './client'
import type { Category } from '@/types'

export type CategoryPayload = Omit<Category, 'id'>

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/categories')
  return data
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const { data } = await apiClient.post<Category>('/categories', payload)
  return data
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<Category> {
  const { data } = await apiClient.put<Category>(`/categories/${id}`, payload)
  return data
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/categories/${id}`)
}
