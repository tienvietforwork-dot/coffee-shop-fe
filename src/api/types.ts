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
export type BatchStatus = 'PREPARING' | 'AVAILABLE' | 'DEPLETED' | 'EXPIRED'
export type SupplierStatus = 'ACTIVE' | 'INACTIVE'
export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED'
export type GoodsReceiptStatus = 'COMPLETED' | 'CANCELLED'
export type SupplierReturnStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
/** DEBT = trừ vào công nợ; REFUND = nhà cung cấp hoàn tiền */
export type SupplierReturnSettlement = 'DEBT' | 'REFUND'
export type SupplierPaymentStatus = 'COMPLETED' | 'CANCELLED'
export type MaterialKind = 'RAW' | 'PREPARED'
export type MaterialTransactionType = 'IMPORT' | 'EXPORT' | 'SALE' | 'ADJUSTMENT' | 'PRODUCTION_USE' | 'PRODUCE' | 'DISPOSAL'
  | 'IMPORT_CANCEL' | 'SUPPLIER_RETURN'
/** phiếu hủy: EXPIRED … OTHER_DISPOSAL; xuất khác: RETURN_SUPPLIER, INTERNAL_USE */
export type TransactionReason = 'EXPIRED' | 'SPOILED' | 'SPILLED' | 'BREW_FAILED' | 'OTHER_DISPOSAL' | 'RETURN_SUPPLIER' | 'INTERNAL_USE'
/** how a raw material is bought: name "Hộp 1 L", size in the material's unit (1000) */
export interface MaterialPackage {
  id: number
  name: string
  size: number
}
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
  /** SOLD_OUT set by stock, reopens by itself when stock is back */
  autoSoldOut?: boolean
  hasRecipe: boolean
  /** cups the stock allows (null = not limited) */
  servings?: number | null
  stock?: StockLine[]
}

export interface StockLine {
  materialId: number
  materialName: string
  unit: string
  stock: number
  perCup: number
  cups: number
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
  /** cups the stock allows (null = not limited) */
  servings?: number | null
  /** material id → quantity per cup of the active recipe */
  perCup?: Record<string, number>
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
  /** material id → current stock, for every material used by an active recipe */
  stock?: Record<string, number>
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

export interface Material {
  id: number
  name: string
  unit: string
  stockQuantity: number
  minStock: number
  status: MaterialStatus
  lowStock: boolean
  kind: MaterialKind
  /** PREPARED: one batch of the formula yields this much */
  yieldQuantity?: number
  /** minutes after the lot is made */
  shelfLifeMinutes?: number
  components?: { componentId: number; name: string; unit: string; quantity: number }[]
  /** raw materials: packaging they are bought in */
  packages?: MaterialPackage[]
  /** how to make one standard batch */
  instructions?: string
  /** coffees (per cup) and prepared materials (per standard batch) that use this material */
  usedIn?: { kind: 'COFFEE' | 'PREPARED'; id: number; name: string; quantity: number }[]
  /** earliest expiry among the lots still in stock (the lot used next) */
  nextExpiryDate?: string
  /** the next lot is inside the warning window */
  expiringSoon?: boolean
  /** warn this many days before a lot expires; empty = shop default (7), 0 = never */
  expiryWarningDays?: number
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
  createdAt?: string
  /** prepared lot: when it was made */
  readyAt?: string
  /** prepared lot: exact expiry */
  expiresAt?: string
  /** packaging at import: packageCount × packageName (packageSize each) */
  packageName?: string
  packageSize?: number
  packageCount?: number
  /** prepared-material batch: the raw batches it was made from */
  inputs?: { batchId: number; materialName: string; unit: string; quantity: number }[]
  /** phiếu nhập that brought the lot in, and its supplier */
  receiptCode?: string
  supplierName?: string
  purchaseOrderItemId?: number
}

/** materials a supplier sells; unitPrice = reference price per unit of the material */
export interface SupplierMaterial {
  materialId: number
  materialName: string
  unit: string
  packageId?: number
  packageName?: string
  packageSize?: number
  unitPrice?: number
}

export interface Supplier {
  id: number
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  taxCode?: string
  note?: string
  /** điều khoản thanh toán: số ngày được nợ kể từ ngày nhập (0 = trả ngay) */
  paymentTermDays: number
  /** INACTIVE = ngừng hợp tác */
  status: SupplierStatus
  materials: SupplierMaterial[]
}

/** one line of a purchase order; quantities in the material's unit, unitPrice per unit of the material */
export interface PurchaseOrderItem {
  id: number
  materialId: number
  materialName: string
  unit: string
  packageName?: string
  packageSize?: number
  packageCount?: number
  quantity: number
  receivedQuantity: number
  unitPrice?: number
  amount: number
  note?: string
}

/**
 * dòng phiếu nhập; quantities in the material's unit: documentQuantity = SL theo chứng từ (phiếu giao của NCC),
 * receivedQuantity = SL thực nhập (becomes lot batchId), rejectedQuantity = không nhận (rejectReason)
 */
export interface GoodsReceiptLine {
  id: number
  materialId: number
  materialName: string
  unit: string
  purchaseOrderItemId?: number
  batchId?: number
  packageName?: string
  packageSize?: number
  documentQuantity: number
  receivedQuantity: number
  rejectedQuantity: number
  /** giao thiếu so với chứng từ */
  shortQuantity: number
  rejectReason?: string
  /** đơn giá chưa thuế / đơn vị gốc */
  unitPrice?: number
  amount: number
  expiryDate?: string
  temperature?: number
  /** still in stock from the lot: what can still be returned */
  remainingInLot: number
  note?: string
}

/** phiếu nhập kho (mẫu 01-VT): one delivery, against a purchase order or loose */
export interface GoodsReceipt {
  id: number
  code: string
  status: GoodsReceiptStatus
  supplierId: number
  supplierName: string
  supplierTaxCode?: string
  supplierAddress?: string
  purchaseOrderId?: number
  purchaseOrderCode?: string
  staffName?: string
  delivererName?: string
  invoiceSeries?: string
  invoiceNo?: string
  invoiceDate?: string
  documentImageId?: number
  goodsAmount: number
  discountAmount: number
  vatRate?: number
  vatAmount: number
  shippingCost: number
  /** cần trả nhà cung cấp = tiền hàng − giảm giá + thuế GTGT + chi phí nhập */
  totalAmount: number
  paidAmount: number
  returnedAmount: number
  remainingAmount: number
  dueDate: string
  overdue: boolean
  note?: string
  cancelReason?: string
  cancelledAt?: string
  createdAt: string
  createdBy?: string
  lines: GoodsReceiptLine[]
}

/** phiếu đặt hàng nhà cung cấp; receipts only on the detail */
export interface PurchaseOrder {
  id: number
  code: string
  supplierId: number
  supplierName: string
  supplierPhone?: string
  supplierAddress?: string
  staffName?: string
  status: PurchaseOrderStatus
  expectedDate?: string
  orderedAt?: string
  completedAt?: string
  note?: string
  closeReason?: string
  createdAt: string
  createdBy?: string
  paymentTermDays: number
  goodsAmount: number
  discountAmount: number
  vatRate?: number
  vatAmount: number
  shippingCost: number
  /** tiền hàng − giảm giá + thuế GTGT + chi phí nhập */
  totalAmount: number
  supplierTaxCode?: string
  items: PurchaseOrderItem[]
  receipts?: GoodsReceipt[]
}

export interface MaterialTransaction {
  id: number
  batchId: number
  materialId: number
  materialName: string
  unit: string
  staffName?: string
  orderItemId?: number
  /** PRODUCTION_USE: the prepared-material batch it went into */
  producedBatchId?: number
  type: MaterialTransactionType
  reason?: TransactionReason
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
  options?: Array<{id:number;name:string;kind:string;extraPrice:number}>
}

export interface Cart {
  sessionCode: string
  status: 'OPEN' | 'ORDERED' | 'ABANDONED'
  tableId?: number
  tableNo?: string
  items: CartItem[]
  bundles?: { id: number; bundleId: number; name: string; quantity: number; selected: number[]; unitPrice: number; total: number }[]
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

/** dòng phiếu trả hàng nhập; quantity in the material's unit */
export interface SupplierReturnLine {
  id: number
  receiptItemId: number
  batchId?: number
  materialId: number
  materialName: string
  unit: string
  packageName?: string
  packageSize?: number
  quantity: number
  unitPrice: number
  amount: number
  note?: string
}

/** phiếu trả hàng nhập */
export interface SupplierReturn {
  id: number
  code: string
  status: SupplierReturnStatus
  supplierId: number
  supplierName: string
  supplierTaxCode?: string
  supplierAddress?: string
  goodsReceiptId: number
  goodsReceiptCode: string
  receiptInvoiceNo?: string
  staffName?: string
  reason: string
  settlement: SupplierReturnSettlement
  refundMethod?: PaymentMethod
  adjustmentInvoiceNo?: string
  goodsAmount: number
  vatRate?: number
  vatAmount: number
  totalAmount: number
  completedAt?: string
  cancelReason?: string
  note?: string
  createdAt: string
  createdBy?: string
  items: SupplierReturnLine[]
}

/** phiếu chi trả nhà cung cấp (mẫu 02-TT) */
export interface SupplierPayment {
  id: number
  code: string
  status: SupplierPaymentStatus
  supplierId: number
  supplierName: string
  supplierAddress?: string
  goodsReceiptId?: number
  goodsReceiptCode?: string
  purchaseOrderId?: number
  purchaseOrderCode?: string
  amount: number
  method: PaymentMethod
  reference?: string
  payeeName?: string
  paidAt: string
  staffName?: string
  documentImageId?: number
  note?: string
  cancelReason?: string
  createdAt: string
  createdBy?: string
}

/** công nợ phải trả của 1 nhà cung cấp; balance < 0 = đã trả trước */
export interface SupplierDebt {
  supplierId: number
  supplierName: string
  phone?: string
  paymentTermDays: number
  purchasedAmount: number
  returnedAmount: number
  paidAmount: number
  balance: number
  overdueAmount: number
  openReceipts: number
  nextDueDate?: string
}

/** sổ chi tiết công nợ; type RECEIPT (phiếu nhập), RETURN (trả hàng trừ nợ), PAYMENT (phiếu chi) */
export interface SupplierLedger {
  supplierId: number
  supplierName: string
  supplierTaxCode?: string
  supplierAddress?: string
  from?: string
  to?: string
  openingBalance: number
  increase: number
  decrease: number
  closingBalance: number
  rows: { date: string; type: 'RECEIPT' | 'RETURN' | 'PAYMENT'; documentId: number; code: string; description: string; increase: number; decrease: number; balance: number; dueDate?: string }[]
}

export type StocktakeStatus = 'DRAFT' | 'BALANCED' | 'CANCELLED'
/** phẩm chất: còn tốt / kém phẩm chất / mất phẩm chất */
export type StockQuality = 'GOOD' | 'POOR' | 'LOST'

/** one lot on a phiếu kiểm kê; quantities in the material's unit */
export interface StocktakeLine {
  id: number
  batchId: number
  materialId: number
  materialName: string
  unit: string
  expiryDate?: string
  bookQuantity: number
  countedQuantity?: number
  /** thừa (+) / thiếu (−) */
  difference: number
  unitCost?: number
  differenceValue: number
  quality: StockQuality
  reason?: string
}

/** phiếu kiểm kê (mẫu 05-VT) */
export interface Stocktake {
  id: number
  code: string
  status: StocktakeStatus
  staffName?: string
  members?: string
  countedAt: string
  balancedByName?: string
  balancedAt?: string
  resolution?: string
  note?: string
  lineCount: number
  countedCount: number
  surplusValue: number
  shortageValue: number
  createdAt: string
  createdBy?: string
  items?: StocktakeLine[]
}

/** báo cáo xuất – nhập – tồn: one material over the period */
export interface InventoryReportRow {
  materialId: number
  materialName: string
  unit: string
  kind: MaterialKind
  minStock: number
  openingQuantity: number
  openingValue: number
  inPurchase: number
  inProduce: number
  inAdjust: number
  inQuantity: number
  inValue: number
  outSale: number
  outProduction: number
  outDisposal: number
  outReturn: number
  outOther: number
  outQuantity: number
  outValue: number
  closingQuantity: number
  closingValue: number
}
export interface InventoryReport {
  from: string
  to: string
  openingValue: number
  inValue: number
  outValue: number
  closingValue: number
  rows: InventoryReportRow[]
}
export interface InventoryDaily { date: string; materialId: number; materialName: string; quantity: number; value: number }

/** giá vốn 1 ly theo công thức đang dùng; complete = every material has a known cost */
export interface CoffeeCost {
  coffeeId: number
  coffeeName: string
  categoryName?: string
  status: CoffeeStatus
  recipeId?: number
  price: number
  unitCost?: number
  grossMargin?: number
  foodCostPercent?: number
  complete: boolean
  previousCost?: number
  previousAt?: string
  lines: { materialId: number; materialName: string; unit: string; quantity: number; unitCost?: number; cost?: number; costSource: string }[]
}
export interface CoffeeCostHistory { at: string; unitCost: number; price: number }

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
