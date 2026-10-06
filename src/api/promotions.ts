import apiClient from './client'

/*
 * app-promotions API (routed by nginx-gateway: /api/promotions/* -> app-promotions).
 * Contract expected by the admin UI. Tables: promotions, promotion_items, vouchers.
 * Checkout itself (applying running promotions / validating vouchers) is done by app-core.
 */

export type PromotionScope = 'ORDER' | 'COFFEE'
export type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'
export type VoucherStatus = 'ISSUED' | 'USED' | 'EXPIRED' | 'REVOKED'

export interface PromotionItem {
  id?: number
  coffeeId: number
  coffeeName?: string
  customDiscount?: number
  salePrice?: number
  maxQuantity?: number
  soldQuantity?: number
}

export interface Promotion {
  id: number
  name: string
  description?: string
  applyScope: PromotionScope
  discountPercent?: number
  minOrderAmount?: number
  startDate: string
  endDate: string
  status: PromotionStatus
  items: PromotionItem[]
}

export interface Voucher {
  id: number
  code: string
  customerId?: number
  customerName?: string
  customerPhone?: string
  orderCode?: string
  incidentId?: number
  discountValue: number
  minOrderValue: number
  status: VoucherStatus
  issuedAt: string
  expiresAt?: string
}

export interface PromotionAnalytics {
  promotions: {
    id: number; name: string; status: PromotionStatus; orders: number; revenue: number
    discountTotal: number; avgOrderValue: number; roi?: number
  }[]
  vouchers: { issued: number; used: number; expired: number; usageRate: number; discountTotal: number }
  baseline: { avgOrderValue: number; ordersPerDay: number }
}

export type PromotionPayload = Omit<Promotion, 'id' | 'status' | 'items'> & { items?: PromotionItem[] }

const base = '/promotions'

export const promotionsApi = {
  list: () => apiClient.get<Promotion[]>(base).then((r) => r.data),
  save: (b: PromotionPayload & { id?: number }) =>
    (b.id ? apiClient.put<Promotion>(`${base}/${b.id}`, b) : apiClient.post<Promotion>(base, b)).then((r) => r.data),
  activate: (id: number) => apiClient.post(`${base}/${id}/activate`).then((r) => r.data),
  pause: (id: number) => apiClient.post(`${base}/${id}/pause`).then((r) => r.data),
  end: (id: number) => apiClient.post(`${base}/${id}/end`).then((r) => r.data),
  clone: (id: number) => apiClient.post<Promotion>(`${base}/${id}/clone`).then((r) => r.data),

  vouchers: (status?: VoucherStatus) =>
    apiClient.get<Voucher[]>(`${base}/vouchers`, { params: { status } }).then((r) => r.data),
  issueVouchers: (b: { customerIds?: number[]; quantity?: number; discountValue: number; minOrderValue?: number; expiresAt?: string; codePrefix?: string }) =>
    apiClient.post<Voucher[]>(`${base}/vouchers`, b).then((r) => r.data),
  revokeVoucher: (id: number) => apiClient.post(`${base}/vouchers/${id}/revoke`).then((r) => r.data),

  analytics: (from?: string, to?: string) =>
    apiClient.get<PromotionAnalytics>(`${base}/analytics`, { params: { from, to } }).then((r) => r.data),
}
