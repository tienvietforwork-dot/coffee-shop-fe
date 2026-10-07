import { useMemo } from 'react'
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import { useGuestStore } from '@/store/guestStore'
import type { Cart } from '@/api/types'

type AddVars = { coffeeId: number; quantity: number }
const ADD_KEY = ['cart-add']
let creating: Promise<string> | null = null
let overlapped = false

/**
 * Server-backed guest cart. The cart is created lazily on the first "add".
 * Feels instant: adds still on their way to the server already count (badge, stock caps),
 * and +/−/remove change the cached cart first and roll back if the server refuses.
 */
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
    const code = useGuestStore.getState().cartCode
    if (code && qc.getQueryData(['cart', code])) return code
    // quick taps before the first cart exists must share one cart, not create one each
    creating ??= publicApi.createCart(tableQr ?? undefined).then((cart) => {
      setCart(cart.sessionCode)
      setData(cart)
      return cart.sessionCode
    }).finally(() => { creating = null })
    return creating
  }

  // callbacks live on the mutation itself, so they still run after the add-to-cart popup has closed
  const add = useMutation({
    mutationKey: ADD_KEY,
    mutationFn: async (v: AddVars) => publicApi.addItem(await ensureCart(), v),
    onMutate: () => { if (qc.isMutating({ mutationKey: ADD_KEY }) > 1) overlapped = true },
    onError: (e) => message.error(errorMessage(e)),
    // overlapping adds can answer out of order: only the last one to finish updates the cart,
    // and if they overlapped it re-reads the cart instead of trusting its own (maybe older) answer
    onSettled: (cart) => {
      if (qc.isMutating({ mutationKey: ADD_KEY }) > 1) return
      if (overlapped) {
        overlapped = false
        return qc.invalidateQueries({ queryKey: ['cart'] }) // awaited: the badge keeps counting until the cart is re-read
      } else if (cart) setData(cart)
    },
  })
  const pending = useMutationState<AddVars>({
    filters: { mutationKey: ADD_KEY, status: 'pending' },
    select: (m) => m.state.variables as AddVars,
  })

  /** Change the cached cart right away; give back the previous one for rollback. */
  const patchCart = (fn: (c: Cart) => Cart) => {
    const prev = qc.getQueryData<Cart | null>(['cart', cartCode])
    if (prev) qc.setQueryData(['cart', cartCode], fn(prev))
    return { prev }
  }
  const rollback = (e: unknown, _v: unknown, ctx?: { prev?: Cart | null }) => {
    if (ctx?.prev) qc.setQueryData(['cart', cartCode], ctx.prev)
    message.error(errorMessage(e))
  }
  const withItems = (c: Cart, items: Cart['items']) =>
    ({ ...c, items, subtotal: items.reduce((s, i) => s + i.subtotal, 0) })

  const update = useMutation({
    mutationFn: (v: { itemId: number; quantity: number }) =>
      publicApi.updateItem(cartCode!, v.itemId, { quantity: v.quantity }),
    onMutate: (v) => patchCart((c) => withItems(c, c.items.map((i) =>
      i.id === v.itemId ? { ...i, quantity: v.quantity, subtotal: i.unitPrice * v.quantity } : i))),
    onSuccess: setData,
    onError: rollback,
  })
  const remove = useMutation({
    mutationFn: (itemId: number) => publicApi.removeItem(cartCode!, itemId),
    onMutate: (itemId) => patchCart((c) => withItems(c, c.items.filter((i) => i.id !== itemId))),
    onSuccess: setData,
    onError: rollback,
  })

  const cart = cartCode ? query.data ?? null : null
  const lines = useMemo(() => [
    ...(cart?.items.map((i) => ({ coffeeId: i.coffeeId, quantity: i.quantity })) ?? []),
    ...pending.filter(Boolean),
  ], [cart, pending])
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  return { cart, count, lines, loading: query.isLoading, add, update, remove }
}
