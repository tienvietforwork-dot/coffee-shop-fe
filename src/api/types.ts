// Types mirroring the app-core DTOs (com.coffeeshop.dto.response.*).

/** The only 3 roles: Quản lý, Nhân viên, Khách hàng. */
export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER'
export type CoffeeStatus = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN' | 'DISCONTINUED'
export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'
export type OrderChannel = 'COUNTER' | 'QR' | 'ONLINE'
export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'E_WALLET' | 'CARD'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type ShipmentStatus = 'PENDING' | 'BOOKED' | 'DRIVER_ACCEPTED' | 'DELIVERING' | 'DELIVERED' | 'FAILED'
export type MaterialStatus = 'ACTIVE' | 'INACTIVE'
export type BatchStatus = 'AVAILABLE' | 'DEPLETED' | 'EXPIRED'
export type MaterialTransactionType = 'IMPORT' | 'EXPORT' | 'SALE' | 'ADJUSTMENT'
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'INACTIVE'
export type WorkStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'
export type IncidentType = 'WRONG_ITEM' | 'QUALITY' | 'LATE' | 'SPILLED' | 'MISSING_ITEM' | 'OTHER'
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH'
export type IncidentStatus = 'OPEN' | 'RESOLVED'

export interface User {
  id: number
  username: string
  fullName?: string
  email?: string
  phone?: string
  active: boolean
  roles: Role[]
  staffId?: number
  staffName?: string
  customerId?: number
  customerName?: string
  lastLoginAt?: string
  createdAt?: string
  createdBy?: string
}

/** One permission per screen (path) or action (path null) – like MES MENU_CD / MENU_PATH. */
export interface PermissionInfo {
  id: number
  code: string
  name: string
  path?: string
  module: 'core' | 'crm' | 'promotions' | 'stats' | 'system' | 'customer'
  description?: string
  sortOrder: number
}

export interface RoleInfo {
  id: number
  code: Role
  name: string
  description?: string
  active: boolean
  permissionCodes: string[]
  userCount: number
}

export interface LoginResponse {
  token: string
  user: User
  permissions: PermissionInfo[]
}

export interface AccountInfo {
  customerId: number
  fullName?: string
  phone: string
  email?: string
  loyaltyPoints: number
  registeredAt: string
  orderCount: number
  totalSpent: number
}

export interface MyVoucher {
  id: number
  code: string
  discountValue: number
  minOrderValue: number
  status: 'ISSUED' | 'USED' | 'EXPIRED' | 'REVOKED'
  issuedAt: string
  expiresAt?: string
  orderCode?: string
}

export interface PointHistory {
  id: number
  pointsChange: number
  reason?: string
  orderCode?: string
  createdAt: string
}

export interface Category {
  id: number
  name: string
  description?: string
  displayOrder: number
}

export interface Coffee {
  id: number
  categoryId: number
  categoryName: string
  name: string
  imageUrl?: string
  price: number
  description?: string
  status: CoffeeStatus
  hasRecipe: boolean
}

export interface MenuCoffee {
  id: number
  name: string
  imageUrl?: string
  description?: string
  price: number
  salePrice?: number
  promotionName?: string
  available: boolean
}

export interface Menu {
  categories: { id: number; name: string; description?: string; coffees: MenuCoffee[] }[]
  orderPromotions: {
    id: number
    name: string
    description?: string
    discountPercent?: number
    minOrderAmount?: number
    endDate: string
  }[]
}

export interface Recipe {
  id: number
  coffeeId: number
  coffeeName: string
  brewMethod?: string
  version: number
  description?: string
  brewTimeMin?: number
  active: boolean
  materials: { materialId: number; materialName: string; unit: string; quantity: number; note?: string }[]
  steps: { stepNo: number; instruction: string }[]
}

export interface Material {
  id: number
  name: string
  unit: string
  stockQuantity: number
  minStock: number
  status: MaterialStatus
  lowStock: boolean
}

export interface Batch {
  id: number
  materialId: number
  materialName: string
  unit: string
  importQuantity: number
  remainingQuantity: number
  unitCost?: number
  expiryDate?: string
  status: BatchStatus
}

export interface MaterialTransaction {
  id: number
  batchId: number
  materialId: number
  materialName: string
  unit: string
  staffName?: string
  orderItemId?: number
  type: MaterialTransactionType
  quantity: number
  note?: string
  createdAt: string
}

export interface InventoryAlerts {
  lowStock: Material[]
  expiringBatches: Batch[]
}

export interface Staff {
  id: number
  fullName: string
  position?: string
  phone: string
  email?: string
  hireDate?: string
  workStatus: WorkStatus
}

export interface DiningTable {
  id: number
  tableNo: string
  qrCode: string
  area?: string
  capacity?: number
  status: TableStatus
}

export interface CartItem {
  id: number
  coffeeId: number
  coffeeName: string
  imageUrl?: string
  quantity: number
  unitPrice: number
  note?: string
  subtotal: number
  available: boolean
}

export interface Cart {
  sessionCode: string
  status: 'OPEN' | 'ORDERED' | 'ABANDONED'
  tableId?: number
  tableNo?: string
  items: CartItem[]
  subtotal: number
}

export interface PriceQuote {
  lines: {
    coffeeId: number
    coffeeName: string
    quantity: number
    listPrice: number
    unitPrice: number
    promotionName?: string
    lineTotal: number
    note?: string
  }[]
  subtotal: number
  promotionName?: string
  promotionDiscount: number
  voucherCode?: string
  voucherDiscount: number
  voucherMessage?: string
  shippingFee: number
  total: number
  unavailableItems: string[]
}

export interface Payment {
  id: number
  orderId: number
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  transactionCode?: string
  paidAt?: string
  refundAmount: number
}

export interface Shipment {
  id: number
  orderId: number
  orderCode: string
  recipientName: string
  recipientPhone: string
  address: string
  carrier?: string
  trackingCode?: string
  shippingFee: number
  status: ShipmentStatus
  bookedAt?: string
  driverAcceptedAt?: string
  deliveredAt?: string
  note?: string
}

export interface OrderItem {
  id: number
  coffeeId: number
  coffeeName: string
  imageUrl?: string
  quantity: number
  unitPrice: number
  lineTotal: number
  note?: string
}

export interface Order {
  id: number
  orderCode: string
  status: OrderStatus
  orderType: OrderType
  channel: OrderChannel
  customerId?: number
  customerName?: string
  customerPhone?: string
  tableId?: number
  tableNo?: string
  staffId?: number
  staffName?: string
  promotionName?: string
  subtotal: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  note?: string
  cancelReason?: string
  pickupTime?: string
  orderedAt: string
  paid: boolean
  items: OrderItem[]
  payments: Payment[]
  shipment?: Shipment
}

export interface Incident {
  id: number
  orderId: number
  orderCode: string
  handledByName?: string
  type: IncidentType
  severity?: IncidentSeverity
  reason?: string
  description?: string
  resolution?: string
  status: IncidentStatus
  reportedAt: string
  reportedBy?: string
  resolvedAt?: string
  vouchers: { code: string; discountValue: number; expiresAt?: string }[]
}

export interface CustomerLookup {
  id: number
  fullName?: string
  phone: string
  loyaltyPoints: number
  addresses: {
    id: number
    label?: string
    recipientName: string
    recipientPhone: string
    address: string
    isDefault: boolean
  }[]
}

export interface Dashboard {
  todayOrders: number
  todayRevenue: number
  activeOrders: number
  lowStockCount: number
  expiringBatchCount: number
  topCoffeesThisWeek: { coffeeId: number; name: string; quantity: number }[]
}

export interface DeliveryAddress {
  label?: string
  recipientName: string
  recipientPhone: string
  address: string
}
