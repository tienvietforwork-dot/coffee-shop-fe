import apiClient from './client'
import type { Material, MaterialTransaction } from '@/types'

export type MaterialPayload = Omit<Material, 'id'>

export async function getMaterials(): Promise<Material[]> {
  const { data } = await apiClient.get<Material[]>('/materials')
  return data
}

export async function getLowStockMaterials(): Promise<Material[]> {
  const { data } = await apiClient.get<Material[]>('/materials/low-stock')
  return data
}

export async function createMaterial(payload: MaterialPayload): Promise<Material> {
  const { data } = await apiClient.post<Material>('/materials', payload)
  return data
}

export async function updateMaterial(id: number, payload: MaterialPayload): Promise<Material> {
  const { data } = await apiClient.put<Material>(`/materials/${id}`, payload)
  return data
}

export async function deleteMaterial(id: number): Promise<void> {
  await apiClient.delete(`/materials/${id}`)
}

export async function getMaterialTransactions(materialId: number): Promise<MaterialTransaction[]> {
  const { data } = await apiClient.get<MaterialTransaction[]>(`/materials/${materialId}/transactions`)
  return data
}

export interface StockInPayload {
  quantity: number
  note?: string
}

export async function stockInMaterial(materialId: number, payload: StockInPayload): Promise<MaterialTransaction> {
  const { data } = await apiClient.post<MaterialTransaction>(
    `/materials/${materialId}/transactions`,
    { type: 'IN', ...payload },
  )
  return data
}
