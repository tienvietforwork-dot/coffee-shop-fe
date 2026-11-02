import { useEffect, useState } from 'react'
import { message } from 'antd'
import { Modal } from 'antd'
import { ArrowLeftOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'
import { flyToCart } from '@/lib/flyToCart'
import { CrossSellSuggestions } from './CrossSellSuggestions'
import { RecommendationSuggestions } from './RecommendationSuggestions'
import { UpsellSuggestions } from './UpsellSuggestions'
import { recommendationApi } from '@/api/recommendation'
import type { SuggestionTracking } from './suggestionTracking'

const QUICK_NOTES = ['Ít đá', 'Không đá', 'Ít đường', 'Không đường', 'Nóng']

/** The backend validates availability and final pricing when the guest adds a coffee. */
export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [related, setRelated] = useState<MenuCoffee | null>(null)
  const [relatedTracking, setRelatedTracking] = useState<SuggestionTracking | null>(null)
  const [upgrade, setUpgrade] = useState<MenuCoffee | null>(null)
  const { add, lines, cart } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) {setQty(1);setNote('');setRelated(null);setRelatedTracking(null);setUpgrade(null)}
  }, [coffee])

  if (!coffee) return null
  const chosen = upgrade ?? coffee
  const unit = chosen.salePrice != null && chosen.salePrice < chosen.price ? chosen.salePrice : chosen.price
  const heroImage = chosen.imageUrl ?? coffee.imageUrl
  const max = Math.min(99, addableOf(chosen.id))
  // Do not close the product modal (or play success animation) before the server accepts the item.
  // The backend owns the final price and validates recipe/stock; leave the selection intact on error.
  const submit = async () => {
    if (submitting || add.isPending) return
    if (!chosen.available || qty < 1 || qty > max) {
      message.error('Số lượng hoặc tình trạng món không hợp lệ')
      return
    }
    setSubmitting(true)
    try {
      await add.mutateAsync({ coffeeId: chosen.id, quantity: qty, note: note.trim() || undefined })
      flyToCart(document.querySelector('.g-modal-img'), imageSrc(chosen.imageUrl ?? coffee.imageUrl))
      onClose()
    } catch {
      // useCart.onError shows the backend error; keep the dialog for adjustment/retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      {heroImage && <img key={chosen.id} className="g-modal-img" src={imageSrc(heroImage)} alt={chosen.name} />}
      <div className="g-modal-body">
        <h3>{chosen.name}</h3>
        {chosen.description && <p className="g-muted">{chosen.description}</p>}

        {max < 10 && max > 0 && <p className="g-stock-hint">Chỉ còn pha được {max} ly</p>}
        {upgrade && <div className="g-upgrade-selected">
          <div className="g-upgrade-selected-copy"><span className="g-upgrade-check">✓</span><span><small>ĐÃ CHỌN NÂNG CẤP</small><strong>{upgrade.name}</strong></span><b>{money(unit)}</b></div>
          <button type="button" className="g-upgrade-reset" onClick={()=>setUpgrade(null)}><ArrowLeftOutlined /> Quay về {coffee.name}</button>
        </div>}
        <div className="g-note-picker">
          <label htmlFor="coffee-order-note">Ghi chú pha chế (tùy chọn)</label>
          <div className="g-note-presets">
            {QUICK_NOTES.map((quick) => (
              <button key={quick} type="button" onClick={() => setNote(quick)}>{quick}</button>
            ))}
          </div>
          <textarea id="coffee-order-note" value={note} onChange={(event) => setNote(event.target.value)}
            maxLength={255} rows={2} placeholder="Ví dụ: ít đá, không đường..." />
        </div>
        <div className="g-modal-foot">
          <div className="g-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm"><MinusOutlined /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Tăng"><PlusOutlined /></button>
          </div>
          <button className="g-cta g-cta-block" onClick={submit} disabled={max < 1 || !chosen.available || qty > max || submitting || add.isPending}>
            {submitting || add.isPending ? 'Đang thêm…' : max < 1 ? 'Đã hết nguyên liệu' : `Thêm vào giỏ · ${money(unit * qty)}`}
          </button>
        </div>
        <UpsellSuggestions anchor={coffee} cartTotal={cart?.subtotal ?? 0} onPick={choice=>{setUpgrade(choice);setQty(1)}} />
        <RecommendationSuggestions anchor={coffee} onPick={(pick, tracking)=>{setRelated(pick);setRelatedTracking(tracking)}} />
        <CrossSellSuggestions anchor={coffee} cartTotal={cart?.subtotal ?? 0} onPick={(pick, tracking)=>{setRelated(pick);setRelatedTracking(tracking)}} />
      </div>
      {related && <div className="cross-sell-selection">Thêm món gợi ý: <strong>{related.name}</strong><button type="button" onClick={async()=>{try{await add.mutateAsync({coffeeId:related.id,quantity:1});if(relatedTracking?.source==='recommendation' && relatedTracking.coffeeId===related.id){recommendationApi.event(relatedTracking.ruleId,related.id,relatedTracking.impressionId,'ADD_TO_CART').catch(()=>{})}setRelated(null);setRelatedTracking(null)}catch{/* Error already shown by useCart. */}}} disabled={add.isPending || !related.available || addableOf(related.id)<1}>Thêm vào giỏ</button><button type="button" onClick={()=>{setRelated(null);setRelatedTracking(null)}}>Bỏ chọn</button></div>}
    </Modal>
  )
}
