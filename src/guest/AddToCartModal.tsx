import { useEffect, useState } from 'react'
import { message } from 'antd'
import { Modal } from 'antd'
import { ArrowLeftOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { money, photoSrc } from '@/lib/format'
import { useCart } from './useCart'
import { flyToCart } from '@/lib/flyToCart'
import { RecommendationSuggestions } from './RecommendationSuggestions'
import { UpsellSuggestions } from './UpsellSuggestions'
import { recommendationApi } from '@/api/recommendation'
import type { SuggestionTracking } from './suggestionTracking'

/** The backend validates availability and final pricing when the guest adds a coffee. */
export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [related, setRelated] = useState<MenuCoffee | null>(null)
  const [relatedTracking, setRelatedTracking] = useState<SuggestionTracking | null>(null)
  const [suggestion, setSuggestion] = useState<MenuCoffee | null>(null)
  const { add, cart } = useCart()

  useEffect(() => {
    if (coffee) {setQty(1);setRelated(null);setRelatedTracking(null);setSuggestion(null)}
  }, [coffee])

  if (!coffee) return null
  const chosen = suggestion ?? coffee
  const unit = chosen.salePrice != null && chosen.salePrice < chosen.price ? chosen.salePrice : chosen.price
  const heroImage = chosen.imageUrl ?? coffee.imageUrl
  const max = 99 // no stock cap: the shop does not track inventory
  // Do not close the product modal (or play success animation) before the server accepts the item.
  // The backend owns the final price and validates the coffee; leave the selection intact on error.
  const submit = async () => {
    if (submitting || add.isPending) return
    if (!chosen.available || qty < 1 || qty > max) {
      message.error('Số lượng hoặc tình trạng món không hợp lệ')
      return
    }
    setSubmitting(true)
    try {
      await add.mutateAsync({ coffeeId: chosen.id, quantity: qty })
      flyToCart(document.querySelector('.g-modal-img'), photoSrc(chosen.imageUrl ?? coffee.imageUrl))
      onClose()
    } catch {
      // useCart.onError shows the backend error; keep the dialog for adjustment/retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      <img key={chosen.id} className="g-modal-img" src={photoSrc(heroImage)} alt={chosen.name} />
      <div className="g-modal-body">
        <h3>{chosen.name}</h3>
        {chosen.description && <p className="g-muted">{chosen.description}</p>}
        {suggestion && <div className="g-suggestion-selected">
          <div className="g-suggestion-selected-copy"><span className="g-suggestion-check">✓</span><span><small>ĐÃ CHỌN MÓN GỢI Ý</small><strong>{suggestion.name}</strong></span><b>{money(unit)}</b></div>
          <button type="button" className="g-suggestion-reset" onClick={()=>setSuggestion(null)}><ArrowLeftOutlined /> Giữ món {coffee.name}</button>
        </div>}
        <div className="g-modal-foot">
          <div className="g-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm"><MinusOutlined /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Tăng"><PlusOutlined /></button>
          </div>
          <button className="g-cta g-cta-block" onClick={submit} disabled={max < 1 || !chosen.available || qty > max || submitting || add.isPending}>
            {submitting || add.isPending ? 'Đang thêm…' : !chosen.available ? 'Đã hết món' : `Thêm vào giỏ · ${money(unit * qty)}`}
          </button>
        </div>
        <UpsellSuggestions anchor={coffee} onPick={choice=>{setSuggestion(choice);setQty(1)}} />
        <RecommendationSuggestions anchor={coffee} onPick={(pick, tracking)=>{setRelated(pick);setRelatedTracking(tracking)}} />
      </div>
      {related && <div className="cross-sell-selection">{relatedTracking?.source === 'cross-sell' ? 'Thêm món bán kèm:' : 'Thêm món gợi ý:'} <strong>{related.name}</strong><button type="button" onClick={async()=>{try{await add.mutateAsync({coffeeId:related.id,quantity:1});if(relatedTracking?.source==='recommendation' && relatedTracking.coffeeId===related.id){recommendationApi.event(relatedTracking.ruleId,related.id,relatedTracking.impressionId,'ADD_TO_CART').catch(()=>{})}setRelated(null);setRelatedTracking(null)}catch{/* Error already shown by useCart. */}}} disabled={add.isPending || !related.available}>Thêm vào giỏ</button><button type="button" onClick={()=>{setRelated(null);setRelatedTracking(null)}}>Bỏ chọn</button></div>}
    </Modal>
  )
}
