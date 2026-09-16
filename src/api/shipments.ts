import apiClient from './client'
import type { Shipment, ShipmentStatus } from '@/types'

export async function getShipments(): Promise<Shipment[]> {
  const { data } = await apiClient.get<Shipment[]>('/shipments')
  return data
}

export async function assignShipper(id: number, shipperId: number): Promise<Shipment> {
  const { data } = await apiClient.put<Shipment>(`/shipments/${id}`, { shipperId })
  return data
}

export async function updateShipmentStatus(id: number, status: ShipmentStatus): Promise<Shipment> {
  const { data } = await apiClient.put<Shipment>(`/shipments/${id}/status`, { status })
  return data
}
