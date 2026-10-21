import apiClient from './client'
import type { Cart, DiningTable, Menu, Order, OrderType, PaymentMethod, PriceQuote, DeliveryAddress, PublicDeliveryZone, Invoice, InvoiceBuyer } from './types'

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
  quote: (code: string, body: { orderType: OrderType; customerPhone?: string; voucherCode?: string; deliveryDistrict?: string }) =>
    apiClient.post<PriceQuote>(`/public/carts/${code}/quote`, body).then((r) => r.data),

  checkout: (body: {
    sessionCode: string
    orderType: OrderType
    customerName?: string
    customerPhone?: string
    delivery?: DeliveryAddress
    deliveryDistrict?: string
    pickupTime?: string
    paymentMethod: PaymentMethod
    voucherCode?: string
    note?: string
  }) => apiClient.post<Order>('/public/checkout', body).then((r) => r.data),

  /** quận giao được + phí ship theo khu vực */
  deliveryZones: () => apiClient.get<PublicDeliveryZone[]>('/public/delivery-zones').then((r) => r.data),
  invoices: (code: string) => apiClient.get<Invoice[]>(`/public/orders/${code}/invoices`).then((r) => r.data),
  /** thông tin xuất hóa đơn công ty / cá nhân */
  requestInvoice: (code: string, b: InvoiceBuyer) => apiClient.post<Invoice>(`/public/orders/${code}/invoice-request`, b).then((r) => r.data),
  order: (code: string) => apiClient.get<Order>(`/public/orders/${code}`).then((r) => r.data),
  /** VNPAY link for an order paid online (also "thanh toán lại") */
  pay: (code: string) =>
    apiClient.post<{ paymentUrl: string; txnRef: string; expireAt: string }>(`/public/orders/${code}/pay`).then((r) => r.data),
  /** what VNPAY put on the return URL, checked by the server */
  paymentReturn: (search: string) =>
    apiClient.get<{ validSignature: boolean; orderCode: string; status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'; responseCode?: string; message?: string; amount: number }>(
      `/public/payments/vnpay/return${search}`).then((r) => r.data),
  cancelOrder: (code: string, reason: string) =>
    apiClient.post<Order>(`/public/orders/${code}/cancel`, { reason }).then((r) => r.data),
}
