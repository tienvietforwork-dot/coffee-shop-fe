import { Drawer, Empty } from 'antd'
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { VoucherPicker } from './VoucherPicker'
import { estimateDiscounts, useVoucherOptions } from './voucherOptions'
import { useDebounced } from '@/lib/useDebounced'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'
import { imageSrc, money } from '@/lib/format'
import { useGuestStore } from '@/store/guestStore'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, lines, update, remove } = useCart()
  const addable = useAddableCups(lines)
  const { tableNo, tableQr, voucherCode, setVoucher } = useGuestStore()
  const navigate = useNavigate()
  const items = cart?.items ?? []
  const unavailable = items.some((i) => !i.available)
  // Running total while shopping (no shipping — that depends on the order type chosen at checkout).
  // Instant: estimated here from the menu's promotions and the known voucher; the server quote is only asked once
  // the cart stops changing (a burst of +/− taps = one request) and its exact numbers then replace the estimate.
  const subtotal = cart?.subtotal ?? 0
  const settledSubtotal = useDebounced(subtotal, 350)
  const orderType = tableQr ? 'DINE_IN' : 'TAKE_AWAY'
  const quote = useQuery({
    queryKey: ['quote', cart?.sessionCode, settledSubtotal, orderType, voucherCode ?? undefined, null],
    enabled: open && !!cart && items.length > 0 && settledSubtotal === subtotal,
    queryFn: () => publicApi.quote(cart!.sessionCode, { orderType, voucherCode: voucherCode ?? undefined }),
    placeholderData: keepPreviousData,
  })
  const { vouchers, promotions } = useVoucherOptions()
  const exact = quote.data && quote.data.subtotal === subtotal && (quote.data.voucherCode ?? null) === (quote.data.voucherMessage ? null : voucherCode)
    ? quote.data : undefined
  const est = estimateDiscounts(subtotal, promotions, vouchers, voucherCode ?? undefined)
  const shown = exact
    ? { promoName: exact.promotionName, promo: exact.promotionDiscount, voucher: exact.voucherDiscount, total: exact.total }
    : (() => {
      const voucher = est.voucherDiscount ?? quote.data?.voucherDiscount ?? 0
      const promo = est.promotion?.discount ?? 0
      return { promoName: est.promotion?.name, promo, voucher, total: Math.max(0, subtotal - promo - voucher) }
    })()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={<span className="g-drawer-title">Giỏ hàng {tableNo && <small>· Bàn {tableNo}</small>}</span>}
      width={420}
      className="g-drawer"
      footer={
        items.length > 0 && (
          <div className="g-drawer-foot">
            <VoucherPicker subtotal={subtotal} applied={voucherCode ?? undefined} promotionName={shown.promoName}
              voucherDiscount={shown.voucher} onApply={(code) => setVoucher(code ?? null)} />
            {exact?.voucherMessage && <div className="g-warn-text">{exact.voucherMessage}</div>}
            <div className={`g-cart-totals ${exact ? '' : 'is-busy'}`}>
              <div className="g-row"><span>Tạm tính</span><span>{money(subtotal)}</span></div>
              {!!shown.promo && <div className="g-row g-green"><span>{shown.promoName}</span><span>-{money(shown.promo)}</span></div>}
              {!!shown.voucher && <div className="g-row g-green"><span>Voucher {voucherCode}</span><span>-{money(shown.voucher)}</span></div>}
              <div className="g-row g-total"><span>Sau giảm</span><strong>{money(shown.total)}</strong></div>
            </div>
            <button
              className="g-cta g-cta-block"
              disabled={unavailable}
              onClick={() => { onClose(); navigate('/checkout') }}
            >
              {unavailable ? 'Có món đã hết, vui lòng bỏ ra' : 'Đặt hàng'}
            </button>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Giỏ hàng đang trống" />
      ) : (
        <ul className="g-cart-list">
          {items.map((i) => (
            <li key={i.id} className={i.available ? '' : 'is-out'}>
              {i.imageUrl && <img src={imageSrc(i.imageUrl)} alt="" />}
              <div className="g-cart-info">
                <strong>{i.coffeeName}</strong>
                {!i.available && <span className="g-out-text">Món này vừa hết</span>}
                <div className="g-cart-row">
                  <div className="g-stepper g-stepper-sm">
                    <button
                      onClick={() => (i.quantity > 1 ? update.mutate({ itemId: i.id, quantity: i.quantity - 1 }) : remove.mutate(i.id))}
                      aria-label="Giảm"
                    >
                      <MinusOutlined />
                    </button>
                    <span>{i.quantity}</span>
                    <button onClick={() => update.mutate({ itemId: i.id, quantity: i.quantity + 1 })} disabled={addable(i.coffeeId) < 1} aria-label="Tăng">
                      <PlusOutlined />
                    </button>
                  </div>
                  <span className="g-cart-price">{money(i.subtotal)}</span>
                </div>
              </div>
              <button className="g-icon-btn" onClick={() => remove.mutate(i.id)} aria-label="Xóa">
                <DeleteOutlined />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
