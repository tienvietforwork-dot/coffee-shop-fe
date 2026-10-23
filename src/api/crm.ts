import crmClient from './crmClient'

export type InteractionChannel = 'CALL' | 'CHAT' | 'EMAIL' | 'IN_STORE' | 'NOTE'
export type InteractionStatus = 'OPEN' | 'FOLLOW_UP' | 'CLOSED'
export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type GroupCriteria = 'SPENDING' | 'FREQUENCY' | 'RECENCY' | 'FAVORITE_COFFEE' | 'MANUAL'

// Nhãn hiển thị thống nhất cho enum phản hồi; giá trị API/database vẫn giữ nguyên để tương thích.
export const CRM_FEEDBACK_LABELS = {
  issueType: { PRODUCT: 'Sản phẩm', SERVICE: 'Dịch vụ', DELIVERY: 'Giao hàng', PAYMENT: 'Thanh toán', OTHER: 'Khác', UNCLASSIFIED: 'Chưa phân loại' },
  category: { COMPLAINT: 'Khiếu nại', SUGGESTION: 'Góp ý', PRAISE: 'Khen ngợi', UNCLASSIFIED: 'Chưa phân loại' },
  sentiment: { POSITIVE: 'Tích cực', NEUTRAL: 'Trung lập', NEGATIVE: 'Tiêu cực', UNCLASSIFIED: 'Chưa phân loại' },
  status: { NEW: 'Mới', IN_PROGRESS: 'Đang xử lý', ESCALATED: 'Chuyển cấp', RESOLVED: 'Đã gửi kết quả', CLOSED: 'Đã đóng' },
} as const

export function crmFeedbackLabel(group: keyof typeof CRM_FEEDBACK_LABELS, value?: string) {
  if (!value) return 'Chưa phân loại'
  return CRM_FEEDBACK_LABELS[group][value as keyof (typeof CRM_FEEDBACK_LABELS)[typeof group]] ?? value
}

export interface CustomerSummary {
  id: number
  fullName?: string
  phone: string
  email?: string
  dateOfBirth?: string
  gender?: string
  description?: string
  loyaltyPoints: number
  registeredAt: string
  orderCount?: number
  totalSpent?: number
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
  staffId?: number
  outcome?: string
  visibleToCustomer?: boolean
  customerReadAt?: string
}

export interface Feedback {
  id: number
  customerId: number
  customerName?: string
  customerPhone?: string
  topic?: string
  category?: string
  issueType?: string
  sentiment?: Sentiment
  content: string
  status: FeedbackStatus
  escalated: boolean
  staffId?: number
  resolution?: string
  satisfaction?: 'SATISFIED' | 'UNSATISFIED'
  createdAt: string
  closedAt?: string
  rating?: number
  approvalStatus?: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  approvalNote?: string
  approvedBy?: string
  approvedAt?: string
}

export interface InteractionReminderNotification {
  id: number
  interactionId: number
  staffId?: number
  remindAt: string
  readAt?: string
}

export interface FeedbackReply {
  id: number
  senderType: 'STAFF' | 'CUSTOMER'
  message: string
  sentAt: string
  readAt?: string
}

export interface CustomerPortalFeedback {
  id: number
  topic?: string
  issueType?: string
  category?: string
  content: string
  status: FeedbackStatus
  createdAt: string
  closedAt?: string
  replies: FeedbackReply[]
}

export interface CustomerPortalInteraction {
  id: number
  channel: InteractionChannel
  content?: string
  occurredAt: string
  status: InteractionStatus
  outcome?: string
  customerReadAt?: string
}

export interface Customer360 {
  customer: CustomerSummary & { addresses: CustomerAddress[] }
  stats: { orderCount: number; totalSpent: number; avgOrderValue: number; lastOrderAt?: string; favoriteCoffee?: string; ordersPerMonth: number }
  orders: { id: number; orderCode: string; orderedAt: string; totalAmount: number; status: string; channel: string; items?: string }[]
  interactions: Interaction[]
  feedbacks: Feedback[]
  pointHistory: { id: number; pointsChange: number; reason?: string; orderCode?: string; createdAt: string }[]
  timeline: { eventType: string; description: string; eventTime: string }[]
}

export interface CustomerAddress {
  id: number
  label?: string
  recipientName?: string
  recipientPhone?: string
  address: string
  isDefault: boolean
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

export interface GroupMember {
  id: number
  customerId: number
  isManual: boolean
  addedAt?: string
}

export interface CustomerInsights {
  totalCustomers: number
  activeInPeriod: number
  newInPeriod: number
  churnRisk: number
  topSpenders: { id: number; fullName?: string; phone: string; totalSpent: number; orderCount: number }[]
  frequentBuyers: { id: number; fullName?: string; phone: string; totalSpent: number; orderCount: number }[]
  customerValue: { id: number; fullName?: string; phone: string; loyaltyPoints: number; totalSpent: number; orderCount: number; averageOrderValue: number; lastOrderAt?: string; daysSinceLastOrder?: number }[]
  atRisk: { id: number; fullName?: string; phone: string; lastOrderAt?: string; totalSpent: number }[]
  growth: { month: string; newCustomers: number; activeCustomers: number; firstTimeBuyers: number; returningCustomers: number }[]
  salesTrends: { month: string; totalOrders: number; activeCustomers: number; revenue: number }[]
  favoriteCoffees: { name: string; customers: number }[]
  favoriteCategories: { name: string; customers: number }[]
  feedbackSummary: { issueType?: string; category?: string; sentiment?: string; status?: string; feedbackCount: number; customerCount: number }[]
  feedbackTrends: { periodStart: string; totalFeedback: number; complaints: number; suggestions: number; praises: number; negativeFeedback: number; unresolvedFeedback: number; customerCount: number }[]
  repeatedComplaints: { topic: string; complaintCount: number; customerCount: number }[]
}

type CustomerRecord = {
  id: number; fullName?: string; phone: string; email?: string; dateOfBirth?: string; gender?: string; description?: string; loyaltyPoints?: number; registeredAt?: string; groups?: string[]
}
type Page<T> = { content?: T[] }

const toCustomer = (c: CustomerRecord): CustomerSummary => ({
  id: c.id, fullName: c.fullName, phone: c.phone, email: c.email, dateOfBirth: c.dateOfBirth, gender: c.gender, description: c.description,
  loyaltyPoints: c.loyaltyPoints ?? 0, registeredAt: c.registeredAt ?? '',
  groups: c.groups ?? [],
})

const content = <T,>(page: Page<T> | T[]): T[] => Array.isArray(page) ? page : page.content ?? []

const criteriaType = (groupType: string, rule?: Record<string, unknown>): GroupCriteria => {
  if (groupType === 'MANUAL') return 'MANUAL'
  if (rule?.minSpend != null || rule?.maxSpend != null) return 'SPENDING'
  if (rule?.minOrders != null) return 'FREQUENCY'
  if (rule?.inactiveDays != null || rule?.lastOrderDays != null) return 'RECENCY'
  return 'FAVORITE_COFFEE'
}

const toUiRule = (rule: Record<string, unknown> = {}) => ({
  minTotalSpent: rule.minSpend,
  maxTotalSpent: rule.maxSpend,
  minOrdersPerMonth: rule.minOrders,
  inactiveDays: rule.inactiveDays ?? rule.lastOrderDays,
  favoriteCoffeeId: rule.favoriteCoffeeId,
})

const fromUiRule = (type: GroupCriteria | undefined, rule: Record<string, unknown> = {}) => {
  if (!type || type === 'MANUAL') return undefined
  const raw = {
    minSpend: rule.minTotalSpent,
    maxSpend: rule.maxTotalSpent,
    minOrders: rule.minOrdersPerMonth,
    inactiveDays: rule.inactiveDays,
    favoriteCoffeeId: rule.favoriteCoffeeId,
  }
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export const crmApi = {
  customers: async (q?: string) => {
    const r = await crmClient.get<Page<CustomerRecord> | CustomerRecord[]>('/customers', { params: { q, page: 0, size: 100 } })
    return content(r.data).map(toCustomer)
  },
  customer360: async (id: number, fromDate?: string, toDate?: string): Promise<Customer360> => {
    const r = await crmClient.get<any>(`/customers/${id}/360`, { params: { fromDate, toDate } })
    const d = r.data
    const profile = d.profile
    const metrics = d.metrics
    return {
      customer: { ...toCustomer(profile), addresses: profile.addresses ?? [] },
      stats: {
        orderCount: metrics.totalOrders, totalSpent: metrics.totalSpend,
        avgOrderValue: metrics.averageOrderValue, lastOrderAt: metrics.lastOrderAt,
        favoriteCoffee: metrics.favoriteCoffee, ordersPerMonth: metrics.ordersLast30Days,
      },
      orders: (d.recentOrders ?? []).map((o: any, i: number) => ({
        id: i + 1, orderCode: o.orderCode, orderedAt: o.orderedAt,
        totalAmount: o.totalAmount, status: o.status, channel: '—', items: o.items,
      })),
      interactions: d.recentInteractions ?? [],
      feedbacks: d.recentFeedbacks ?? [],
      pointHistory: d.pointHistory ?? [],
      timeline: d.timeline ?? [],
    }
  },
  saveCustomer: (b: { id?: number; fullName?: string; phone: string; email?: string; dateOfBirth?: string; gender?: string; description?: string }) => {
    const body = { fullName: b.fullName, phone: b.phone, email: b.email, dateOfBirth: b.dateOfBirth, gender: b.gender, description: b.description }
    return (b.id ? crmClient.put(`/customers/${b.id}`, body) : crmClient.post('/customers', body)).then((r) => r.data)
  },
  mergeCustomers: (keepId: number, duplicateId: number) =>
    crmClient.post(`/customers/${keepId}/merge`, null, { params: { duplicateId } }).then((r) => r.data),
  saveCustomerAddress: (customerId: number, address: Partial<CustomerAddress>) => {
    const body = { label: address.label, recipientName: address.recipientName, recipientPhone: address.recipientPhone, address: address.address, isDefault: address.isDefault }
    return address.id
      ? crmClient.put(`/customers/${customerId}/addresses/${address.id}`, body).then((r) => r.data)
      : crmClient.post(`/customers/${customerId}/addresses`, body).then((r) => r.data)
  },
  deleteCustomerAddress: (customerId: number, addressId: number) => crmClient.delete(`/customers/${customerId}/addresses/${addressId}`),

  interactions: async (params?: { customerId?: number; status?: InteractionStatus }) => {
    const r = await crmClient.get<Page<Interaction> | Interaction[]>('/interactions', {
      params: { customerId: params?.customerId, page: 0, size: 100 },
    })
    const rows = content(r.data).map((i) => ({ ...i, createdAt: i.createdAt ?? (i as any).occurredAt, customerName: `Khách #${i.customerId}` }))
    return params?.status ? rows.filter((i) => i.status === params.status) : rows
  },
  saveInteraction: (b: Partial<Interaction> & { customerId: number; channel: InteractionChannel }) => {
    const fields = { channel: b.channel, content: b.content, note: b.note, staffId: b.staffId, remindAt: b.remindAt, outcome: b.outcome, status: b.status, visibleToCustomer: b.visibleToCustomer }
    const request = b.id
      ? crmClient.put(`/interactions/${b.id}`, fields)
      : crmClient.post('/interactions', { ...fields, customerId: b.customerId })
    return request.then((r) => r.data)
  },
  closeInteraction: (id: number, outcome?: string) => crmClient.post(`/interactions/${id}/close`, { outcome }).then((r) => r.data),
  dueReminders: async () => {
    const r = await crmClient.get<Page<Interaction> | Interaction[]>('/interactions/reminders', { params: { page: 0, size: 100 } })
    return content(r.data)
  },
  reminderNotifications: async () => {
    const r = await crmClient.get<Page<InteractionReminderNotification> | InteractionReminderNotification[]>('/interactions/reminder-notifications', { params: { unreadOnly: true, page: 0, size: 100 } })
    return content(r.data)
  },
  markReminderRead: (id: number) => crmClient.post(`/interactions/reminder-notifications/${id}/read`).then((r) => r.data),

  feedbacks: async (status?: FeedbackStatus) => {
    const r = await crmClient.get<Page<Feedback> | Feedback[]>('/feedbacks', { params: { page: 0, size: 100 } })
    const rows = content(r.data).map((f) => ({ ...f, customerName: f.customerName ?? `Khách #${f.customerId}` }))
    return status ? rows.filter((f) => f.status === status) : rows
  },
  updateFeedback: (id: number, b: Partial<Pick<Feedback, 'topic' | 'category' | 'issueType' | 'sentiment' | 'status' | 'escalated' | 'resolution' | 'satisfaction' | 'staffId'>>) =>
    crmClient.put(`/feedbacks/${id}`, b).then((r) => r.data),
  closeFeedback: (id: number, resolution?: string, satisfaction?: 'SATISFIED' | 'UNSATISFIED') =>
    crmClient.post(`/feedbacks/${id}/close`, { resolution, satisfaction }).then((r) => r.data),
  escalateFeedback: (id: number, staffId?: number) => crmClient.post(`/feedbacks/${id}/escalate`, null, { params: { staffId } }).then((r) => r.data),
  decideFeedbackEscalation: (id: number, decision: 'APPROVE' | 'REJECT', note?: string) => crmClient.post(`/feedbacks/${id}/approval`, { decision, note }).then((r) => r.data),
  feedbackReplies: (id: number) => crmClient.get<FeedbackReply[]>(`/feedbacks/${id}/responses`).then((r) => r.data),
  replyToFeedback: (id: number, message: string) =>
    crmClient.post<FeedbackReply>(`/feedbacks/${id}/responses`, { message }).then((r) => r.data),
  customerRespondToFeedback: (id: number, message: string) =>
    crmClient.post<FeedbackReply>(`/customer-portal/feedbacks/${id}/responses`, { message }).then((r) => r.data),
  submitFeedback: (b: { fullName?: string; phone: string; topic?: string; content: string }) =>
    crmClient.post('/feedbacks/public', {
      fullName: b.fullName,
      phone: b.phone,
      topic: b.topic,
      content: b.content,
    }).then((r) => r.data),

  customerPortalFeedbacks: async () => {
    const r = await crmClient.get<Page<CustomerPortalFeedback> | CustomerPortalFeedback[]>('/customer-portal/feedbacks', { params: { page: 0, size: 100 } })
    return content(r.data)
  },
  customerPortalInteractions: async () => {
    const r = await crmClient.get<Page<CustomerPortalInteraction> | CustomerPortalInteraction[]>('/customer-portal/interactions', { params: { page: 0, size: 100 } })
    return content(r.data)
  },
  markFeedbackReplyRead: (feedbackId: number, responseId: number) =>
    crmClient.post<{ feedbackId: number; responseId: number; readAt: string }>(
      `/customer-portal/feedbacks/${feedbackId}/responses/${responseId}/read`,
    ).then((r) => r.data),
  markInteractionRead: (interactionId: number) => crmClient.post<{ interactionId: number; readAt: string }>(`/customer-portal/interactions/${interactionId}/read`).then((r) => r.data),

  groups: async (): Promise<CustomerGroup[]> => {
    const r = await crmClient.get<any[]>('/customer-groups')
    return Promise.all(r.data.map(async (g) => {
      const rule = g.criteriaRule ?? undefined
      const members = await crmClient.get<any[]>(`/customer-groups/${g.id}/members`)
      return { ...g, criteriaType: criteriaType(g.groupType, rule), criteriaRule: toUiRule(rule), memberCount: members.data.length }
    }))
  },
  saveGroup: (b: Partial<CustomerGroup> & { name: string }) => {
    const groupType = b.criteriaType === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC'
    const body = { name: b.name, description: b.description, groupType, criteriaRule: fromUiRule(b.criteriaType, b.criteriaRule) }
    return (b.id ? crmClient.put(`/customer-groups/${b.id}`, body) : crmClient.post('/customer-groups', body)).then((r) => r.data)
  },
  deleteGroup: (id: number) => crmClient.delete(`/customer-groups/${id}`),
  groupMembers: async (id: number): Promise<GroupMember[]> => {
    const r = await crmClient.get<any[]>(`/customer-groups/${id}/members`)
    return r.data.map((m) => ({ id: m.id, customerId: m.customerId, isManual: m.isManual, addedAt: m.addedAt }))
  },
  addMember: (id: number, customerId: number) => crmClient.post(`/customer-groups/${id}/members/${customerId}`),
  removeMember: (id: number, customerId: number) => crmClient.delete(`/customer-groups/${id}/members/${customerId}`),
  recalculate: (id: number) => crmClient.post(`/customer-groups/${id}/evaluate`).then((r) => r.data),
  previewGroup: (id: number) => crmClient.post<any[]>(`/customer-groups/${id}/preview`).then((r) => r.data),

  insights: async (fromDate?: string, toDate?: string): Promise<CustomerInsights> => {
    const today = new Date()
    const asDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const start = fromDate ?? asDate(new Date(today.getFullYear(), today.getMonth() - 11, 1))
    const end = toDate ?? asDate(today)
    const [customers, growth, top, frequent, inactiveCount, inactive, affinity, categories, trends, value, feedback, complaints, feedbackTrends] = await Promise.all([
      crmClient.get<Page<CustomerRecord> | CustomerRecord[]>('/customers', { params: { page: 0, size: 1 } }),
      crmClient.get<any[]>('/insights/customer-growth', { params: { fromDate: start, toDate: end } }),
      crmClient.get<any[]>('/insights/top-customers', { params: { fromDate: start, toDate: end, limit: 50, sortBy: 'spend' } }),
      crmClient.get<any[]>('/insights/top-customers', { params: { fromDate: start, toDate: end, limit: 50, sortBy: 'orders' } }),
      crmClient.get<number>('/insights/inactive-customers/count', { params: { inactiveDays: 90 } }),
      crmClient.get<any[]>('/insights/inactive-customers', { params: { inactiveDays: 90, limit: 50 } }),
      crmClient.get<any[]>('/insights/product-affinity', { params: { fromDate: start, toDate: end, dimension: 'coffee', limit: 20 } }),
      crmClient.get<any[]>('/insights/product-affinity', { params: { fromDate: start, toDate: end, dimension: 'category', limit: 20 } }),
      crmClient.get<any[]>('/insights/sales-trends', { params: { fromDate: start, toDate: end, period: 'month' } }),
      crmClient.get<any[]>('/insights/customer-value', { params: { limit: 50 } }),
      crmClient.get<any[]>('/insights/feedback-summary', { params: { fromDate: start, toDate: end } }),
      crmClient.get<any[]>('/insights/repeated-complaints', { params: { fromDate: start, toDate: end } }),
      crmClient.get<any[]>('/insights/feedback-trends', { params: { fromDate: start, toDate: end, period: 'month' } }),
    ])
    const rows = (growth.data ?? []).map((g) => ({ month: g.month, newCustomers: g.newProfiles, activeCustomers: g.activeCustomers, firstTimeBuyers: g.firstTimeBuyers, returningCustomers: g.returningCustomers }))
    const customerPage = customers.data as any
    const asCustomerMetric = (c: any) => ({ id: c.customerId, fullName: c.fullName, phone: c.phone, totalSpent: c.totalSpend, orderCount: c.totalOrders })
    const periodNew = (growth.data ?? []).reduce((sum: number, g: any) => sum + g.newProfiles, 0)
    const periodActive = (growth.data ?? []).reduce((sum: number, g: any) => sum + g.activeCustomers, 0)
    return {
      totalCustomers: customerPage.totalElements ?? content(customers.data).length,
      activeInPeriod: periodActive,
      newInPeriod: periodNew,
      churnRisk: inactiveCount.data,
      topSpenders: top.data.map(asCustomerMetric),
      frequentBuyers: frequent.data.map(asCustomerMetric),
      customerValue: value.data.map((c) => ({ id: c.customerId, fullName: c.fullName, phone: c.phone, loyaltyPoints: c.loyaltyPoints, totalSpent: c.totalSpend, orderCount: c.totalOrders, averageOrderValue: c.averageOrderValue, lastOrderAt: c.lastOrderAt, daysSinceLastOrder: c.daysSinceLastOrder })),
      atRisk: inactive.data.map((c) => ({ id: c.customerId, fullName: c.fullName, phone: c.phone, lastOrderAt: c.lastOrderAt, totalSpent: c.totalSpend })),
      growth: rows,
      salesTrends: trends.data.map((s) => ({ month: s.month, totalOrders: s.totalOrders, activeCustomers: s.activeCustomers, revenue: s.revenue })),
      favoriteCoffees: affinity.data.map((c) => ({ name: c.itemName, customers: c.customerCount })),
      favoriteCategories: categories.data.map((c) => ({ name: c.itemName, customers: c.customerCount })),
      feedbackSummary: feedback.data,
      feedbackTrends: feedbackTrends.data,
      repeatedComplaints: complaints.data,
    }
  },
  compareCustomerPeriods: (customerId: number, firstFrom: string, firstTo: string, secondFrom: string, secondTo: string) =>
    crmClient.get<any>(`/insights/customers/${customerId}/period-comparison`, { params: { firstFrom, firstTo, secondFrom, secondTo } }).then((r) => r.data),
  compareGroups: (groupIds: number[], fromDate?: string, toDate?: string) => crmClient.get<any[]>('/insights/groups/compare', { params: { groupIds, fromDate, toDate } }).then((r) => r.data),
  exportInsightsCsv: (data: CustomerInsights, comparison: any[] = []) => {
    const csv = (rows: unknown[][]) => rows.map((row) => row.map((cell) => {
      let value = cell == null ? '' : String(cell)
      if (/^[=+@\t\r-]/.test(value)) value = `'${value}`
      return `"${value.replaceAll('"', '""')}"`
    }).join(',')).join('\r\n')
    const sections: unknown[][] = [
      ['Tăng trưởng khách hàng theo tháng'], ['Tháng', 'Hồ sơ mới', 'Khách mua', 'Mua lần đầu', 'Mua quay lại'],
      ...data.growth.map((r) => [r.month, r.newCustomers, r.activeCustomers, r.firstTimeBuyers, r.returningCustomers]), [],
      ['Xu hướng doanh thu'], ['Tháng', 'Doanh thu', 'Số đơn', 'Khách mua'],
      ...data.salesTrends.map((r) => [r.month, r.revenue, r.totalOrders, r.activeCustomers]), [],
      ['Khách chi tiêu cao'], ['ID', 'Khách hàng', 'Số điện thoại', 'Số đơn', 'Tổng chi tiêu'],
      ...data.topSpenders.map((r) => [r.id, r.fullName, r.phone, r.orderCount, r.totalSpent]), [],
      ['Khách mua thường xuyên'], ['ID', 'Khách hàng', 'Số điện thoại', 'Số đơn', 'Tổng chi tiêu'],
      ...data.frequentBuyers.map((r) => [r.id, r.fullName, r.phone, r.orderCount, r.totalSpent]), [],
      ['Khách không mua trong ít nhất 90 ngày hoặc chưa từng mua'], ['ID', 'Khách hàng', 'Số điện thoại', 'Mua gần nhất', 'Tổng chi tiêu'],
      ...data.atRisk.map((r) => [r.id, r.fullName, r.phone, r.lastOrderAt, r.totalSpent]), [],
      ['Giá trị khách hàng (toàn thời gian)'], ['ID', 'Khách hàng', 'Số điện thoại', 'Chi tiêu', 'Số đơn', 'TB đơn', 'Điểm', 'Mua gần nhất'],
      ...data.customerValue.map((r) => [r.id, r.fullName, r.phone, r.totalSpent, r.orderCount, r.averageOrderValue, r.loyaltyPoints, r.lastOrderAt]), [],
      ['Cà phê yêu thích'], ['Tên', 'Số khách'], ...data.favoriteCoffees.map((r) => [r.name, r.customers]), [],
      ['Danh mục yêu thích'], ['Tên', 'Số khách'], ...data.favoriteCategories.map((r) => [r.name, r.customers]), [],
      ['Tổng hợp phản hồi'], ['Loại vấn đề', 'Phân loại', 'Cảm xúc', 'Trạng thái', 'Số phản hồi', 'Số khách'],
      ...data.feedbackSummary.map((r) => [crmFeedbackLabel('issueType', r.issueType), crmFeedbackLabel('category', r.category), crmFeedbackLabel('sentiment', r.sentiment), crmFeedbackLabel('status', r.status), r.feedbackCount, r.customerCount]), [],
      ['Xu hướng phản hồi theo tháng'], ['Tháng', 'Tổng phản hồi', 'Khiếu nại', 'Góp ý', 'Khen ngợi', 'Tiêu cực', 'Chưa xử lý', 'Số khách'],
      ...data.feedbackTrends.map((r) => [r.periodStart, r.totalFeedback, r.complaints, r.suggestions, r.praises, r.negativeFeedback, r.unresolvedFeedback, r.customerCount]), [],
      ['Khiếu nại lặp lại'], ['Chủ đề', 'Số khiếu nại', 'Số khách'],
      ...data.repeatedComplaints.map((r) => [r.topic, r.complaintCount, r.customerCount]), [],
      ['So sánh nhóm'], ['ID nhóm', 'Tên nhóm', 'Thành viên', 'Chi tiêu', 'Số đơn', 'TB đơn', 'Danh mục yêu thích', 'Cà phê yêu thích', 'Tương tác', 'Phản hồi'],
      ...comparison.map((r) => [r.groupId, r.groupName, r.memberCount, r.totalSpend, r.totalOrders, r.averageOrderValue, r.favoriteCategory, r.favoriteCoffee, r.interactionCount, r.feedbackCount]),
    ]
    const blob = new Blob(['\uFEFF', csv(sections)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bao-cao-phan-tich-khach-hang.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}
