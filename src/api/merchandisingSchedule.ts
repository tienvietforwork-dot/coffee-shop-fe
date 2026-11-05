import apiClient from './client'
export type ScheduleSlot = 'MORNING' | 'AFTERNOON' | 'WEEKEND' | 'SEASONAL' | 'CUSTOM'
export type ScheduleSection = 'HOME' | 'FEATURED' | 'BEST_SELLER' | 'NEW_ARRIVAL' | 'RECOMMENDED'
export interface ScheduleRow { id: number; name: string; coffeeId: number; coffeeName: string; price: number; imageUrl?: string | null; section: ScheduleSection; slot: ScheduleSlot; priority: number; startsAt: string; endsAt: string; weekdays: number[]; months: number[]; status: 'DRAFT' | 'PUBLISHED'; visibleNow: boolean }
export type SchedulePayload = { name: string; coffeeId: number; section: ScheduleSection; slot: ScheduleSlot; priority: number; startsAt: string; endsAt: string; weekdays: number[]; months: number[] }
const root = '/stats/merchandising-schedules'
export const merchandisingScheduleApi = {
    list: async () => (await apiClient.get<ScheduleRow[]>(root)).data,
    create: async (x: SchedulePayload) => (await apiClient.post<ScheduleRow>(root, x)).data,
    update: async (id: number, x: SchedulePayload) => (await apiClient.put<ScheduleRow>(`${root}/${id}`, x)).data,
    publish: async (id: number) => (await apiClient.post<ScheduleRow>(`${root}/${id}/publish`)).data,
    unpublish: async (id: number) => (await apiClient.post<ScheduleRow>(`${root}/${id}/unpublish`)).data,
    remove: async (id: number) => (await apiClient.delete(`${root}/${id}`)).data,
    preview: async (id: number) => (await apiClient.get<ScheduleRow[]>(`${root}/${id}/preview`)).data,
    publicNow: async () => (await apiClient.get<ScheduleRow[]>('/stats/public/merchandising/schedules')).data,
}
