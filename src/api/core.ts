import apiClient from './client'
import type {
  Batch, Category, Coffee, CoffeeStatus, CustomerLookup, Dashboard, DeliveryAddress, DiningTable, Incident,
  IncidentSeverity, IncidentType, InventoryAlerts, Material, MaterialStatus, MaterialTransaction,
  Order, OrderChannel, OrderStatus, OrderType, Payment, PaymentMethod, PriceQuote, Recipe, Shipment, ShipmentStatus,
  Staff, TableStatus, User, WorkStatus,
} from './types'

const get = <T,>(url: string, params?: object) => apiClient.get<T>(url, { params }).then((r) => r.data)
const post = <T,>(url: string, body?: unknown) => apiClient.post<T>(url, body).then((r) => r.data)
const put = <T,>(url: string, body?: unknown) => apiClient.put<T>(url, body).then((r) => r.data)
const patch = <T,>(url: string, body?: unknown) => apiClient.patch<T>(url, body).then((r) => r.data)
const del = (url: string) => apiClient.delete(url).then(() => undefined)

export interface CategoryPayload { name: string; description?: string; displayOrder?: number }
export interface CoffeePayload {
  categoryId: number; name: string; imageUrl?: string; price: number; description?: string; status?: CoffeeStatus
}
export interface RecipePayload {
  brewMethod?: string; description?: string; brewTimeMin?: number; activate?: boolean
  materials: { materialId: number; quantity: number; note?: string }[]
  steps: string[]
}
export interface MaterialPayload { name: string; unit: string; minStock?: number; status?: MaterialStatus }
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
  dashboard: () => get<Dashboard>('/dashboard'),

  categories: () => get<Category[]>('/categories'),
  createCategory: (b: CategoryPayload) => post<Category>('/categories', b),
  updateCategory: (id: number, b: CategoryPayload) => put<Category>(`/categories/${id}`, b),
  deleteCategory: (id: number) => del(`/categories/${id}`),

  coffees: () => get<Coffee[]>('/coffees'),
  createCoffee: (b: CoffeePayload) => post<Coffee>('/coffees', b),
  updateCoffee: (id: number, b: CoffeePayload) => put<Coffee>(`/coffees/${id}`, b),
  setCoffeeStatus: (id: number, status: CoffeeStatus) => patch<Coffee>(`/coffees/${id}/status`, { status }),
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
  importStock: (b: { materialId: number; quantity: number; unitCost?: number; expiryDate?: string; note?: string }) =>
    post<Batch>('/inventory/import', b),
  exportStock: (b: { materialId: number; quantity: number; note?: string }) =>
    post<MaterialTransaction[]>('/inventory/export', b),
  adjustStock: (b: { batchId: number; actualQuantity: number; note?: string }) =>
    post<MaterialTransaction>('/inventory/adjust', b),

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
  quote: (b: { items: { coffeeId: number; quantity: number }[]; orderType: OrderType; customerPhone?: string; voucherCode?: string }) =>
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

  lookupCustomer: (phone: string) => get<CustomerLookup>('/customers/lookup', { phone }),
}
