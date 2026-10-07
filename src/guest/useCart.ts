import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import { useGuestStore } from '@/store/guestStore'
import type { Cart } from '@/api/types'

/** Server-backed guest cart. The cart is created lazily on the first "add". */
export function useCart() {
  const { cartCode, tableQr, setCart } = useGuestStore()
  const qc = useQueryClient()
  const { message } = App.useApp()

  const query = useQuery({
    queryKey: ['cart', cartCode],
    enabled: !!cartCode,
    queryFn: async () => {
      try {
        const cart = await publicApi.cart(cartCode!)
        if (cart.status !== 'OPEN') {
          setCart(null)
          return null
        }
        return cart
      } catch {
        setCart(null)
        return null
      }
    },
  })

  const setData = (cart: Cart) => qc.setQueryData(['cart', cart.sessionCode], cart)

  const ensureCart = async () => {
    if (cartCode && query.data) return cartCode
    const cart = await publicApi.createCart(tableQr ?? undefined)
    setCart(cart.sessionCode)
    setData(cart)
    return cart.sessionCode
  }

  const add = useMutation({
    mutationFn: async (v: { coffeeId: number; quantity: number; note?: string }) =>
      publicApi.addItem(await ensureCart(), v),
    onSuccess: (cart) => setData(cart),
    onError: (e) => message.error(errorMessage(e)),
  })
  const update = useMutation({
    mutationFn: (v: { itemId: number; quantity: number; note?: string }) =>
      publicApi.updateItem(cartCode!, v.itemId, { quantity: v.quantity, note: v.note }),
    onSuccess: setData,
    onError: (e) => message.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (itemId: number) => publicApi.removeItem(cartCode!, itemId),
    onSuccess: setData,
    onError: (e) => message.error(errorMessage(e)),
  })

  const cart = cartCode ? query.data ?? null : null
  const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
  const lines = useMemo(() => cart?.items.map((i) => ({ coffeeId: i.coffeeId, quantity: i.quantity })) ?? [], [cart])
  return { cart, count, lines, loading: query.isLoading, add, update, remove }
}
