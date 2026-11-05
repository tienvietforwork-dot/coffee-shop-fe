import apiClient from './client'
const base = '/stats/cross-sell'
export interface CrossSellItem { coffeeId: number; coffeeName?: string; position: number; price?: number }
export interface CrossSellRule {
  id: number; anchor_coffee_id: number; anchor_name: string; priority: number; min_cart_amount: number
  starts_at?: string | null; ends_at?: string | null; status: 'DRAFT'|'ACTIVE'|'PAUSED'
  items: CrossSellItem[]; impressions: number; clicks: number
}
export interface CrossSellPayload {
  anchorCoffeeId: number; priority: number; minCartAmount: number
  startsAt?: string|null; endsAt?: string|null; items: {coffeeId:number;position:number}[]
}
export interface CrossSellSuggestion {
  ruleId: number; coffeeId: number; coffeeName: string; price: number; description?: string
  imageUrl?: string; imageId?: number
}
export const crossSellApi = {
  rules: async () => (await apiClient.get<CrossSellRule[]>(`${base}/rules`)).data,
  create: async (payload: CrossSellPayload) => (await apiClient.post(`${base}/rules`,payload)).data,
  update: async (id: number,payload: CrossSellPayload) => (await apiClient.put(`${base}/rules/${id}`,payload)).data,
  activate: async (id: number) => (await apiClient.post(`${base}/rules/${id}/activate`)).data,
  pause: async (id: number) => (await apiClient.post(`${base}/rules/${id}/pause`)).data,
  remove: async (id: number) => (await apiClient.delete(`${base}/rules/${id}`)).data,
  preview: async (id: number) => (await apiClient.get<CrossSellSuggestion[]>(`${base}/rules/${id}/preview`)).data,
  analytics: async (id: number) => (await apiClient.get(`${base}/rules/${id}/analytics`)).data,
  recommendations: async (anchorCoffeeId:number,cartTotal=0) => (await apiClient.get<CrossSellSuggestion[]>('/stats/public/merchandising/cross-sell',{params:{anchorCoffeeId,cartTotal}})).data,
  event: async (ruleId:number,coffeeId:number,impressionId:string,eventType:'IMPRESSION'|'CLICK') => apiClient.post('/stats/public/merchandising/cross-sell/events',{ruleId,coffeeId,impressionId,eventType}),
}
