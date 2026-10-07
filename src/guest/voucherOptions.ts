import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { accountApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

/** A voucher the guest can pick (one per order). */
export interface VoucherOption { code: string; discountValue: number; minOrderValue: number; expiresAt?: string }
/** An order promotion: applied by the shop automatically when the order qualifies. */
export interface PromotionOption { id: number; name: string; description?: string; discountPercent?: number; minOrderAmount?: number; endDate: string }

/**
 * Where the picker's lists come from. app-promotions can swap this for its own endpoint;
 * for now: the logged-in customer's unused vouchers and the order promotions on the public menu.
 */
export function useVoucherOptions() {
  const isCustomer = !!useAuthStore((s) => s.user?.customerId)
  const mine = useQuery({ queryKey: ['account-vouchers'], queryFn: accountApi.vouchers, enabled: isCustomer })
  const menu = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const now = Date.now()
  const vouchers: VoucherOption[] = (mine.data ?? [])
    .filter((v) => v.status === 'ISSUED' && (!v.expiresAt || new Date(v.expiresAt).getTime() > now))
  const promotions: PromotionOption[] = menu.data?.orderPromotions ?? []
  return { vouchers, promotions, loading: mine.isLoading }
}

/**
 * Instant estimate of the discounts, the same way app-core prices an order: the best order promotion the subtotal
 * reaches (percent, rounded to whole đồng), then the voucher on what is left. Shown while the server quote is on its
 * way; the quote's own numbers replace it. Unknown voucher (typed code) → voucher part left undefined.
 */
export function estimateDiscounts(subtotal: number, promotions: PromotionOption[], vouchers: VoucherOption[], code?: string) {
  let promotion: { name: string; discount: number } | undefined
  for (const p of promotions) {
    if (!p.discountPercent || (p.minOrderAmount ?? 0) > subtotal) continue
    const discount = Math.round((subtotal * p.discountPercent) / 100)
    if (!promotion || discount > promotion.discount) promotion = { name: p.name, discount }
  }
  const afterPromotion = subtotal - (promotion?.discount ?? 0)
  const v = code ? vouchers.find((x) => x.code === code) : undefined
  const voucherDiscount = v && v.minOrderValue <= subtotal ? Math.min(v.discountValue, afterPromotion) : code ? undefined : 0
  return { promotion, voucherDiscount }
}
