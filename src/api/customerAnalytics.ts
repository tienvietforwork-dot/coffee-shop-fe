import apiClient from './client'

export interface Trend { month: string; orders: number; buyers: number; revenue: number; avg_order_value: number }
export interface Spender { customer_id: number; customer_name: string; phone: string; orders: number; total_spent: number; avg_order_value: number; last_order_at: string }
export interface GroupComparison { group_id: number; group_name: string; members: number; buying_customers: number; orders: number; revenue: number; avg_order_value: number }
export interface Growth { month: string; new_customers: number; converted_customers: number }
export interface CustomerReport { from: string; to: string; orders: number; revenue: number; uniqueSpendingCustomers: number; spendingLimitedToTop: number; trends: Trend[]; spending: Spender[]; groups: GroupComparison[]; growth: Growth[]; note: string }
const base = '/stats/customer-analytics'
export const customerAnalyticsApi = {
  report: (from: string, to: string) => apiClient.get<CustomerReport>(`${base}/report`, { params: { from, to } }).then(r => r.data),
  exportCsv: async (from: string, to: string) => {
    const response = await apiClient.get<Blob>(`${base}/export`, { params: { from, to }, responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `customer-analytics-${from}-${to}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}
