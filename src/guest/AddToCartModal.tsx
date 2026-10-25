import { useEffect, useState } from 'react'
<<<<<<< HEAD
import { Input, Modal, Tag } from 'antd'
=======
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { message } from 'antd'
import { Modal } from 'antd'
>>>>>>> 05dfd00 (Cross-sell and Upsell and Recommendation and Merchandising Schedule and Merchandising Analytics)
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'
import { flyToCart } from '@/lib/flyToCart'
import { CrossSellSuggestions } from './CrossSellSuggestions'
import { RecommendationSuggestions } from './RecommendationSuggestions'
import { UpsellSuggestions } from './UpsellSuggestions'

/** Lời dặn hay gặp ở quầy; the bar still makes the drink by its recipe, the note only tells how to serve it. */
const QUICK_NOTES = ['Ít đá', 'Không đá', 'Đá riêng', 'Ít ngọt', 'Không đường']

/**
 * One size, no options: a coffee is made by its recipe, the guest picks how many and may leave a note (ít đá, ít ngọt…).
 * Cups with a different note are a separate line in the cart.
 */
export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
<<<<<<< HEAD
  const [note, setNote] = useState('')
  const { add, lines } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) {
      setQty(1)
      setNote('')
    }
=======
  const [related, setRelated] = useState<MenuCoffee | null>(null)
  const [upgrade, setUpgrade] = useState<MenuCoffee | null>(null)
  const [optionIds,setOptionIds]=useState<number[]>([])
  const optionQuery=useQuery({queryKey:["upsell-public-options",coffee?.id],queryFn:()=>publicApi.upsellOptions(coffee!.id),enabled:!!coffee})
  const { add, lines, cart } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) {setQty(1);setRelated(null);setUpgrade(null);setOptionIds([])}
>>>>>>> 05dfd00 (Cross-sell and Upsell and Recommendation and Merchandising Schedule and Merchandising Analytics)
  }, [coffee])

  const parts = note.split(',').map((s) => s.trim()).filter(Boolean)
  const toggle = (q: string) => setNote((parts.includes(q) ? parts.filter((p) => p !== q) : [...parts, q]).join(', '))

  if (!coffee) return null
  const chosen = upgrade ?? coffee
  const unit = chosen.salePrice != null && chosen.salePrice < chosen.price ? chosen.salePrice : chosen.price
  const max = Math.min(99, addableOf(chosen.id))
  const availableOptions=upgrade ? [] : (optionQuery.data ?? [])
  const selected=availableOptions.filter(o=>optionIds.includes(o.id))
  const extra=selected.reduce((sum,o)=>sum+Number(o.extraPrice),0)
  const toggleOption=(id:number,kind:string)=>setOptionIds(current=>{
    if(current.includes(id))return current.filter(x=>x!==id)
    const allowed=availableOptions.filter(o=>o.kind===kind).map(o=>o.id)
    return [...(kind==='PREMIUM'?current.filter(x=>!allowed.includes(x)):current),id]
  })

  // close at once and let the request run in the background; the photo flies into the cart
  const submit = () => {
    flyToCart(document.querySelector('.g-modal-img'), imageSrc(coffee.imageUrl))
<<<<<<< HEAD
    add.mutate({ coffeeId: coffee.id, quantity: qty, note: note.trim() || undefined })
=======
    if(optionQuery.isError && !upgrade){message.error("Không tải được tùy chọn nâng cấp");return}
    add.mutate({ coffeeId: chosen.id, quantity: qty, optionIds: upgrade?[]:optionIds })
>>>>>>> 05dfd00 (Cross-sell and Upsell and Recommendation and Merchandising Schedule and Merchandising Analytics)
    onClose()
  }

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      {coffee.imageUrl && <img className="g-modal-img" src={imageSrc(coffee.imageUrl)} alt={coffee.name} />}
      <div className="g-modal-body">
        <h3>{coffee.name}</h3>
        {coffee.description && <p className="g-muted">{coffee.description}</p>}

        {max < 10 && max > 0 && <p className="g-stock-hint">Chỉ còn pha được {max} ly</p>}
<<<<<<< HEAD
        <div className="g-note-picker">
          {QUICK_NOTES.map((q) => (
            <Tag.CheckableTag key={q} checked={parts.includes(q)} onChange={() => toggle(q)}>{q}</Tag.CheckableTag>
          ))}
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} allowClear
            placeholder="Ghi chú cho món (không bắt buộc)" aria-label="Ghi chú cho món" />
        </div>
=======
        {upgrade && <div className="g-stock-hint">Đã chọn nâng cấp: <strong>{upgrade.name}</strong> · {money(unit)} <button type="button" onClick={()=>setUpgrade(null)}>Quay về {coffee.name}</button></div>}
        {availableOptions.length>0 && <div className="g-upsell-options" style={{padding:'12px 0'}}>
          <strong>Tùy chỉnh chính món của bạn</strong>
          {(['TOPPING','PREMIUM'] as const).map(kind=>{
            const opts=availableOptions.filter(o=>o.kind===kind)
            if(!opts.length)return null
            return <div key={kind} style={{marginTop:8}}><small>{kind==='TOPPING'?'Thêm topping / shot':'Nguyên liệu cao cấp'}</small>
              {opts.map(o=><label key={o.id} style={{display:'flex',gap:8,alignItems:'center',marginTop:5}}>
                <input type={kind==='TOPPING'?'checkbox':'radio'} name={kind} checked={optionIds.includes(o.id)} onChange={()=>toggleOption(o.id,kind)}/>
                <span style={{flex:1}}>{o.name}</span><span>+{money(Number(o.extraPrice))}</span>
              </label>)}
              {(kind==='PREMIUM')&&<button type="button" onClick={()=>setOptionIds(old=>old.filter(x=>!opts.some(o=>o.id===x)))}>Không nâng cấp</button>}
            </div>
          })}
        </div>}
>>>>>>> 05dfd00 (Cross-sell and Upsell and Recommendation and Merchandising Schedule and Merchandising Analytics)
        <div className="g-modal-foot">
          <div className="g-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm"><MinusOutlined /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Tăng"><PlusOutlined /></button>
          </div>
          <button className="g-cta g-cta-block" onClick={submit} disabled={max < 1}>
            {max < 1 ? 'Đã hết nguyên liệu' : `Thêm vào giỏ · ${money((unit+extra) * qty)}`}
          </button>
        </div>
        <UpsellSuggestions anchor={coffee} cartTotal={cart?.subtotal ?? 0} onPick={choice=>{setUpgrade(choice);setQty(1)}} />
        <RecommendationSuggestions anchor={coffee} onPick={setRelated} />
        <CrossSellSuggestions anchor={coffee} cartTotal={cart?.subtotal ?? 0} onPick={setRelated} />
      </div>
      {related && <div className="cross-sell-selection">Thêm món gợi ý: <strong>{related.name}</strong><button type="button" onClick={()=>{add.mutate({coffeeId:related.id,quantity:1});setRelated(null)}}>Thêm vào giỏ</button><button type="button" onClick={()=>setRelated(null)}>Bỏ chọn</button></div>}
    </Modal>
  )
}
