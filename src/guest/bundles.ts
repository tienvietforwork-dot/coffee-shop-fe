import type { Bundle } from '@/api/merchandising'

const itemAvailable = (item: Bundle['items'][number]) => item.coffee.status === 'AVAILABLE' && !item.coffee.autoSoldOut

/** A combo the guest can buy right now: 2–5 different drinks, no optional / choice parts, every part in stock. */
export function bundleAvailable(bundle: Bundle) {
  return bundle.items.length >= 2
    && bundle.items.length <= 5
    && new Set(bundle.items.map((item) => item.coffee.id)).size === bundle.items.length
    && bundle.items.every((item) => !item.optional && !item.choiceGroup
      && item.coffee.categoryType === 'DRINK' && itemAvailable(item))
}

/** Combos shown to guests: active, running now and buyable. */
export const sellableBundles = (bundles?: Bundle[]) =>
  (bundles ?? []).filter((b) => b.availableNow && b.status === 'ACTIVE' && bundleAvailable(b))
