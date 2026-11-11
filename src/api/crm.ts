import apiClient from './client'

/*
 * app-crm API. Every endpoint lives under /api/v1 on app-crm; the gateway (nginx / Vite proxy)
 * maps /api/crm/* -> app-crm /api/*, so the client calls /crm/v1/...
 * Types mirror the DTOs in app-crm (com.coffeeshop.crm.dto.*) — keep them in sync with that module.
 */

export type InteractionChannel = 'CALL' | 'CHAT' | 'EMAIL' | 'IN_STORE' | 'NOTE'
export type InteractionStatus = 'OPEN' | 'FOLLOW_UP' | 'CLOSED'
export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
export type FeedbackCategory = 'COMPLAINT' | 'SUGGESTION' | 'PRAISE'
export type FeedbackIssueType = 'PRODUCT' | 'SERVICE' | 'DELIVERY' | 'PAYMENT' | 'OTHER'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type Satisfaction = 'SATISFIED' | 'UNSATISFIED'
export type GroupType = 'AUTOMATIC' | 'MANUAL'

/** Spring Data page as serialized by app-crm. */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

interface Audit {
  createdBy?: string
  createdAt?: string
  updatedBy?: string
  updatedAt?: string
}

// ---------- Customers ----------

export interface Customer extends Audit {
  id: number
  fullName?: string
  phone: string
  email?: string
  dateOfBirth?: string
  gender?: string
  description?: string
  loyaltyPoints: number
  registeredAt: string
  groups: string[]
}

export interface CustomerPayload {
  fullName?: string
  phone: string
  email?: string
  dateOfBirth?: string
  gender?: string
  description?: string
}

export interface CustomerAddress extends Audit {
  id: number
  customerId: number
  label?: string
  recipientName: string
  recipientPhone: string
  address: string
  isDefault: boolean
}

export interface CustomerAddressPayload {
  label?: string
  recipientName: string
  recipientPhone: string
  address: string
  isDefault?: boolean
}

export interface Customer360 {
  profile: {
    id: number
    fullName?: string
    phone: string
    email?: string
    dateOfBirth?: string
    gender?: string
    description?: string
    loyaltyPoints: number
    registeredAt: string
    addresses: { id: number; label?: string; recipientName: string; recipientPhone: string; address: string; isDefault: boolean }[]
    groups: string[]
  }
  metrics: {
    totalSpend: number
    totalOrders: number
    averageOrderValue: number
    ordersLast30Days: number
    lastOrderAt?: string
    favoriteCoffee?: string
    favoriteCategory?: string
  }
  recentOrders: { orderCode: string; status: string; totalAmount: number; orderedAt: string; items?: string }[]
  recentInteractions: {
    id: number; channel: InteractionChannel; status: InteractionStatus; content?: string; note?: string
    remindAt?: string; staffId?: number; occurredAt?: string; outcome?: string; createdAt: string
  }[]
  recentFeedbacks: {
    id: number; topic?: string; issueType?: FeedbackIssueType; category?: FeedbackCategory; sentiment?: Sentiment
    content: string; status: FeedbackStatus; escalated: boolean; resolution?: string; satisfaction?: Satisfaction
    rating?: number; staffId?: number; topics: string[]
    responses: { id: number; message: string; staffId?: number; sentAt: string; readAt?: string }[]
    createdAt: string
  }[]
  timeline: { eventType: string; description: string; eventTime: string }[]
  pointHistory: { id: number; pointsChange: number; reason?: string; orderCode?: string; createdAt: string }[]
}

// ---------- Interactions ----------

export interface Interaction extends Audit {
  id: number
  customerId: number
  channel: InteractionChannel
  content?: string
  occurredAt?: string
  note?: string
  staffId?: number
  status: InteractionStatus
  remindAt?: string
  closedAt?: string
  outcome?: string
  visibleToCustomer: boolean
  customerReadAt?: string
}

export interface InteractionPayload {
  customerId: number
  channel: InteractionChannel
  content?: string
  occurredAt?: string
  note?: string
  staffId?: number
  remindAt?: string
  visibleToCustomer?: boolean
}

export interface InteractionUpdatePayload {
  channel?: InteractionChannel
  content?: string
  occurredAt?: string
  outcome?: string
  note?: string
  staffId?: number
  remindAt?: string
  clearReminder?: boolean
  visibleToCustomer?: boolean
  status?: InteractionStatus
}

// ---------- Feedbacks ----------

export interface Feedback extends Audit {
  id: number
  customerId: number
  customerName?: string
  customerPhone?: string
  staffId?: number
  topic?: string
  topics: string[]
  issueType?: FeedbackIssueType
  category?: FeedbackCategory
  sentiment?: Sentiment
  content: string
  status: FeedbackStatus
  escalated: boolean
  resolution?: string
  satisfaction?: Satisfaction
  rating?: number
  closedAt?: string
  approvalStatus?: string
  approvalNote?: string
  approvedBy?: string
  approvedAt?: string
}

export interface FeedbackUpdatePayload {
  staffId?: number
  category?: FeedbackCategory
  topic?: string
  topics?: string[]
  issueType?: FeedbackIssueType
  sentiment?: Sentiment
  status?: FeedbackStatus
  escalated?: boolean
  resolution?: string
  satisfaction?: Satisfaction
  content?: string
  rating?: number
}

export interface FeedbackReply extends Audit {
  id: number
  feedbackId: number
  staffId?: number
  senderType: string
  message: string
  sentAt: string
  readAt?: string
}

// ---------- Groups ----------

/** Automatic-group criteria (CriteriaRuleDTO). All set fields must match. */
export interface CriteriaRule {
  minSpend?: number
  maxSpend?: number
  minOrders?: number
  inactiveDays?: number
  favoriteCategoryId?: number
  favoriteCoffeeId?: number
}

export interface CustomerGroup extends Audit {
  id: number
  name: string
  description?: string
  groupType: GroupType
  criteriaRule?: CriteriaRule | null
  recalculatedAt?: string
}

export interface CustomerGroupPayload {
  name: string
  description?: string
  groupType: GroupType
  criteriaRule?: CriteriaRule
}

export interface GroupMember extends Audit {
  id: number
  groupId: number
  customerId: number
  isManual: boolean
  isExcluded: boolean
  addedAt: string
}

// ---------- Insights ----------

export interface CustomerMetric {
  customerId: number
  fullName?: string
  phone: string
  totalSpend: number
  totalOrders: number
  averageOrderValue: number
  lastOrderAt?: string
  daysSinceLastOrder?: number
}

export interface GroupMetric {
  groupId: number
  groupName: string
  memberCount: number
  totalSpend: number
  totalOrders: number
  averageOrderValue: number
  favoriteCategory?: string
  favoriteCoffee?: string
  interactionCount: number
  feedbackCount: number
}

export interface CustomerValue {
  customerId: number
  fullName?: string
  phone: string
  loyaltyPoints: number
  registeredAt: string
  totalSpend: number
  totalOrders: number
  averageOrderValue: number
  lastOrderAt?: string
  daysSinceLastOrder?: number
  customerTenureDays?: number
}

export interface ProductAffinity { itemId: number; itemName: string; customerCount: number; orderCount: number; quantitySold: number; revenue: number }
export interface SalesTrend { month: string; totalOrders: number; activeCustomers: number; revenue: number }
export interface FeedbackSummary { issueType?: string; category?: string; sentiment?: string; status: string; feedbackCount: number; customerCount: number }
export interface FeedbackTrend {
  periodStart: string; totalFeedback: number; complaints: number; suggestions: number; praises: number
  negativeFeedback: number; unresolvedFeedback: number; customerCount: number
}
export interface CustomerGrowth { month: string; newProfiles: number; activeCustomers: number; firstTimeBuyers: number; returningCustomers: number }
export interface RepeatedComplaint { topic: string; complaintCount: number; customerCount: number }

export interface DateRange { fromDate?: string; toDate?: string }

const base = '/crm/v1'
const get = <T,>(url: string, params?: object) => apiClient.get<T>(`${base}${url}`, { params }).then((r) => r.data)
const post = <T,>(url: string, body?: unknown, params?: object) => apiClient.post<T>(`${base}${url}`, body, { params }).then((r) => r.data)
const put = <T,>(url: string, body: unknown) => apiClient.put<T>(`${base}${url}`, body).then((r) => r.data)
const del = (url: string) => apiClient.delete(`${base}${url}`).then(() => undefined)

export const crmApi = {
  // Customers + 360 profile
  customers: (params: { q?: string; page?: number; size?: number }) => get<Page<Customer>>('/customers', params),
  customer360: (id: number, range?: DateRange) => get<Customer360>(`/customers/${id}/360`, range),
  createCustomer: (b: CustomerPayload) => post<Customer>('/customers', b),
  updateCustomer: (id: number, b: CustomerPayload) => put<Customer>(`/customers/${id}`, b),
  mergeCustomers: (keepId: number, duplicateId: number) =>
    post<{ message: string }>(`/customers/${keepId}/merge`, undefined, { duplicateId }),

  // Address book
  addresses: (customerId: number) => get<CustomerAddress[]>(`/customers/${customerId}/addresses`),
  createAddress: (customerId: number, b: CustomerAddressPayload) => post<CustomerAddress>(`/customers/${customerId}/addresses`, b),
  updateAddress: (customerId: number, addressId: number, b: CustomerAddressPayload) =>
    put<CustomerAddress>(`/customers/${customerId}/addresses/${addressId}`, b),
  deleteAddress: (customerId: number, addressId: number) => del(`/customers/${customerId}/addresses/${addressId}`),

  // Interactions
  interactions: (params: { customerId?: number; page?: number; size?: number }) => get<Page<Interaction>>('/interactions', params),
  dueReminders: (params?: { until?: string; page?: number; size?: number }) => get<Page<Interaction>>('/interactions/reminders', params),
  createInteraction: (b: InteractionPayload) => post<Interaction>('/interactions', b),
  updateInteraction: (id: number, b: InteractionUpdatePayload) => put<Interaction>(`/interactions/${id}`, b),
  closeInteraction: (id: number, outcome?: string) => post<Interaction>(`/interactions/${id}/close`, { outcome }),
  deleteInteraction: (id: number) => del(`/interactions/${id}`),

  // Feedbacks
  feedbacks: (params: { customerId?: number; page?: number; size?: number }) => get<Page<Feedback>>('/feedbacks', params),
  updateFeedback: (id: number, b: FeedbackUpdatePayload) => put<Feedback>(`/feedbacks/${id}`, b),
  escalateFeedback: (id: number, staffId?: number) => post<Feedback>(`/feedbacks/${id}/escalate`, undefined, { staffId }),
  decideEscalation: (id: number, b: { decision: 'APPROVE' | 'REJECT'; note?: string }) => post<Feedback>(`/feedbacks/${id}/approval`, b),
  closeFeedback: (id: number, b: { resolution?: string; satisfaction?: Satisfaction }) => post<Feedback>(`/feedbacks/${id}/close`, b),
  feedbackReplies: (id: number) => get<FeedbackReply[]>(`/feedbacks/${id}/responses`),
  replyFeedback: (id: number, b: { message: string; staffId?: number }) => post<FeedbackReply>(`/feedbacks/${id}/responses`, b),
  deleteFeedback: (id: number) => del(`/feedbacks/${id}`),
  /** Guest form on the ordering site (no login). */
  submitFeedback: (b: { fullName?: string; phone: string; topic?: string; content: string }) => post<Feedback>('/feedbacks/public', b),

  // Customer groups
  groups: () => get<CustomerGroup[]>('/customer-groups'),
  createGroup: (b: CustomerGroupPayload) => post<CustomerGroup>('/customer-groups', b),
  updateGroup: (id: number, b: CustomerGroupPayload) => put<CustomerGroup>(`/customer-groups/${id}`, b),
  deleteGroup: (id: number) => del(`/customer-groups/${id}`),
  groupMembers: (id: number) => get<GroupMember[]>(`/customer-groups/${id}/members`),
  addMember: (id: number, customerId: number) => post<GroupMember>(`/customer-groups/${id}/members/${customerId}`),
  removeMember: (id: number, customerId: number) => del(`/customer-groups/${id}/members/${customerId}`),
  previewGroup: (id: number) => post<Customer[]>(`/customer-groups/${id}/preview`),
  evaluateGroup: (id: number) => post<{ groupId: number; matchedCustomers: number }>(`/customer-groups/${id}/evaluate`),

  // Insights
  topCustomers: (params?: DateRange & { limit?: number; sortBy?: 'spend' | 'orders' | 'average' }) =>
    get<CustomerMetric[]>('/insights/top-customers', params),
  inactiveCustomers: (params?: { inactiveDays?: number; limit?: number }) => get<CustomerMetric[]>('/insights/inactive-customers', params),
  inactiveCount: (inactiveDays = 90) => get<number>('/insights/inactive-customers/count', { inactiveDays }),
  groupMetrics: (groupId: number, range?: DateRange) => get<GroupMetric>(`/insights/groups/${groupId}`, range),
  compareGroups: (groupIds: number[], range?: DateRange) =>
    get<GroupMetric[]>('/insights/groups/compare', { groupIds: groupIds.join(','), ...range }),
  salesTrends: (params?: DateRange & { period?: 'week' | 'month' | 'quarter' }) => get<SalesTrend[]>('/insights/sales-trends', params),
  feedbackSummary: (range?: DateRange) => get<FeedbackSummary[]>('/insights/feedback-summary', range),
  feedbackTrends: (params?: DateRange & { period?: 'day' | 'week' | 'month' }) => get<FeedbackTrend[]>('/insights/feedback-trends', params),
  customerGrowth: (range?: DateRange) => get<CustomerGrowth[]>('/insights/customer-growth', range),
  customerValue: (limit = 50) => get<CustomerValue[]>('/insights/customer-value', { limit }),
  productAffinity: (params?: DateRange & { dimension?: 'coffee' | 'category'; limit?: number }) =>
    get<ProductAffinity[]>('/insights/product-affinity', params),
  repeatedComplaints: (range?: DateRange) => get<RepeatedComplaint[]>('/insights/repeated-complaints', range),
}
