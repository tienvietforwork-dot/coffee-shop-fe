import { money } from './format'

/** vouchers.discount_type from app-promotions; missing on older rows = FIXED_AMOUNT. */
export type VoucherDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export interface VoucherValue { discountValue: number; discountType?: VoucherDiscountType | null }

export const isPercentVoucher = (v: VoucherValue) => v.discountType === 'PERCENTAGE'

/** Badge text: "-19%" or "-20.000đ". */
export const voucherLabel = (v: VoucherValue) => (isPercentVoucher(v) ? `-${v.discountValue}%` : `-${money(v.discountValue)}`)

/** What the voucher takes off `amount`, the same way app-core does: percent rounded to whole đồng, never above the amount. */
export function voucherOff(v: VoucherValue, amount: number) {
  if (amount <= 0) return 0
  const off = isPercentVoucher(v) ? Math.round((amount * v.discountValue) / 100) : v.discountValue
  return Math.min(off, amount)
}
