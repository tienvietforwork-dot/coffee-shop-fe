import apiClient from './client'
import type {
  Category, Coffee, CoffeeStatus, CustomerLookup, Dashboard, DeliveryAddress, DiningTable, Incident,
  IncidentSeverity, IncidentType, IncidentVoucherOption, Material,
  Order, OrderChannel, OrderStatus, OrderStatusChange, OrderType, Payment, PaymentMethod, PriceQuote, Recipe, Shipment, ShipmentStatus,
  Staff, TableStatus, User, WorkStatus,
  CashShift, WorkShift, ShiftAssignment, Timesheet, AuditLog, PaymentTransaction, DeliverySettings, DeliveryArea, ShipmentEvent, ShipperStat, RoutePlan, ScheduleRow, Subscription, SubscriptionPayload, SubscriptionStatus,
  Invoice, InvoiceBuyer, InvoiceSettings, NotificationTemplate, NotificationMessage,
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
  categoryId: number; code?: string; name: string; imageId?: number; imageUrl?: string; price: number; description?: string; status?: CoffeeStatus
}
export interface RecipePayload {
  brewMethod?: string; description?: string; brewTimeMin?: number; activate?: boolean
  materials: { materialId: number; quantity: number; note?: string }[]
  steps: string[]
}
export interface MaterialPayload {
  name: string; unit: string; quantity?: number
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
  adjustMaterial: (id: number, delta: number) => patch<Material>(`/materials/${id}/quantity`, { delta }),

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
  quote: (b: { items: { coffeeId: number; quantity: number }[]; orderType: OrderType; customerPhone?: string; voucherCode?: string; deliveryAddress?: string }) =>
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
  refundPending: () => get<Payment[]>('/payments/refund-pending'),
  manualRefund: (paymentId: number, b: { reference: string; note?: string }) => post<Payment>(`/payments/${paymentId}/manual-refund`, b),
  retryRefund: (paymentId: number) => post<Payment>(`/payments/${paymentId}/retry-refund`),

  orderIncidents: (orderId: number) => get<Incident[]>(`/orders/${orderId}/incidents`),
  reportIncident: (orderId: number, b: { type: IncidentType; severity?: IncidentSeverity; reason?: string; description?: string }) =>
    post<Incident>(`/orders/${orderId}/incidents`, b),
  incidents: () => get<Incident[]>('/incidents'),
  incidentVoucherOptions: () => get<IncidentVoucherOption[]>('/incidents/voucher-options'),
  resolveIncident: (id: number, b: { resolution: string; voucherId?: number; voucherCount?: number; voucherValidDays?: number }) =>
    post<Incident>(`/incidents/${id}/resolve`, b),

  shipments: () => get<Shipment[]>('/shipments'),
  updateShipment: (id: number, b: { status: ShipmentStatus; note?: string }) =>
    patch<Shipment>(`/shipments/${id}`, b),
  assignShipper: (id: number, staffId: number | null) => put<Shipment>(`/shipments/${id}/shipper`, { staffId }),
  shippers: () => get<ShipperStat[]>('/shippers'),
  myDeliveries: () => get<Shipment[]>('/my-deliveries'),
  shipmentRoute: (shipmentIds: number[]) => post<RoutePlan>('/shipments/route', { shipmentIds }),
  deliverySchedule: (date?: string) => get<ScheduleRow[]>('/delivery-schedule', date ? { date } : undefined),
  subscriptions: () => get<Subscription[]>('/subscriptions'),
  saveSubscription: (b: SubscriptionPayload & { id?: number }) =>
    (b.id ? put<Subscription>(`/subscriptions/${b.id}`, b) : post<Subscription>('/subscriptions', b)),
  setSubscriptionStatus: (id: number, status: SubscriptionStatus) => patch<Subscription>(`/subscriptions/${id}/status`, { status }),

  deliverySettings: () => get<DeliverySettings>('/delivery-settings'),
  saveDeliverySettings: (b: DeliverySettings) => put<DeliverySettings>('/delivery-settings', b),
  deliveryAreas: () => get<DeliveryArea[]>('/delivery-areas'),
  saveDeliveryArea: (b: Omit<DeliveryArea, 'id'> & { id?: number }) =>
    (b.id ? put<DeliveryArea>(`/delivery-areas/${b.id}`, b) : post<DeliveryArea>('/delivery-areas', b)),
  deleteDeliveryArea: (id: number) => del(`/delivery-areas/${id}`),
  shipmentEvents: (shipmentId: number) => get<ShipmentEvent[]>(`/shipments/${shipmentId}/events`),

  invoices: (p: { from: string; to: string; status?: Invoice['status']; keyword?: string }) => get<Invoice[]>('/invoices', p),
  invoice: (id: number) => get<Invoice>(`/invoices/${id}`),
  setInvoiceBuyer: (orderCode: string, b: InvoiceBuyer) => post<Invoice>(`/invoices/order/${orderCode}/buyer`, b),
  replaceInvoice: (id: number, buyer: InvoiceBuyer, reason: string) => post<Invoice>(`/invoices/${id}/replace`, { buyer, reason }),
  retryInvoice: (id: number) => post<Invoice>(`/invoices/${id}/retry`),
  invoiceSettings: () => get<InvoiceSettings>('/invoice-settings'),
  saveInvoiceSettings: (b: InvoiceSettings) => put<InvoiceSettings>('/invoice-settings', b),

  notificationTemplates: () => get<NotificationTemplate[]>('/notifications/templates'),
  updateNotificationTemplate: (code: string, b: Partial<Omit<NotificationTemplate, 'code' | 'name'>>) =>
    put<NotificationTemplate>(`/notifications/templates/${code}`, b),
  notificationMessages: (p: { from: string; to: string; status?: NotificationMessage['status']; phone?: string }) =>
    get<NotificationMessage[]>('/notifications/messages', p),
  resendNotification: (id: number) => post<NotificationMessage>(`/notifications/messages/${id}/resend`),

  lookupCustomer: (phone: string) => get<CustomerLookup>('/customers/lookup', { phone }),
}
