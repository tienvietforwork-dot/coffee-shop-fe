import {merchandisingScheduleApi} from '@/api/merchandisingSchedule'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from 'antd'
import { PlusOutlined, MinusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { merchandisingApi, sectionLabels, type Bundle, type Placement, type PlacementSection } from '@/api/merchandising'
import { publicApi } from '@/api/public'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { CoffeeCard } from './CoffeeCard'
import { AddToCartModal } from './AddToCartModal'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'

const sections: PlacementSection[] = ['HOME', 'FEATURED', 'BEST_SELLER', 'NEW_ARRIVAL', 'RECOMMENDED']
const fallback = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80'

/** The merchandising display uses the same cards and product modal as the normal menu. */
export function MerchandisingSections() {
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const [pickedBundle, setPickedBundle] = useState<Bundle | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<number[]>([])
  const { lines, addBundle } = useCart()
  const addable = useAddableCups(lines)
  const menu = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const placements = useQuery({ queryKey: ['merch-public-placements'], queryFn: merchandisingApi.publicPlacements, retry: 1 })
  const scheduled = useQuery({queryKey:['merch-public-schedules'],queryFn:merchandisingScheduleApi.publicNow,refetchInterval:60_000})
  const personalized = useQuery({queryKey:['personalized-menu'],queryFn:publicApi.recommended,retry:1})
  const bundles = useQuery({ queryKey: ['merch-public-bundles'], queryFn: merchandisingApi.publicBundles, retry: 1 })
  const coffees = useMemo(() => new Map((menu.data?.categories ?? []).flatMap(c => c.coffees).map(c => [c.id, c])), [menu.data])
  const openProduct = (row: Placement) => {
    const coffee = coffees.get(row.coffee.id)
    if (coffee) setPicked(coffee)
  }
  if (!placements.data?.length && !bundles.data?.length && !personalized.data?.length && !scheduled.data?.length) return null
  return <section className="g-container merch-home" aria-label="Sản phẩm tuyển chọn và combo">
    {!!scheduled.data?.length && <section className="merch-section"><div className="merch-section-title"><div><h2>Theo lịch hôm nay</h2></div><span className="merch-count">Lựa chọn theo thời điểm</span></div><div className="g-grid">{scheduled.data.map(row=>{const c=coffees.get(row.coffeeId);return c?<div key={row.id} className="merch-item"><CoffeeCard coffee={c} soldOut={!c.available||addable(c.id)<1} onPick={()=>setPicked(c)} onQuickAdd={()=>setPicked(c)}/><span className="merch-item-caption">{row.name}</span></div>:null})}</div></section>}
    {sections.map(section => {
      const rows = (placements.data ?? []).filter(p => p.section === section && p.visibleNow)
      if (!rows.length) return null
      return <section key={section} className="merch-section">
        <div className="merch-section-title"><div><span className="merch-eyebrow"> </span><h2>{sectionLabels[section]}</h2></div><span className="merch-count">{rows.length} món dành cho bạn</span></div>
        <div className="g-grid">
          {rows.map(row => {
            const coffee = coffees.get(row.coffee.id)
            if (!coffee) return <article className="g-card" key={row.id}><div className="g-card-img"><img src={imageSrc(row.coffee.imageUrl) || fallback} alt={row.coffee.name} /></div><div className="g-card-body"><h3>{row.coffee.name}</h3><p>Đang cập nhật thông tin sản phẩm</p></div></article>
            return <div key={row.id} className="merch-item"><CoffeeCard coffee={coffee} soldOut={!coffee.available || addable(coffee.id) < 1} onPick={() => openProduct(row)} onQuickAdd={() => openProduct(row)} />{row.title && <span className="merch-item-caption">{row.title}</span>}</div>
          })}
        </div>
      </section>
    })}
    {!!personalized.data?.length && <section className="merch-section">
      <div className="merch-section-title"><div><span className="merch-eyebrow">  </span><h2>Gợi ý dành cho bạn</h2></div></div>
      <div className="g-grid">{personalized.data.slice(0,4).map(id=>coffees.get(id)).filter((c):c is MenuCoffee=>!!c).map(c=><CoffeeCard key={c.id} coffee={c} soldOut={!c.available || addable(c.id)<1} onPick={()=>setPicked(c)} onQuickAdd={()=>setPicked(c)} />)}</div>
    </section>}
    {!!bundles.data?.some(b => b.availableNow && b.status === 'ACTIVE') && <section className="merch-section">
      <div className="merch-section-title"><div><span className="merch-eyebrow"> </span><h2>Combo tiết kiệm</h2></div><span className="merch-count">Kết hợp món yêu thích</span></div>
      <div className="g-grid">{bundles.data.filter(b => b.availableNow && b.status === 'ACTIVE').map(b => {
        const cover = b.items.find(i => i.coffee.imageUrl)?.coffee.imageUrl
        return <article key={b.id} className="g-card merch-bundle" tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter') { setPickedBundle(b); setQuantity(1); setSelectedOptions([]) } }} onClick={() => { setPickedBundle(b); setQuantity(1); setSelectedOptions([]) }}>
          <div className="g-card-img"><img src={imageSrc(cover) || fallback} alt={b.name} loading="lazy"/><span className="merch-bundle-label">COMBO</span></div>
          <div className="g-card-body"><h3>{b.name}</h3><p>{b.description || b.items.map(i => `${i.quantity}× ${i.coffee.name}`).join(' · ')}</p>
            <div className="g-card-foot"><div className="g-price"><span className="g-price-now">{money(b.bundlePrice)}</span>{b.savingAmount > 0 && <span className="merch-saving">Tiết kiệm {money(b.savingAmount)}</span>}</div><button type="button" className="g-add" aria-label={`Xem combo ${b.name}`} onClick={e => { e.stopPropagation(); setPickedBundle(b); setQuantity(1); setSelectedOptions([]) }}><PlusOutlined /></button></div>
          </div>
        </article>
      })}</div>
    </section>}
    <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    <Modal open={!!pickedBundle} footer={null} onCancel={() => setPickedBundle(null)} width={480} centered className="g-modal merch-detail" destroyOnHidden>
      {pickedBundle && <><img className="g-modal-img" src={imageSrc(pickedBundle.items.find(i => i.coffee.imageUrl)?.coffee.imageUrl) || fallback} alt={pickedBundle.name}/>
        <div className="g-modal-body"><span className="merch-eyebrow">COMBO COFFEEHOLIC</span><h3>{pickedBundle.name}</h3><p className="g-muted">{pickedBundle.description || 'Thưởng thức những món cà phê yêu thích với giá ưu đãi.'}</p>
          <div className="merch-detail-items"><strong>Thành phần combo</strong>{pickedBundle.items.map(i => <div key={i.id}><span>{i.quantity} × {i.coffee.name}</span>{i.optional ? <label className="merch-optional"><input type="checkbox" checked={selectedOptions.includes(i.id)} onChange={e => setSelectedOptions(current => e.target.checked ? [...current, i.id] : current.filter(id => id !== i.id))}/> Thêm {money(i.linePrice)}</label> : <span>Đã gồm</span>}</div>)}</div>
          {pickedBundle.savingAmount > 0 && <p className="merch-saving">Tiết kiệm {money(pickedBundle.savingAmount)} so với mua lẻ</p>}
          <div className="g-modal-foot"><div className="g-stepper"><button aria-label="Giảm số lượng" onClick={() => setQuantity(q => Math.max(1,q-1))}><MinusOutlined/></button><span>{quantity}</span><button aria-label="Tăng số lượng" onClick={() => setQuantity(q => Math.min(99,q+1))}><PlusOutlined/></button></div>
            <button className="g-cta g-cta-block" disabled={addBundle.isPending} onClick={()=>addBundle.mutate({bundleId:pickedBundle.id, quantity, optionalItemIds:selectedOptions},{onSuccess:()=>setPickedBundle(null)})}><ShoppingCartOutlined /> {addBundle.isPending ? 'Đang thêm…' : `Thêm combo · ${money((pickedBundle.bundlePrice + pickedBundle.items.filter(i => i.optional && selectedOptions.includes(i.id)).reduce((sum, i) => sum + i.linePrice, 0)) * quantity)}`}</button></div>
          <p className="merch-notice">Giá và tình trạng các món sẽ được kiểm tra lại trước khi xác nhận thanh toán.</p>
        </div></>}
    </Modal>
  </section>
}
