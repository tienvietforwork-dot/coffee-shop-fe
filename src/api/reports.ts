import apiClient from './client'
import type { RevenueReport, TopProduct } from '@/types'

export interface DateRangeParams {
  from: string // ISO date, e.g. 2026-09-01
  to: string
}

export async function getRevenueReport(params: DateRangeParams): Promise<RevenueReport> {
  const { data } = await apiClient.get<RevenueReport>('/reports/revenue', { params })
  return data
}

export async function getTopProducts(params: DateRangeParams & { limit?: number }): Promise<TopProduct[]> {
  const { data } = await apiClient.get<TopProduct[]>('/reports/top-products', { params })
  return data
}
