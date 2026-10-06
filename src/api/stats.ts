import apiClient from './client'

/* app-stats API (routed by nginx-gateway: /api/stats/* -> app-stats). Contract expected by the admin UI. */

export interface StatsSummary {
  orders: number
  revenue: number
  discount: number
  avgOrderValue: number
  customers: number
  cancelRate: number
}

export interface RevenuePoint { date: string; orders: number; revenue: number; discount: number }
export interface TopCoffee { coffeeId: number; name: string; quantity: number; revenue: number }
export interface ChannelStat { channel: string; orders: number; revenue: number }
export interface HourStat { hour: number; orders: number }

const base = '/stats'
const range = (from: string, to: string) => ({ params: { from, to } })

export const statsApi = {
  summary: (from: string, to: string) => apiClient.get<StatsSummary>(`${base}/summary`, range(from, to)).then((r) => r.data),
  revenue: (from: string, to: string) => apiClient.get<RevenuePoint[]>(`${base}/revenue`, range(from, to)).then((r) => r.data),
  topCoffees: (from: string, to: string) => apiClient.get<TopCoffee[]>(`${base}/top-coffees`, range(from, to)).then((r) => r.data),
  channels: (from: string, to: string) => apiClient.get<ChannelStat[]>(`${base}/channels`, range(from, to)).then((r) => r.data),
  hours: (from: string, to: string) => apiClient.get<HourStat[]>(`${base}/hours`, range(from, to)).then((r) => r.data),
}
