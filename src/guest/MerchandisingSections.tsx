import {merchandisingScheduleApi} from '@/api/merchandisingSchedule'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { merchandisingApi, sectionLabels, type Bundle, type Placement, type PlacementSection } from '@/api/merchandising'
import { publicApi } from '@/api/public'
import type { MenuCoffee } from '@/api/types'
import { DEFAULT_IMAGE, imageSrc } from '@/lib/format'
import { CoffeeCard } from './CoffeeCard'
import { AddToCartModal } from './AddToCartModal'
import { BundleCard, BundleModal } from './ComboCards'
import { sellableBundles } from './bundles'

const sections: PlacementSection[] = ['HOME', 'FEATURED', 'BEST_SELLER', 'NEW_ARRIVAL', 'RECOMMENDED']
const fallback = DEFAULT_IMAGE

/** The merchandising display uses the same cards and product modal as the normal menu. */
export function MerchandisingSections() {
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const [pickedBundle, setPickedBundle] = useState<Bundle | null>(null)
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
    {!!sellableBundles(bundles.data).length && <section className="merch-section">
      <div className="merch-section-title"><div><span className="merch-eyebrow"> </span><h2>Combo tiết kiệm</h2></div><span className="merch-count">Kết hợp món yêu thích</span></div>
      <div className="g-grid">{sellableBundles(bundles.data).map(b => <BundleCard key={b.id} bundle={b} onOpen={() => setPickedBundle(b)} />)}</div>
    </section>}
    <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    <BundleModal bundle={pickedBundle} onClose={() => setPickedBundle(null)} />
  </section>
}
