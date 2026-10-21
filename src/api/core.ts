import apiClient from './client'
import type {
  Batch, Category, Coffee, CoffeeStatus, CustomerLookup, Dashboard, DeliveryAddress, DiningTable, Incident,
  IncidentSeverity, IncidentType, InventoryAlerts, Material, MaterialKind, MaterialStatus, MaterialTransaction,
  Order, OrderChannel, OrderStatus, OrderStatusChange, OrderType, Payment, PaymentMethod, PriceQuote, Recipe, Shipment, ShipmentStatus, TransactionReason,
  Staff, TableStatus, User, WorkStatus, Supplier, SupplierStatus, PurchaseOrder, PurchaseOrderStatus, GoodsReceipt,
  GoodsReceiptStatus, SupplierReturn, SupplierReturnStatus, SupplierReturnSettlement, SupplierPayment, SupplierDebt, SupplierLedger,
  Stocktake, StocktakeStatus, StockQuality, InventoryReport, InventoryDaily, CoffeeCost, CoffeeCostHistory,
  CashShift, WorkShift, ShiftAssignment, Timesheet, AuditLog, PaymentTransaction, DeliveryZone, ShipmentEvent, AhamoveEstimate,
  Invoice, InvoiceBuyer, NotificationTemplate, NotificationMessage,
} from './types'

const get = <T,>(url: string, params?: object) => apiClient.get<T>(url, { params }).then((r) => r.data)
const post = <T,>(url: string, body?: unknown) => apiClient.post<T>(url, body).then((r) => r.data)
const put = <T,>(url: string, body?: unknown) => apiClient.put<T>(url, body).then((r) => r.data)
const patch = <T,>(url: string, body?: unknown) => apiClient.patch<T>(url, body).then((r) => r.data)
const del = (url: string) => apiClient.delete(url).then(() => undefined)
/** GET a file (Excel export) and hand it to the browser as a download */
export const download = async (url: string, params?: object) => {
  const r = await apiClient.get<Blob>(url, { params, responseType: 'blob' })
  const name = /filename\*=UTF-8''([^;]+)/.exec(String(r.headers['content-disposition'] ?? ''))?.[1]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(r.data)
  a.download = name ? decodeURIComponent(name) : 'export.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export interface CategoryPayload { name: string; description?: string; displayOrder?: number }
export interface CoffeePayload {
  categoryId: number; name: string; imageId?: number; imageUrl?: string; price: number; description?: string; status?: CoffeeStatus
}
export interface RecipePayload {
  brewMethod?: string; description?: string; brewTimeMin?: number; activate?: boolean
  materials: { materialId: number; quantity: number; note?: string }[]
  steps: string[]
}
export interface MaterialPayload {
  name: string; unit: string; minStock?: number; expiryWarningDays?: number; status?: MaterialStatus; kind?: MaterialKind
  yieldQuantity?: number; shelfLifeMinutes?: number
  components?: { componentId: number; quantity: number }[]
  packages?: { name: string; size: number }[]
  instructions?: string
}
export interface SupplierPayload {
  name: string; contactName?: string; phone?: string; email?: string; address?: string; taxCode?: string; note?: string
  paymentTermDays?: number
  status?: SupplierStatus
  /** unitPrice: reference price per unit of the material */
  materials?: { materialId: number; packageId?: number; unitPrice?: number }[]
}
/** each line: packageId + packageCount, or a loose quantity in the material's unit; unitPrice per unit of the material */
export interface PurchaseOrderPayload {
  supplierId: number; expectedDate?: string; note?: string
  /** null: the supplier's terms */
  paymentTermDays?: number; discountAmount?: number; vatRate?: number; shippingCost?: number
  items: { materialId: number; packageId?: number; packageCount?: number; quantity?: number; unitPrice?: number; note?: string }[]
}
/**
 * Phiếu nhập: against a purchase order (lines name itemId) or loose (supplierId + materialId / packageId).
 * Counts in the line's packaging, or in the material's unit when loose; unitPrice per unit of the material, chưa thuế.
 */
export interface GoodsReceiptPayload {
  supplierId?: number
  delivererName?: string; invoiceSeries?: string; invoiceNo?: string; invoiceDate?: string; documentImageId?: number
  discountAmount?: number; vatRate?: number; shippingCost?: number
  /** paid to the supplier on the spot */
  paidAmount?: number; paymentMethod?: PaymentMethod; paymentReference?: string
  note?: string
  lines: {
    itemId?: number; materialId?: number; packageId?: number
    documentCount?: number; receivedCount: number; rejectedCount?: number; rejectReason?: string
    unitPrice?: number; expiryDate?: string; temperature?: number; note?: string
  }[]
}
export interface SupplierReturnPayload {
  goodsReceiptId: number; reason: string; settlement: SupplierReturnSettlement; refundMethod?: PaymentMethod
  adjustmentInvoiceNo?: string; note?: string
  /** save and send the goods back at once */
  complete?: boolean
  /** count in the receipt line's packaging */
  items: { receiptItemId: number; count: number; unitPrice?: number; note?: string }[]
}
export interface SupplierPaymentPayload {
  supplierId: number; amount: number; method: PaymentMethod; reference?: string; payeeName?: string; paidAt?: string
  goodsReceiptId?: number; purchaseOrderId?: number; documentImageId?: number; note?: string
}
export interface StocktakePayload {
  members?: string; note?: string; materialIds?: number[]
  counts?: { itemId: number; countedQuantity?: number; quality?: StockQuality; reason?: string }[]
}
export interface StaffPayload {
  fullName: string; position?: string; phone: string; email?: string; hireDate?: string
  workStatus?: WorkStatus
}
export interface TablePayload { tableNo: string; area?: string; capacity?: number; status?: TableStatus }
export interface UserPayload {
  username: string; password?: string; fullName?: string; email?: string; phone?: string; active?: boolean
  roles: User['roles']; staffId?: number; customerId?: number
}
export interface CounterOrderPayload {
  items: { coffeeId: number; quantity: number; note?: string }[]
  orderType: OrderType
  tableId?: number
  customerName?: string
  customerPhone?: string
  delivery?: DeliveryAddress
  deliveryDistrict?: string
  paymentMethod: PaymentMethod
  paidNow?: boolean
  voucherCode?: string
  note?: string
}

export const coreApi = {
  // multipart header stops the instance's JSON default from serialising the FormData; the browser adds the boundary
  uploadImage: (file: Blob) => {
    const body = new FormData()
    body.append('file', file, 'image')
    return apiClient.post<{ id: number; url: string }>('/images', body, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  dashboard: () => get<Dashboard>('/dashboard'),

  categories: () => get<Category[]>('/categories'),
  createCategory: (b: CategoryPayload) => post<Category>('/categories', b),
  updateCategory: (id: number, b: CategoryPayload) => put<Category>(`/categories/${id}`, b),
  deleteCategory: (id: number) => del(`/categories/${id}`),

  coffees: () => get<Coffee[]>('/coffees'),
  createCoffee: (b: CoffeePayload) => post<Coffee>('/coffees', b),
  updateCoffee: (id: number, b: CoffeePayload) => put<Coffee>(`/coffees/${id}`, b),
  setCoffeeStatus: (id: number, status: CoffeeStatus) => patch<Coffee>(`/coffees/${id}/status`, { status }),
  activeRecipes: () => get<Recipe[]>('/recipes'),
  recipes: (coffeeId: number) => get<Recipe[]>(`/coffees/${coffeeId}/recipes`),
  createRecipe: (coffeeId: number, b: RecipePayload) => post<Recipe>(`/coffees/${coffeeId}/recipes`, b),
  updateRecipe: (id: number, b: RecipePayload) => put<Recipe>(`/recipes/${id}`, b),
  activateRecipe: (id: number) => post<Recipe>(`/recipes/${id}/activate`),
  deleteRecipe: (id: number) => del(`/recipes/${id}`),

  materials: () => get<Material[]>('/materials'),
  createMaterial: (b: MaterialPayload) => post<Material>('/materials', b),
  updateMaterial: (id: number, b: MaterialPayload) => put<Material>(`/materials/${id}`, b),
  deleteMaterial: (id: number) => del(`/materials/${id}`),
  batches: (materialId: number) => get<Batch[]>(`/materials/${materialId}/batches`),
  transactions: (materialId?: number) => get<MaterialTransaction[]>('/inventory/transactions', { materialId }),
  alerts: () => get<InventoryAlerts>('/inventory/alerts'),
  /** phiếu nhập: loose ones and those received against a purchase order (receive) */
  goodsReceipts: (p?: { supplierId?: number; purchaseOrderId?: number; status?: GoodsReceiptStatus; from?: string; to?: string }) =>
    get<GoodsReceipt[]>('/goods-receipts', p),
  goodsReceipt: (id: number) => get<GoodsReceipt>(`/goods-receipts/${id}`),
  /** nhập lẻ, without a purchase order (supplier required) */
  createReceipt: (b: GoodsReceiptPayload) => post<GoodsReceipt>('/goods-receipts', b),
  cancelReceipt: (id: number, reason: string) => post<GoodsReceipt>(`/goods-receipts/${id}/cancel`, { reason }),

  supplierReturns: (p?: { supplierId?: number; status?: SupplierReturnStatus; goodsReceiptId?: number }) => get<SupplierReturn[]>('/supplier-returns', p),
  createSupplierReturn: (b: SupplierReturnPayload) => post<SupplierReturn>('/supplier-returns', b),
  updateSupplierReturn: (id: number, b: SupplierReturnPayload) => put<SupplierReturn>(`/supplier-returns/${id}`, b),
  completeSupplierReturn: (id: number) => post<SupplierReturn>(`/supplier-returns/${id}/complete`),
  cancelSupplierReturn: (id: number, reason: string) => post<SupplierReturn>(`/supplier-returns/${id}/cancel`, { reason }),

  supplierDebts: () => get<SupplierDebt[]>('/supplier-debts'),
  supplierLedger: (supplierId: number, p?: { from?: string; to?: string }) => get<SupplierLedger>(`/supplier-debts/${supplierId}/ledger`, p),
  supplierLedgerExcel: (supplierId: number, p?: { from?: string; to?: string }) => download(`/supplier-debts/${supplierId}/ledger.xlsx`, p),
  supplierPayments: (p?: { supplierId?: number; from?: string; to?: string }) => get<SupplierPayment[]>('/supplier-payments', p),
  paySupplier: (b: SupplierPaymentPayload) => post<SupplierPayment>('/supplier-payments', b),
  cancelSupplierPayment: (id: number, reason: string) => post<SupplierPayment>(`/supplier-payments/${id}/cancel`, { reason }),

  suppliers: () => get<Supplier[]>('/suppliers'),
  createSupplier: (b: SupplierPayload) => post<Supplier>('/suppliers', b),
  updateSupplier: (id: number, b: SupplierPayload) => put<Supplier>(`/suppliers/${id}`, b),
  /** ngừng hợp tác */
  deleteSupplier: (id: number) => del(`/suppliers/${id}`),

  purchaseOrders: (p?: { status?: PurchaseOrderStatus; supplierId?: number }) => get<PurchaseOrder[]>('/purchase-orders', p),
  purchaseOrder: (id: number) => get<PurchaseOrder>(`/purchase-orders/${id}`),
  createPurchaseOrder: (b: PurchaseOrderPayload) => post<PurchaseOrder>('/purchase-orders', b),
  updatePurchaseOrder: (id: number, b: PurchaseOrderPayload) => put<PurchaseOrder>(`/purchase-orders/${id}`, b),
  deletePurchaseOrder: (id: number) => del(`/purchase-orders/${id}`),
  sendPurchaseOrder: (id: number) => post<PurchaseOrder>(`/purchase-orders/${id}/send`),
  cancelPurchaseOrder: (id: number, reason: string) => post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason }),
  closePurchaseOrder: (id: number, reason: string) => post<PurchaseOrder>(`/purchase-orders/${id}/close`, { reason }),
  receive: (id: number, b: GoodsReceiptPayload) => post<GoodsReceipt>(`/purchase-orders/${id}/receipts`, b),

  /** phiếu hủy */
  disposeStock: (b: { batchId: number; quantity: number; reason: TransactionReason; note?: string }) =>
    post<MaterialTransaction>('/inventory/dispose', b),
  /** xuất khác */
  exportStock: (b: { batchId: number; quantity: number; reason: TransactionReason; note?: string }) =>
    post<MaterialTransaction>('/inventory/export', b),
  stocktakes: (status?: StocktakeStatus) => get<Stocktake[]>('/stocktakes', { status }),
  stocktake: (id: number) => get<Stocktake>(`/stocktakes/${id}`),
  /** materialIds: lots of these materials still in stock are added with their book quantity (none: every material) */
  createStocktake: (b: StocktakePayload) => post<Stocktake>('/stocktakes', b),
  updateStocktake: (id: number, b: StocktakePayload) => put<Stocktake>(`/stocktakes/${id}`, b),
  balanceStocktake: (id: number, resolution?: string) => post<Stocktake>(`/stocktakes/${id}/balance`, { resolution }),
  cancelStocktake: (id: number) => post<Stocktake>(`/stocktakes/${id}/cancel`),

  inventoryReport: (p: { from: string; to: string }) => get<InventoryReport>('/reports/inventory', p),
  inventoryReportExcel: (p: { from: string; to: string }) => download('/reports/inventory.xlsx', p),
  inventoryDaily: (p: { from: string; to: string; materialId?: number }) => get<InventoryDaily[]>('/reports/inventory/daily', p),
  closeInventoryDay: () => post<{ materials: number }>('/reports/inventory/close-day'),

  /** null when no shift is open */
  currentShift: () => apiClient.get<CashShift | ''>('/cash-shifts/current').then((r) => r.data || null),
  suggestedOpening: () => get<{ openingCash: number }>('/cash-shifts/suggested-opening'),
  cashShifts: (p: { from: string; to: string }) => get<CashShift[]>('/cash-shifts', p),
  openShift: (b: { openingCash: number; note?: string }) => post<CashShift>('/cash-shifts/open', b),
  shiftMovement: (b: { type: 'IN' | 'OUT'; amount: number; reason: string }) => post<CashShift>('/cash-shifts/current/movements', b),
  closeShift: (b: { denominations: Record<number, number>; nextOpeningCash?: number; receivedBy?: string; differenceReason?: string; note?: string }) =>
    post<CashShift>('/cash-shifts/current/close', b),

  workShifts: () => get<WorkShift[]>('/work-shifts'),
  saveWorkShift: (b: Omit<WorkShift, 'id' | 'minutes' | 'active'> & { id?: number; active?: boolean }) =>
    (b.id ? put<WorkShift>(`/work-shifts/${b.id}`, b) : post<WorkShift>('/work-shifts', b)),
  deleteWorkShift: (id: number) => del(`/work-shifts/${id}`),
  schedule: (p: { from: string; to: string; staffId?: number }) => get<ShiftAssignment[]>('/shift-assignments', p),
  assignShift: (b: { staffIds: number[]; dates: string[]; shiftId: number; position?: string }) => post<ShiftAssignment[]>('/shift-assignments', b),
  unassignShift: (id: number) => del(`/shift-assignments/${id}`),
  adjustAttendance: (id: number, b: { checkInAt?: string; checkOutAt?: string; leaveType?: string; note: string }) =>
    put<ShiftAssignment>(`/shift-assignments/${id}/attendance`, b),
  myShiftsToday: () => get<ShiftAssignment[]>('/attendance/today'),
  checkIn: (id: number) => post<ShiftAssignment>(`/attendance/${id}/check-in`),
  checkOut: (id: number) => post<ShiftAssignment>(`/attendance/${id}/check-out`),
  timesheet: (month: string) => get<Timesheet>('/timesheets', { month }),
  timesheetExcel: (month: string) => download('/timesheets.xlsx', { month }),

  paymentTransactions: (p: { from: string; to: string; status?: PaymentTransaction['status']; mismatch?: boolean }) =>
    get<PaymentTransaction[]>('/payment-transactions', p),
  requeryTransaction: (id: number) => post<PaymentTransaction>(`/payment-transactions/${id}/requery`),
  reconcileTransaction: (id: number, note?: string) => post<PaymentTransaction>(`/payment-transactions/${id}/reconcile`, { note }),

  auditLogs: (p: { from: string; to: string; username?: string; module?: string; failed?: boolean; keyword?: string; page?: number; size?: number }) =>
    get<{ items: AuditLog[]; total: number }>('/audit-logs', p),
  auditFilters: () => get<{ usernames: string[]; modules: string[] }>('/audit-logs/filters'),
  auditExcel: (p: { from: string; to: string; username?: string; module?: string; failed?: boolean; keyword?: string }) => download('/audit-logs/export.xlsx', p),

  coffeeCosts: () => get<CoffeeCost[]>('/coffee-costs'),
  coffeeCostHistory: (coffeeId: number) => get<CoffeeCostHistory[]>(`/coffee-costs/${coffeeId}/history`),
  recalculateCosts: () => post<{ changed: number }>('/coffee-costs/recalculate'),
  setCoffeePrice: (coffeeId: number, price: number) => put<CoffeeCost>(`/coffee-costs/${coffeeId}/price`, { price }),
  /** lots: input material id -> lot to take it from first (default FEFO) */
  produce: (b: { materialId: number; batches: number; expiresAt?: string; note?: string; lots?: Record<number, number> }) => post<Batch>('/inventory/produce', b),

  staff: () => get<Staff[]>('/staff'),
  createStaff: (b: StaffPayload) => post<Staff>('/staff', b),
  updateStaff: (id: number, b: StaffPayload) => put<Staff>(`/staff/${id}`, b),
  deleteStaff: (id: number) => del(`/staff/${id}`),

  tables: () => get<DiningTable[]>('/tables'),
  createTable: (b: TablePayload) => post<DiningTable>('/tables', b),
  updateTable: (id: number, b: TablePayload) => put<DiningTable>(`/tables/${id}`, b),
  regenerateQr: (id: number) => post<DiningTable>(`/tables/${id}/regenerate-qr`),
  deleteTable: (id: number) => del(`/tables/${id}`),

  users: () => get<User[]>('/users'),
  createUser: (b: UserPayload) => post<User>('/users', b),
  updateUser: (id: number, b: UserPayload) => put<User>(`/users/${id}`, b),
  deleteUser: (id: number) => del(`/users/${id}`),

  orders: (p: { status?: OrderStatus; channel?: OrderChannel; from?: string; to?: string }) => get<Order[]>('/orders', p),
  order: (id: number) => get<Order>(`/orders/${id}`),
  orderHistory: (id: number) => get<OrderStatusChange[]>(`/orders/${id}/history`),
  quote: (b: { items: { coffeeId: number; quantity: number }[]; orderType: OrderType; customerPhone?: string; voucherCode?: string; deliveryDistrict?: string }) =>
    post<PriceQuote>('/orders/quote', b),
  createOrder: (b: CounterOrderPayload) => post<Order>('/orders', b),
  confirm: (id: number) => post<Order>(`/orders/${id}/confirm`),
  reject: (id: number, reason: string) => post<Order>(`/orders/${id}/reject`, { reason }),
  cancel: (id: number, reason: string) => post<Order>(`/orders/${id}/cancel`, { reason }),
  prepare: (id: number) => post<Order>(`/orders/${id}/prepare`),
  ready: (id: number) => post<Order>(`/orders/${id}/ready`),
  dispatch: (id: number) => post<Order>(`/orders/${id}/dispatch`),
  complete: (id: number) => post<Order>(`/orders/${id}/complete`),
  collectPayment: (id: number) => post<Order>(`/orders/${id}/collect-payment`),
  refund: (paymentId: number, amount: number) => post<Payment>(`/payments/${paymentId}/refund`, { amount }),

  orderIncidents: (orderId: number) => get<Incident[]>(`/orders/${orderId}/incidents`),
  reportIncident: (orderId: number, b: { type: IncidentType; severity?: IncidentSeverity; reason?: string; description?: string }) =>
    post<Incident>(`/orders/${orderId}/incidents`, b),
  incidents: () => get<Incident[]>('/incidents'),
  resolveIncident: (id: number, b: { resolution: string; voucherValue?: number; voucherMinOrderValue?: number; voucherCount?: number; voucherValidDays?: number }) =>
    post<Incident>(`/incidents/${id}/resolve`, b),

  shipments: () => get<Shipment[]>('/shipments'),
  updateShipment: (id: number, b: { status: ShipmentStatus; carrier?: string; trackingCode?: string; note?: string }) =>
    patch<Shipment>(`/shipments/${id}`, b),

  deliveryZones: () => get<DeliveryZone[]>('/delivery-zones'),
  saveDeliveryZone: (b: { id?: number; name: string; districts: string[]; fee: number; freeShipThreshold?: number; minOrderAmount?: number; estimatedMinutes?: number; active?: boolean; sortOrder?: number }) =>
    (b.id ? put<DeliveryZone>(`/delivery-zones/${b.id}`, b) : post<DeliveryZone>('/delivery-zones', b)),
  deleteDeliveryZone: (id: number) => del(`/delivery-zones/${id}`),
  ahamoveEstimate: (shipmentId: number) => get<AhamoveEstimate>(`/shipments/${shipmentId}/ahamove/estimate`),
  ahamoveBook: (shipmentId: number) => post<Shipment>(`/shipments/${shipmentId}/ahamove/book`),
  ahamoveCancel: (shipmentId: number, reason: string) => post<Shipment>(`/shipments/${shipmentId}/ahamove/cancel`, { reason }),
  shipmentEvents: (shipmentId: number) => get<ShipmentEvent[]>(`/shipments/${shipmentId}/events`),

  invoices: (p: { from: string; to: string; status?: Invoice['status']; keyword?: string }) => get<Invoice[]>('/invoices', p),
  invoice: (id: number) => get<Invoice>(`/invoices/${id}`),
  setInvoiceBuyer: (orderCode: string, b: InvoiceBuyer) => post<Invoice>(`/invoices/order/${orderCode}/buyer`, b),
  replaceInvoice: (id: number, buyer: InvoiceBuyer, reason: string) => post<Invoice>(`/invoices/${id}/replace`, { buyer, reason }),
  retryInvoice: (id: number) => post<Invoice>(`/invoices/${id}/retry`),
  issueInvoicesNow: () => post<{ issued: number }>('/invoices/issue-now'),

  notificationTemplates: () => get<NotificationTemplate[]>('/notifications/templates'),
  updateNotificationTemplate: (code: string, b: Partial<Omit<NotificationTemplate, 'code' | 'name'>>) =>
    put<NotificationTemplate>(`/notifications/templates/${code}`, b),
  notificationMessages: (p: { from: string; to: string; status?: NotificationMessage['status']; phone?: string }) =>
    get<NotificationMessage[]>('/notifications/messages', p),
  resendNotification: (id: number) => post<NotificationMessage>(`/notifications/messages/${id}/resend`),

  lookupCustomer: (phone: string) => get<CustomerLookup>('/customers/lookup', { phone }),
}
