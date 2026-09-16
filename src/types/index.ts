// Shared domain types used across the app.
// These mirror the assumed coffee-shop-be REST API contract.
// If the real backend's field names differ, this is the first place to fix.

export type Role = 'ADMIN' | 'STAFF' | 'SHIPPER'

export interface User {
  id: number
  username: string
  fullName: string
  email?: string
  phone?: string
  role: Role
  active: boolean
  createdAt?: string
}

export interface Category {
  id: number
  name: string
  description?: string
}

export interface Product {
  id: number
  name: string
  categoryId: number
  categoryName?: string
  price: number
  active: boolean
  description?: string
  imageUrl?: string
}

export interface ProductMaterial {
  id: number
  productId: number
  materialId: number
  materialName?: string
  unit?: string
  quantity: number
}

export interface Material {
  id: number
  name: string
  unit: string
  stockQuantity: number
  minThreshold: number
  unitPrice: number
}

export type MaterialTransactionType = 'IN' | 'OUT' | 'ADJUSTMENT'

export interface MaterialTransaction {
  id: number
  materialId: number
  type: MaterialTransactionType
  quantity: number
  note?: string
  createdAt: string
  createdBy?: string
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'

export interface OrderItem {
  id?: number
  productId: number
  productName?: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: number
  code?: string
  customerName?: string
  customerPhone?: string
  status: OrderStatus
  totalAmount: number
  items: OrderItem[]
  createdAt: string
  updatedAt?: string
}

export type ShipmentStatus =
  | 'WAITING'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'

export interface Shipment {
  id: number
  orderId: number
  orderCode?: string
  shipperId?: number
  shipperName?: string
  address: string
  status: ShipmentStatus
  createdAt: string
  deliveredAt?: string
}

export interface RevenuePoint {
  date: string
  revenue: number
  orders: number
}

export interface RevenueReport {
  from: string
  to: string
  totalRevenue: number
  totalOrders: number
  daily: RevenuePoint[]
}

export interface TopProduct {
  productId: number
  productName: string
  totalQuantity: number
  totalRevenue: number
}

export interface Paged<T> {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}
