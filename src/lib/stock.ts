import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import type { Menu } from '@/api/types'

export interface CartLine { coffeeId: number; quantity: number }

/**
 * Cups of each coffee that can still be added on top of `cart`:
 *   addable = min over the recipe's materials of floor((stock − used by cart) / per cup)
 * Pure arithmetic on the menu snapshot — no request per click. Infinity = not limited by stock.
 */
export function addableCups(menu: Menu | undefined, cart: CartLine[]): (coffeeId: number) => number {
  const perCup = new Map<number, Record<string, number>>()
  menu?.categories.forEach((c) => c.coffees.forEach((k) => perCup.set(k.id, k.perCup ?? {})))
  const left: Record<string, number> = { ...menu?.stock }
  for (const line of cart) {
    for (const [m, q] of Object.entries(perCup.get(line.coffeeId) ?? {})) left[m] = (left[m] ?? 0) - q * line.quantity
  }
  return (coffeeId) => {
    const needs = Object.entries(perCup.get(coffeeId) ?? {})
    if (!needs.length) return Infinity
    // epsilon: stock and quantities are decimals (e.g. 0.5 quả cam)
    return Math.max(0, Math.min(...needs.map(([m, q]) => Math.floor(((left[m] ?? 0) + 1e-9) / q))))
  }
}

/** addableCups over the shared ['menu'] query, refreshed every minute so stock changes show up. */
export function useAddableCups(cart: CartLine[]) {
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu, refetchInterval: 60_000 })
  return useMemo(() => addableCups(menu, cart), [menu, cart])
}
