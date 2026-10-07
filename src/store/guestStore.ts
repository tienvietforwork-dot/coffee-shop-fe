import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GuestState {
  /** Server-side cart session (carts.session_code). */
  cartCode: string | null
  /** Table QR the guest scanned, if ordering at a table. */
  tableQr: string | null
  tableNo: string | null
  /** Orders placed from this browser, newest first – for "Đơn của tôi". */
  orders: { code: string; at: string }[]
  /** Voucher picked in the cart, carried to checkout. */
  voucherCode: string | null
  /** Last contact details, pre-filled at checkout. */
  name: string
  phone: string
  setCart: (code: string | null) => void
  setTable: (qr: string | null, no: string | null) => void
  addOrder: (code: string) => void
  setContact: (name: string, phone: string) => void
  setVoucher: (code: string | null) => void
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set) => ({
      cartCode: null,
      tableQr: null,
      tableNo: null,
      orders: [],
      voucherCode: null,
      name: '',
      phone: '',
      setCart: (cartCode) => set({ cartCode }),
      setTable: (tableQr, tableNo) => set({ tableQr, tableNo }),
      addOrder: (code) =>
        set((s) => ({ orders: [{ code, at: new Date().toISOString() }, ...s.orders.filter((o) => o.code !== code)].slice(0, 20) })),
      setContact: (name, phone) => set({ name, phone }),
      setVoucher: (voucherCode) => set({ voucherCode }),
    }),
    { name: 'coffeeholic-guest' },
  ),
)
