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
  /** uploaded photo (images.id); imageUrl is then its /api/public/images/… path */
  imageId?: number
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
  updatedAt?: string
  updatedBy?: string
}

/** a material is just a name + unit; how much of it goes in a cup lives on the coffee's recipe */
export interface Material {
  id: number
  name: string
  unit: string
  /** coffees whose active recipe uses this material (quantity per cup) */
  usedIn?: { kind: 'COFFEE'; id: number; name: string; quantity: number }[] | null
}

/** one status change of an order; fromStatus empty = the order was placed */
export interface OrderStatusChange {
  id: number
  fromStatus?: OrderStatus
  toStatus: OrderStatus
  /** staff name, or the account (customer, guest, system) */
  by: string
  note?: string
  at: string
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
  orderStatus?: OrderStatus
  district?: string
  zoneName?: string
  /** AHAMOVE when booked through the partner; empty = gọi xe ngoài */
  partner?: string
  partnerOrderId?: string
  partnerStatus?: string
  /** what the shop pays the partner for the trip */
  partnerFee?: number
  trackingUrl?: string
  driverName?: string
  driverPhone?: string
  distanceKm?: number
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
  topCoffeesThisWeek: { coffeeId: number; name: string; quantity: number }[]
}

export interface DeliveryAddress {
  label?: string
  recipientName: string
  recipientPhone: string
  address: string
}

/** ca thu ngân; while open the sales figures are live */
export interface CashShift {
  id: number
  code: string
  open: boolean
  staffName?: string
  openedAt: string
  openingCash: number
  closedAt?: string
  closedByName?: string
  orderCount: number
  cashSales: number
  transferSales: number
  cardSales: number
  ewalletSales: number
  totalSales: number
  cashIn: number
  cashOut: number
  /** tiền mặt lý thuyết = đầu ca + bán tiền mặt + thu − chi */
  expectedCash: number
  countedCash?: number
  /** thực đếm − lý thuyết (âm = thiếu) */
  difference?: number
  /** "500000:2,200000:5" */
  denominations?: string
  differenceReason?: string
  nextOpeningCash?: number
  handoverCash?: number
  receivedBy?: string
  note?: string
  movements: { id: number; type: 'IN' | 'OUT'; amount: number; reason: string; staffName?: string; at: string }[]
}

export interface WorkShift { id: number; name: string; startTime: string; endTime: string; graceMinutes: number; color?: string; active: boolean; minutes: number }
/** SCHEDULED, WORKING, DONE, MISSING_OUT (quên chấm ra), ABSENT (vắng), LEAVE (nghỉ P / KL) */
export type AttendanceState = 'SCHEDULED' | 'WORKING' | 'DONE' | 'MISSING_OUT' | 'ABSENT' | 'LEAVE'
export interface ShiftAssignment {
  id: number
  staffId: number
  staffName: string
  shiftId: number
  shiftName: string
  color?: string
  workDate: string
  startTime: string
  endTime: string
  position?: string
  checkInAt?: string
  checkOutAt?: string
  leaveType?: 'P' | 'KL'
  state: AttendanceState
  lateMinutes: number
  earlyLeaveMinutes: number
  workedMinutes: number
  note?: string
  adjustedBy?: string
}
export interface TimesheetRow {
  staffId: number; staffName: string; position?: string; scheduled: number; worked: number; workedHours: number
  lateTimes: number; lateMinutes: number; earlyTimes: number; absent: number; leavePaid: number; leaveUnpaid: number; missingOut: number
  /** day of month → giờ công "6.0", P, KL, V (vắng), ? (quên chấm ra) */
  days: Record<number, string>
}
export interface Timesheet { year: number; month: number; daysInMonth: number; rows: TimesheetRow[] }

export interface AuditLog {
  id: number; username?: string; module: string; action: string; method: string; path: string; entityId?: string
  statusCode: number; durationMs: number; ip?: string; detail?: string; createdAt: string
}

/** giao dịch cổng thanh toán (VNPAY) để đối soát; mismatch = why it needs a look */
export interface PaymentTransaction {
  id: number; provider: string; type: 'PAY' | 'REFUND'; txnRef: string; amount: number
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
  bankCode?: string; providerTxnNo?: string; responseCode?: string; responseText?: string
  createdAt: string; completedAt?: string; expireAt?: string; ipnCount: number
  orderId: number; orderCode: string; paymentId: number; paymentMethod: PaymentMethod; paymentAmount: number; paymentStatus: PaymentStatus
  mismatch?: string; reconciled: boolean; reconciledBy?: string; reconciledAt?: string; reconcileNote?: string
}

/** khu vực giao hàng: quận / phường, phí ship, miễn phí từ, đơn tối thiểu */
export interface DeliveryZone {
  id: number; name: string; districts: string; fee: number; freeShipThreshold?: number; minOrderAmount?: number
  estimatedMinutes?: number; active: boolean; sortOrder: number
}
export interface PublicDeliveryZone { name: string; districts: string[]; fee: number; freeShipThreshold?: number; minOrderAmount?: number; estimatedMinutes?: number }
export interface ShipmentEvent { id: number; source: 'STAFF' | 'PARTNER' | 'SYSTEM'; status?: ShipmentStatus; partnerStatus?: string; note?: string; by?: string; at: string }
export interface AhamoveEstimate { fee: number; distanceKm?: number; durationMinutes?: number; serviceId: string }

/** hóa đơn điện tử khởi tạo từ máy tính tiền */
export interface Invoice {
  id: number; orderId: number; orderCode: string
  kind: 'ORIGINAL' | 'REPLACEMENT' | 'ADJUSTMENT'; relatedId?: number; relatedNo?: string
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'REPLACED'
  templateCode: string; series: string; invoiceNo?: string; taxAuthorityCode?: string; lookupCode?: string; lookupUrl?: string
  sellerName: string; sellerTaxCode: string; sellerAddress: string
  buyerName?: string; buyerCompany?: string; buyerTaxCode?: string; buyerAddress?: string; buyerEmail?: string; buyerPhone?: string; buyerIdNumber?: string
  amountBeforeTax: number; vatRate?: number; vatAmount: number; totalAmount: number; paymentMethod?: string; reason?: string
  attempts: number; lastError?: string; issuedAt?: string; createdAt: string
  lines: { lineNo: number; name: string; unit: string; quantity: number; unitPrice: number; amount: number }[]
}
export interface InvoiceBuyer {
  buyerName?: string; buyerCompany?: string; buyerTaxCode?: string; buyerAddress?: string; buyerEmail?: string; buyerPhone?: string; buyerIdNumber?: string
}
export interface NotificationTemplate { code: string; name: string; enabled: boolean; znsTemplateId?: string; smsContent: string; smsFallback: boolean; updatedBy?: string }
export interface NotificationMessage {
  id: number; orderCode?: string; templateCode: string; phone: string; status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'
  channel?: 'ZNS' | 'SMS'; content?: string; attempts: number; providerRef?: string; error?: string; sentAt?: string; createdAt: string
}
