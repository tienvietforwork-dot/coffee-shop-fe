import { useEffect, useState } from 'react'
import { Modal } from 'antd'
import { MinusOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import type { Bundle } from '@/api/merchandising'
import { DEFAULT_IMAGE, imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { bundleAvailable } from './bundles'

const cover = (b: Bundle) => imageSrc(b.imageUrl || b.items.find((i) => i.coffee.imageUrl)?.coffee.imageUrl) || DEFAULT_IMAGE

/** Combo card in the same look as a coffee card. */
export function BundleCard({ bundle: b, onOpen }: { bundle: Bundle; onOpen: () => void }) {
  const discount = b.standalonePrice > 0 ? Math.round(Math.max(0, b.savingAmount) / b.standalonePrice * 100) : 0
  return (
    <article className="g-card merch-bundle" tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }} onClick={onOpen}>
      <div className="g-card-img"><img src={cover(b)} alt={b.name} loading="lazy" /><span className="merch-bundle-label">COMBO</span></div>
      <div className="g-card-body">
        <h3>{b.name}</h3>
        <p>{b.description || b.items.map((i) => `${i.quantity}× ${i.coffee.name}`).join(' · ')}</p>
        <div className="g-card-foot">
          <div className="g-price">
            <span className="g-price-old">Giá lẻ {money(b.standalonePrice)}</span>
            <span className="g-price-now">{money(b.bundlePrice)}</span>
            {b.savingAmount > 0 && <span className="merch-saving">Tiết kiệm {money(b.savingAmount)} · {discount}%</span>}
          </div>
          <button type="button" className="g-add" aria-label={`Xem combo ${b.name}`} onClick={(e) => { e.stopPropagation(); onOpen() }}><PlusOutlined /></button>
        </div>
      </div>
    </article>
  )
}

/** Combo detail: its drinks, list vs combo price, quantity and "Thêm combo". */
export function BundleModal({ bundle, onClose }: { bundle: Bundle | null; onClose: () => void }) {
  const [quantity, setQuantity] = useState(1)
  const { addBundle } = useCart()
  useEffect(() => { if (bundle) setQuantity(1) }, [bundle])

  return (
    <Modal open={!!bundle} footer={null} onCancel={onClose} width={480} centered className="g-modal merch-detail" destroyOnHidden>
      {bundle && <>
        <img className="g-modal-img" src={cover(bundle)} alt={bundle.name} />
        <div className="g-modal-body">
          <span className="merch-eyebrow">COMBO COFFEEHOLIC</span>
          <h3>{bundle.name}</h3>
          <p className="g-muted">{bundle.description || 'Combo gồm nhiều loại cà phê khác nhau, được tính chung trong giá ưu đãi.'}</p>
          <div className="merch-detail-coffee-pair">
            {bundle.items.map((item) => (
              <article className="merch-detail-coffee" key={item.id}>
                <img src={imageSrc(item.coffee.imageUrl) || DEFAULT_IMAGE} alt={item.coffee.name} />
                <div className="merch-detail-coffee-body">
                  <strong>{item.coffee.name}</strong>
                  <span>{item.quantity} ly · {money(item.coffee.price)}/ly</span>
                </div>
              </article>
            ))}
          </div>
          <div className="merch-price-summary">
            <div><span>Giá mua lẻ</span><del>{money(bundle.standalonePrice)}</del></div>
            <div><span>Giá combo</span><strong>{money(bundle.bundlePrice)}</strong></div>
            {bundle.savingAmount > 0 && <p className="merch-saving">Tiết kiệm {money(bundle.savingAmount)} ({bundle.standalonePrice > 0 ? Math.round(bundle.savingAmount / bundle.standalonePrice * 100) : 0}%) mỗi combo</p>}
            <small>Với {quantity} combo: mua lẻ {money(bundle.standalonePrice * quantity)} · giá combo {money(bundle.bundlePrice * quantity)} · tiết kiệm {money(Math.max(0, bundle.savingAmount * quantity))}</small>
          </div>
          <div className="g-modal-foot">
            <div className="g-stepper">
              <button aria-label="Giảm số lượng" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><MinusOutlined /></button>
              <span>{quantity}</span>
              <button aria-label="Tăng số lượng" onClick={() => setQuantity((q) => Math.min(99, q + 1))}><PlusOutlined /></button>
            </div>
            <button className="g-cta g-cta-block" disabled={addBundle.isPending || !bundleAvailable(bundle)}
              onClick={() => addBundle.mutate({ bundleId: bundle.id, quantity, optionalItemIds: [] }, { onSuccess: onClose })}>
              <ShoppingCartOutlined /> {addBundle.isPending ? 'Đang thêm…' : `Thêm combo · ${money(bundle.bundlePrice * quantity)}`}
            </button>
          </div>
          <p className="merch-notice">Giá và tình trạng các món sẽ được kiểm tra lại trước khi xác nhận thanh toán.</p>
        </div>
      </>}
    </Modal>
  )
}
