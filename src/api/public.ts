import apiClient from './client'
import type { Cart, DiningTable, Menu, Order, OrderType, PaymentMethod, PriceQuote, DeliveryAddress } from './types'

// Guest endpoints (no login) – app-core /api/public/**

export const publicApi = {
  menu: () => apiClient.get<Menu>('/public/menu').then((r) => r.data),
  table: (qr: string) => apiClient.get<DiningTable>(`/public/tables/${encodeURIComponent(qr)}`).then((r) => r.data),

  createCart: (tableQr?: string) => apiClient.post<Cart>('/public/carts', { tableQr }).then((r) => r.data),
  cart: (code: string) => apiClient.get<Cart>(`/public/carts/${code}`).then((r) => r.data),
  addItem: (code: string, body: { coffeeId: number; quantity: number; note?: string }) =>
    apiClient.post<Cart>(`/public/carts/${code}/items`, body).then((r) => r.data),
  updateItem: (code: string, itemId: number, body: { quantity: number; note?: string }) =>
    apiClient.put<Cart>(`/public/carts/${code}/items/${itemId}`, body).then((r) => r.data),
  removeItem: (code: string, itemId: number) =>
    apiClient.delete<Cart>(`/public/carts/${code}/items/${itemId}`).then((r) => r.data),
  addBundle: (code: string, body: { bundleId: number; quantity: number; optionalItemIds: number[] }) =>
    apiClient.post<Cart>(`/public/carts/${code}/bundles`,body).then(r=>r.data),
  removeBundle: (code: string, lineId: number) =>
    apiClient.delete<Cart>(`/public/carts/${code}/bundles/${lineId}`).then(r=>r.data),
  recommended: () => apiClient.get<number[]>('/public/recommendations').then(r=>r.data),
  quote: (code: string, body: { orderType: OrderType; customerPhone?: string; voucherCode?: string; deliveryAddress?: string | null; deliveryTime?: string }) =>
    apiClient.post<PriceQuote>(`/public/carts/${code}/quote`, body).then((r) => r.data),

  checkout: (body: {
    sessionCode: string
    orderType: OrderType
    customerName?: string
    customerPhone?: string
    delivery?: DeliveryAddress
    pickupTime?: string
    paymentMethod: PaymentMethod
    voucherCode?: string
    note?: string
  }) => apiClient.post<Order>('/public/checkout', body).then((r) => r.data),

  order: (code: string) => apiClient.get<Order>(`/public/orders/${code}`).then((r) => r.data),
  cancelOrder: (code: string, reason: string) =>
    apiClient.post<Order>(`/public/orders/${code}/cancel`, { reason }).then((r) => r.data),

  // phí giao hàng theo km (quán tự giao): bậc phí, miễn phí từ, đơn tối thiểu
  deliverySettings: () => apiClient.get<{ openTime?: string; closeTime?: string; freeShipThreshold?: number | null; minOrderAmount?: number | null }>('/public/delivery-settings').then((r) => r.data),
  // gợi ý địa chỉ khi gõ (Google / Goong / OpenStreetMap tuỳ cấu hình app-core)
  addressSuggest: (q: string, area?: { ward?: string; province?: string }) =>
    apiClient.get<string[]>('/public/address-suggest', { params: { q, ...area } }).then((r) => r.data),

  // Invoice endpoints are not present in the BE snapshot supplied on 27/10.
  invoices: (code: string) => apiClient.get<Array<Record<string, any>>>(`/public/orders/${encodeURIComponent(code)}/invoices`).then((r) => r.data),

  requestInvoice: (code: string, buyer: object) => apiClient.post<Record<string, any>>(`/public/orders/${encodeURIComponent(code)}/invoices`, buyer).then((r) => r.data),

  // Payment URL must be generated and signed by Backend, never by the browser.
  pay: (code: string) => apiClient.post<{ paymentUrl: string }>(`/public/orders/${encodeURIComponent(code)}/pay`).then((r) => r.data),

  // Return parameters are sent to Backend for verification; frontend must not trust raw status.
  paymentReturn: (search: string) => apiClient.get<Record<string, any> & { orderCode: string }>(`/public/payments/return${search.startsWith('?') ? search : '?' + search}`).then((r) => r.data),
}
