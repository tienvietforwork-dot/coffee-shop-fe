import apiClient from './client'

/*
 * app-crm API (routed by nginx-gateway: /api/crm/* -> app-crm).
 * The backend for these endpoints is owned by the CRM module; this file is the
 * contract the admin UI expects. Tables: customers, customer_addresses,
 * interactions, feedbacks, customer_groups, customer_group_members, loyalty_point_history.
 */

export type InteractionChannel = 'CALL' | 'CHAT' | 'EMAIL' | 'IN_STORE' | 'NOTE'
export type InteractionStatus = 'OPEN' | 'FOLLOW_UP' | 'CLOSED'
export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type GroupCriteria = 'SPENDING' | 'FREQUENCY' | 'RECENCY' | 'FAVORITE_COFFEE' | 'MANUAL'

export interface CustomerSummary {
  id: number
  fullName?: string
  phone: string
  email?: string
  loyaltyPoints: number
  registeredAt: string
  orderCount: number
  totalSpent: number
  lastOrderAt?: string
  groups: string[]
}

export interface Interaction {
  id: number
  customerId: number
  customerName?: string
  channel: InteractionChannel
  content?: string
  note?: string
  status: InteractionStatus
  remindAt?: string
  createdAt: string
  closedAt?: string
}

export interface Feedback {
  id: number
  customerId: number
  customerName?: string
  customerPhone?: string
  topic?: string
  category?: string
  sentiment?: Sentiment
  content: string
  status: FeedbackStatus
  escalated: boolean
  resolution?: string
  satisfaction?: 'SATISFIED' | 'UNSATISFIED'
  createdAt: string
  closedAt?: string
}

export interface Customer360 {
  customer: CustomerSummary & { addresses: { id: number; label?: string; address: string; isDefault: boolean }[] }
  stats: { orderCount: number; totalSpent: number; avgOrderValue: number; lastOrderAt?: string; favoriteCoffee?: string; ordersPerMonth: number }
  orders: { id: number; orderCode: string; orderedAt: string; totalAmount: number; status: string; channel: string }[]
  interactions: Interaction[]
  feedbacks: Feedback[]
  pointHistory: { id: number; pointsChange: number; reason?: string; createdAt: string }[]
}

export interface CustomerGroup {
  id: number
  name: string
  description?: string
  criteriaType?: GroupCriteria
  criteriaRule?: Record<string, unknown>
  recalculatedAt?: string
  memberCount: number
}

export interface CustomerInsights {
  totalCustomers: number
  activeCustomers: number
  newThisMonth: number
  churnRisk: number
  topSpenders: { id: number; fullName?: string; phone: string; totalSpent: number; orderCount: number }[]
  atRisk: { id: number; fullName?: string; phone: string; lastOrderAt?: string; totalSpent: number }[]
  growth: { month: string; newCustomers: number; activeCustomers: number }[]
  favoriteCoffees: { name: string; customers: number }[]
}

const base = '/crm'

export const crmApi = {
  customers: (q?: string) => apiClient.get<CustomerSummary[]>(`${base}/customers`, { params: { q } }).then((r) => r.data),
  customer360: (id: number) => apiClient.get<Customer360>(`${base}/customers/${id}`).then((r) => r.data),
  saveCustomer: (b: { id?: number; fullName?: string; phone: string; email?: string }) =>
    (b.id ? apiClient.put(`${base}/customers/${b.id}`, b) : apiClient.post(`${base}/customers`, b)).then((r) => r.data),
  mergeCustomers: (keepId: number, duplicateId: number) =>
    apiClient.post(`${base}/customers/${keepId}/merge`, { duplicateId }).then((r) => r.data),

  interactions: (params?: { customerId?: number; status?: InteractionStatus }) =>
    apiClient.get<Interaction[]>(`${base}/interactions`, { params }).then((r) => r.data),
  saveInteraction: (b: Partial<Interaction> & { customerId: number; channel: InteractionChannel }) =>
    (b.id ? apiClient.put(`${base}/interactions/${b.id}`, b) : apiClient.post(`${base}/interactions`, b)).then((r) => r.data),
  closeInteraction: (id: number) => apiClient.post(`${base}/interactions/${id}/close`).then((r) => r.data),

  feedbacks: (status?: FeedbackStatus) =>
    apiClient.get<Feedback[]>(`${base}/feedbacks`, { params: { status } }).then((r) => r.data),
  updateFeedback: (id: number, b: Partial<Pick<Feedback, 'topic' | 'category' | 'sentiment' | 'status' | 'escalated' | 'resolution'>>) =>
    apiClient.put(`${base}/feedbacks/${id}`, b).then((r) => r.data),
  /** Guest form on the ordering site. */
  submitFeedback: (b: { fullName?: string; phone: string; orderCode?: string; topic?: string; content: string }) =>
    apiClient.post(`${base}/public/feedbacks`, b).then((r) => r.data),

  groups: () => apiClient.get<CustomerGroup[]>(`${base}/groups`).then((r) => r.data),
  saveGroup: (b: Partial<CustomerGroup> & { name: string }) =>
    (b.id ? apiClient.put(`${base}/groups/${b.id}`, b) : apiClient.post(`${base}/groups`, b)).then((r) => r.data),
  deleteGroup: (id: number) => apiClient.delete(`${base}/groups/${id}`),
  groupMembers: (id: number) => apiClient.get<CustomerSummary[]>(`${base}/groups/${id}/members`).then((r) => r.data),
  addMember: (id: number, customerId: number) => apiClient.post(`${base}/groups/${id}/members`, { customerId }),
  removeMember: (id: number, customerId: number) => apiClient.delete(`${base}/groups/${id}/members/${customerId}`),
  recalculate: (id: number) => apiClient.post(`${base}/groups/${id}/recalculate`).then((r) => r.data),
  previewGroup: (b: { criteriaType: GroupCriteria; criteriaRule: Record<string, unknown> }) =>
    apiClient.post<CustomerSummary[]>(`${base}/groups/preview`, b).then((r) => r.data),

  insights: () => apiClient.get<CustomerInsights>(`${base}/insights`).then((r) => r.data),
}
