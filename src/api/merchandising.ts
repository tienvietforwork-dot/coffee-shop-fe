import apiClient from './client'

// Gateway rewrites /api/stats/* into /api/* of app-stats.
const root = '/stats'
const adminBundles = `${root}/product-bundles`
const adminPlacements = `${root}/product-placement`
const publicRoot = `${root}/public/merchandising`

export type PlacementSection = 'FEATURED' | 'BEST_SELLER' | 'NEW_ARRIVAL' | 'RECOMMENDED' | 'HOME'
export type PublicationStatus = 'DRAFT' | 'PUBLISHED'
export type BundleStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED'
export interface MerchCoffee {
  id: number; name: string; categoryId: number; categoryName: string
  imageUrl?: string | null; price: number; description?: string | null; status: string; autoSoldOut: boolean
}
export interface Placement {
  id: number; section: PlacementSection; title?: string | null; displayOrder: number
  startsAt?: string | null; endsAt?: string | null; active: boolean
  publicationStatus: PublicationStatus; visibleNow: boolean; coffee: MerchCoffee
}
export interface CategoryPriority { id: number; name: string; description?: string | null; displayOrder: number }
export interface PlacementSuggestion { section: PlacementSection; coffee: MerchCoffee; completedUnitsLast30Days: number; reason: string }
export interface PlacementOverview { sections: Partial<Record<PlacementSection, Placement[]>>; categories: CategoryPriority[]; coffees: MerchCoffee[] }
export interface PlacementPayload {
  coffeeId: number; section: PlacementSection; title?: string
  displayOrder?: number; startsAt?: string | null; endsAt?: string | null
  active?: boolean; publicationStatus?: PublicationStatus
}
export interface BundleItem {
  id: number; quantity: number; optional: boolean; displayOrder: number
  linePrice: number; coffee: MerchCoffee
}
export interface Bundle {
  id: number; name: string; description?: string | null; bundlePrice: number
  standalonePrice: number; savingAmount: number; startsAt?: string | null; endsAt?: string | null
  status: BundleStatus; availableNow: boolean; items: BundleItem[]
}
export interface BundleAnalytics {
  bundleId: number; bundleName: string; from?: string; to?: string
  estimatedSoldQuantity: number; estimatedRevenue: number
  standalonePrice: number; bundlePrice: number; estimatedSavingGiven: number
  components: { coffeeId: number; coffeeName: string; requiredQuantity: number; optional: boolean; soldQuantity: number; revenue: number }[]
}
export interface BundleItemPayload { coffeeId: number; quantity: number; optional?: boolean; displayOrder?: number }
export interface BundlePayload {
  name: string; description?: string; bundlePrice: number; startsAt?: string | null
  endsAt?: string | null; status?: BundleStatus; items?: BundleItemPayload[]
}
const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)
export const merchandisingApi = {
  bundles: () => data(apiClient.get<Bundle[]>(adminBundles)),
  bundleAnalytics: (id: number) => data(apiClient.get<BundleAnalytics>(`${adminBundles}/${id}/analytics`)),
  createBundle: (p: BundlePayload) => data(apiClient.post<Bundle>(adminBundles, p)),
  updateBundle: (id: number, p: BundlePayload) => data(apiClient.put<Bundle>(`${adminBundles}/${id}`, p)),
  deleteBundle: (id: number) => data(apiClient.delete(`${adminBundles}/${id}`)),
  activateBundle: (id: number) => data(apiClient.post<Bundle>(`${adminBundles}/${id}/activate`)),
  pauseBundle: (id: number) => data(apiClient.post<Bundle>(`${adminBundles}/${id}/pause`)),
  addBundleItem: (id: number, p: BundleItemPayload) => data(apiClient.post<Bundle>(`${adminBundles}/${id}/items`, p)),
  updateBundleItem: (id: number, itemId: number, p: BundleItemPayload) => data(apiClient.put<Bundle>(`${adminBundles}/${id}/items/${itemId}`, p)),
  deleteBundleItem: (id: number, itemId: number) => data(apiClient.delete<Bundle>(`${adminBundles}/${id}/items/${itemId}`)),
  placementSuggestions: (section: PlacementSection) => data(apiClient.get<PlacementSuggestion[]>(`${adminPlacements}/suggestions`, { params: { section, limit: 8 } })),
  placementOverview: () => data(apiClient.get<PlacementOverview>(`${adminPlacements}/overview`)),
  updateCoffeeVisibility: (id: number, status: string) => data(apiClient.patch(`${adminPlacements}/coffees/${id}/visibility`, { status })),
  updateCategoryPriority: (id: number, displayOrder: number) => data(apiClient.patch(`${adminPlacements}/categories/${id}/priority`, { displayOrder })),
  placements: () => data(apiClient.get<Placement[]>(`${adminPlacements}/rules`)),
  createPlacement: (p: PlacementPayload) => data(apiClient.post<Placement>(`${adminPlacements}/rules`, p)),
  updatePlacement: (id: number, p: PlacementPayload) => data(apiClient.put<Placement>(`${adminPlacements}/rules/${id}`, p)),
  unpublishPlacement: (id: number) => data(apiClient.post<Placement>(`${adminPlacements}/rules/${id}/unpublish`)),
  publishPlacement: (id: number) => data(apiClient.post<Placement>(`${adminPlacements}/rules/${id}/publish`)),
  deletePlacement: (id: number) => data(apiClient.delete(`${adminPlacements}/rules/${id}`)),
  publicBundles: () => data(apiClient.get<Bundle[]>(`${publicRoot}/bundles`)),
  publicPlacements: () => data(apiClient.get<Placement[]>(`${publicRoot}/placements`)),
}

export const sectionLabels: Record<PlacementSection, string> = {
  FEATURED: 'Sản phẩm nổi bật', BEST_SELLER: 'Bán chạy', NEW_ARRIVAL: 'Sản phẩm mới',
  RECOMMENDED: 'Đề xuất', HOME: 'Trang chủ',
}
