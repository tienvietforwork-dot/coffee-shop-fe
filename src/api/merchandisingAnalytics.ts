import apiClient from './client'
export type AnalyticsRow = Record<string, string | number | null>
export interface MerchAnalyticsReport { from: string; to: string; orders: { orders: number; revenue: number; aov: number }; products: AnalyticsRow[]; bundles: AnalyticsRow[]; crossSell: AnalyticsRow[]; upsell: AnalyticsRow[]; recommendations: AnalyticsRow[]; tracking: Record<string, boolean>; note: string }
const base = '/stats/merchandising-analytics'
export const merchandisingAnalyticsApi = {
    report: (from: string, to: string) => apiClient.get<MerchAnalyticsReport>(`${base}/report`, { params: { from, to } }).then(r => r.data),
    exportCsv: async (from: string, to: string) => { const res = await apiClient.get<Blob>(`${base}/export`, { params: { from, to }, responseType: 'blob' }); const url = URL.createObjectURL(res.data); try { const a = document.createElement('a'); a.href = url; a.download = `merchandising-analytics-${from}-${to}.csv`; document.body.appendChild(a); a.click(); a.remove() } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) } }
}
