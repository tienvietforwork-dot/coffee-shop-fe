import type { PriceQuote } from '@/api/types'

/**
 * Per-coffee promotions (đợt giảm giá theo món) are already baked into each line's unitPrice, so the quote's
 * subtotal is the discounted one. To make the bill read "giá gốc − giảm giá món − giảm hóa đơn − voucher",
 * this sums what the item promotions took off (listPrice − unitPrice) and names the campaigns that did it.
 * Combo component lines are priced at the combo price but carry no promotionName — they are not counted here.
 */
export function itemPromo(lines?: PriceQuote['lines']) {
  let discount = 0
  const names = new Set<string>()
  for (const l of lines ?? []) {
    const off = (l.listPrice - l.unitPrice) * l.quantity
    if (off > 0 && l.promotionName) {
      discount += off
      names.add(l.promotionName)
    }
  }
  return { discount, label: names.size ? `Giảm giá món · ${[...names].join(', ')}` : 'Giảm giá món' }
}
