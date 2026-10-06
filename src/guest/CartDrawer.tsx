import { Drawer, Empty } from 'antd'
import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCart } from './useCart'
import { money } from '@/lib/format'
import { useGuestStore } from '@/store/guestStore'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, update, remove } = useCart()
  const tableNo = useGuestStore((s) => s.tableNo)
  const navigate = useNavigate()
  const items = cart?.items ?? []
  const unavailable = items.some((i) => !i.available)

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
            <div className="g-row"><span>Tạm tính</span><strong>{money(cart?.subtotal)}</strong></div>
            <p className="g-muted small">Giảm giá & voucher được áp dụng ở bước đặt hàng.</p>
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
              {i.imageUrl && <img src={i.imageUrl} alt="" />}
              <div className="g-cart-info">
                <strong>{i.coffeeName}</strong>
                {i.note && <span className="g-muted small">{i.note}</span>}
                {!i.available && <span className="g-out-text">Món này vừa hết</span>}
                <div className="g-cart-row">
                  <div className="g-stepper g-stepper-sm">
                    <button
                      onClick={() => (i.quantity > 1 ? update.mutate({ itemId: i.id, quantity: i.quantity - 1, note: i.note }) : remove.mutate(i.id))}
                      aria-label="Giảm"
                    >
                      <MinusOutlined />
                    </button>
                    <span>{i.quantity}</span>
                    <button onClick={() => update.mutate({ itemId: i.id, quantity: i.quantity + 1, note: i.note })} aria-label="Tăng">
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
