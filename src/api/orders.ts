import apiClient from './client'
import type { Order, OrderStatus } from '@/types'

export interface CreateOrderPayload {
  customerName?: string
  customerPhone?: string
  items: Array<{ productId: number; quantity: number }>
}

export async function getOrders(status?: OrderStatus): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/orders', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function getOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`)
  return data
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await apiClient.post<Order>('/orders', payload)
  return data
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<Order> {
  const { data } = await apiClient.put<Order>(`/orders/${id}/status`, { status })
  return data
}
