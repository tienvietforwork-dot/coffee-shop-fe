import {merchandisingScheduleApi} from '@/api/merchandisingSchedule'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from 'antd'
import { PlusOutlined, MinusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { merchandisingApi, sectionLabels, type Bundle, type Placement, type PlacementSection } from '@/api/merchandising'
import { publicApi } from '@/api/public'
import type { MenuCoffee } from '@/api/types'
import { DEFAULT_IMAGE, imageSrc, money } from '@/lib/format'
import { CoffeeCard } from './CoffeeCard'
import { AddToCartModal } from './AddToCartModal'
import { useCart } from './useCart'

const sections: PlacementSection[] = ['HOME', 'FEATURED', 'BEST_SELLER', 'NEW_ARRIVAL', 'RECOMMENDED']
const fallback = DEFAULT_IMAGE
const itemAvailable = (item: Bundle['items'][number]) => item.coffee.status === 'AVAILABLE' && !item.coffee.autoSoldOut

function bundleAvailable(bundle: Bundle) {
  return bundle.items.length === 2
    && new Set(bundle.items.map((item) => item.coffee.id)).size === 2
    && bundle.items.every((item) => !item.optional && !item.choiceGroup
      && item.coffee.categoryType === 'DRINK' && itemAvailable(item))
}

/** The merchandising display uses the same cards and product modal as the normal menu. */
export function MerchandisingSections() {
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const [pickedBundle, setPickedBundle] = useState<Bundle | null>(null)
  const [quantity, setQuantity] = useState(1)
  const { addBundle } = useCart()
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
  const openBundle = (bundle: Bundle) => {
    setPickedBundle(bundle)
    setQuantity(1)
  }
  if (!placements.data?.length && !bundles.data?.length && !personalized.data?.length && !scheduled.data?.length) return null
  return <section className="g-container merch-home" aria-label="Sản phẩm tuyển chọn và combo">
    {!!scheduled.data?.length && <section className="merch-section"><div className="merch-section-title"><div><h2>Theo lịch hôm nay</h2></div><span className="merch-count">Lựa chọn theo thời điểm</span></div><div className="g-grid">{scheduled.data.map(row=>{const c=coffees.get(row.coffeeId);return c?<div key={row.id} className="merch-item"><CoffeeCard coffee={c} soldOut={!c.available} onPick={()=>setPicked(c)} onQuickAdd={()=>setPicked(c)}/><span className="merch-item-caption">{row.name}</span></div>:null})}</div></section>}
    {sections.map(section => {
      const rows = (placements.data ?? []).filter(p => p.section === section && p.visibleNow
        && coffees.get(p.coffee.id)?.available)
      if (!rows.length) return null
      return <section key={section} className="merch-section">
        <div className="merch-section-title"><div><span className="merch-eyebrow"> </span><h2>{sectionLabels[section]}</h2></div><span className="merch-count">{rows.length} món dành cho bạn</span></div>
        <div className="g-grid">
          {rows.map(row => {
            const coffee = coffees.get(row.coffee.id)
            if (!coffee) return <article className="g-card" key={row.id}><div className="g-card-img"><img src={imageSrc(row.coffee.imageUrl) || fallback} alt={row.coffee.name} /></div><div className="g-card-body"><h3>{row.coffee.name}</h3><p>Đang cập nhật thông tin sản phẩm</p></div></article>
            return <div key={row.id} className="merch-item"><CoffeeCard coffee={coffee} soldOut={!coffee.available} onPick={() => openProduct(row)} onQuickAdd={() => openProduct(row)} />{row.title && <span className="merch-item-caption">{row.title}</span>}</div>
          })}
        </div>
      </section>
    })}
    {!!personalized.data?.length && <section className="merch-section">
      <div className="merch-section-title"><div><span className="merch-eyebrow">  </span><h2>Gợi ý dành cho bạn</h2></div></div>
      <div className="g-grid">{personalized.data.slice(0,4).map(id=>coffees.get(id)).filter((c):c is MenuCoffee=>!!c).map(c=><CoffeeCard key={c.id} coffee={c} soldOut={!c.available} onPick={()=>setPicked(c)} onQuickAdd={()=>setPicked(c)} />)}</div>
    </section>}
    {!!bundles.data?.some(b => b.availableNow && b.status === 'ACTIVE' && bundleAvailable(b)) && <section className="merch-section">
      <div className="merch-section-title"><div><span className="merch-eyebrow"> </span><h2>Combo tiết kiệm</h2></div><span className="merch-count">Kết hợp món yêu thích</span></div>
      <div className="g-grid">{bundles.data.filter(b => b.availableNow && b.status === 'ACTIVE' && bundleAvailable(b)).map(b => {
        const cover = b.imageUrl || b.items.find(i => i.coffee.imageUrl)?.coffee.imageUrl
        return <article key={b.id} className="g-card merch-bundle" tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter') openBundle(b) }} onClick={() => openBundle(b)}>
          <div className="g-card-img"><img src={imageSrc(cover) || fallback} alt={b.name} loading="lazy"/><span className="merch-bundle-label">COMBO</span></div>
          <div className="g-card-body"><h3>{b.name}</h3><p>{b.description || b.items.map(i => `${i.quantity}× ${i.coffee.name}`).join(' · ')}</p>
            <div className="g-card-foot"><div className="g-price"><span className="g-price-now">{money(b.bundlePrice)}</span>{b.savingAmount > 0 && <span className="merch-saving">Tiết kiệm đến {money(b.savingAmount)}</span>}</div><button type="button" className="g-add" aria-label={`Xem combo ${b.name}`} onClick={e => { e.stopPropagation(); openBundle(b) }}><PlusOutlined /></button></div>
          </div>
        </article>
      })}</div>
    </section>}
    <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    <Modal open={!!pickedBundle} footer={null} onCancel={() => setPickedBundle(null)} width={480} centered className="g-modal merch-detail" destroyOnHidden>
      {pickedBundle && <><img className="g-modal-img" src={imageSrc(pickedBundle.imageUrl || pickedBundle.items.find(i => i.coffee.imageUrl)?.coffee.imageUrl) || fallback} alt={pickedBundle.name}/>
          <div className="g-modal-body"><span className="merch-eyebrow">COMBO COFFEEHOLIC</span><h3>{pickedBundle.name}</h3><p className="g-muted">{pickedBundle.description || 'Combo gồm hai loại cà phê khác nhau, được tính chung trong giá ưu đãi.'}</p>
              <div className="merch-detail-coffee-pair">
                {pickedBundle.items.map((item) => <article className="merch-detail-coffee" key={item.id}>
                  <img src={imageSrc(item.coffee.imageUrl) || fallback} alt={item.coffee.name} />
                  <div className="merch-detail-coffee-body">
                    <strong>{item.coffee.name}</strong>
                    <span>{item.quantity} ly · {money(item.coffee.price)}/ly</span>
                  </div>
                </article>)}
              </div>
              {pickedBundle.savingAmount > 0 && <p className="merch-saving">Tiết kiệm đến {money(pickedBundle.savingAmount)} so với mua lẻ</p>}
              <div className="g-modal-foot"><div className="g-stepper"><button aria-label="Giảm số lượng" onClick={() => setQuantity(q => Math.max(1,q-1))}><MinusOutlined/></button><span>{quantity}</span><button aria-label="Tăng số lượng" onClick={() => setQuantity(q => Math.min(99,q+1))}><PlusOutlined/></button></div>
                <button className="g-cta g-cta-block" disabled={addBundle.isPending || !bundleAvailable(pickedBundle)}
                  onClick={() => addBundle.mutate({bundleId:pickedBundle.id, quantity, optionalItemIds:[]}, {onSuccess:()=>setPickedBundle(null)})}>
                  <ShoppingCartOutlined /> {addBundle.isPending ? 'Đang thêm…' : `Thêm combo · ${money(pickedBundle.bundlePrice * quantity)}`}
                </button></div>
          <p className="merch-notice">Giá và tình trạng các món sẽ được kiểm tra lại trước khi xác nhận thanh toán.</p>
        </div></>}
    </Modal>
  </section>
}
