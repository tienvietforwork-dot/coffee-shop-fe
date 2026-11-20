import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRightOutlined, TagOutlined } from '@ant-design/icons'

import { publicApi } from '@/api/public'
import type { MenuCoffee } from '@/api/types'
import { date, money } from '@/lib/format'
import { flyToCart } from '@/lib/flyToCart'
import { useGuestStore } from '@/store/guestStore'

import { AddToCartModal } from './AddToCartModal'
import { CoffeeCard } from './CoffeeCard'
import { MerchandisingSections } from './MerchandisingSections'
import { ScrollRow } from './ScrollRow'
import { useCart } from './useCart'

/**
 * Trang chủ: the first screen a guest sees — hero, the shop's running offers, coffees on sale and the
 * merchandising sections (featured / combos). The full menu with filters lives on /menu.
 */
export function HomePage() {
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const tableNo = useGuestStore((s) => s.tableNo)
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const { add } = useCart()

  const quickAdd = (coffee: MenuCoffee, photo: HTMLImageElement | null) => {
    flyToCart(photo, photo?.currentSrc)
    add.mutate({ coffeeId: coffee.id, quantity: 1 })
  }

  const discounted = useMemo(() => {
    const byId = new Map<number, MenuCoffee>()
    for (const c of menu?.categories ?? []) {
      for (const coffee of c.coffees) {
        if (coffee.salePrice != null && coffee.salePrice < coffee.price) byId.set(coffee.id, coffee)
      }
    }
    return [...byId.values()]
  }, [menu])

  return (
    <>
      <section className="g-hero">
        <div className="g-container g-hero-inner">
          <div className="g-hero-text">
            <span className="g-eyebrow">{tableNo ? `Bạn đang ngồi bàn ${tableNo}` : 'Rang mộc · Pha tay · Mỗi ngày'}</span>
            <h1>Một ly cà phê<br /><em>đúng gu</em> của bạn.</h1>
            <p>Chọn món và đặt ngay — uống tại bàn, mang đi hay giao tận nơi.</p>
            <Link to="/menu" className="g-cta">Xem thực đơn</Link>
          </div>
          <div className="g-hero-art" aria-hidden>
            <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=80" alt="" />
          </div>
        </div>
      </section>

      {!!menu?.orderPromotions.length && (
        <section className="g-container g-promos">
          {menu.orderPromotions.map((p) => (
            <div key={p.id} className="g-promo">
              <TagOutlined className="g-promo-icon" />
              <div>
                <strong>{p.name}</strong>
                <span>
                  {p.discountPercent
                    ? p.discountType === 'FIXED_AMOUNT' ? `Giảm ${money(p.discountPercent)}` : `Giảm ${p.discountPercent}%`
                    : ''}
                  {p.minOrderAmount ? ` cho đơn từ ${money(p.minOrderAmount)}` : ''}
                  {' · đến '}{date(p.endDate)}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {!!discounted.length && (
        <section className="g-container g-section">
          <div className="g-section-head g-section-head-row">
            <div>
              <h2>Đang giảm giá <span className="g-section-count">{discounted.length} món</span></h2>
              <p>Ưu đãi trên các món đang có giá giảm.</p>
            </div>
            <Link to="/menu" className="g-link-more">Xem thực đơn <ArrowRightOutlined /></Link>
          </div>
          <ScrollRow>
            {discounted.map((coffee) => (
              <CoffeeCard key={coffee.id} coffee={coffee} soldOut={!coffee.available}
                onPick={() => setPicked(coffee)} onQuickAdd={(photo) => quickAdd(coffee, photo)} />
            ))}
          </ScrollRow>
        </section>
      )}

      <MerchandisingSections />

      <section className="g-container g-home-cta">
        <Link to="/menu" className="g-cta">Xem toàn bộ thực đơn <ArrowRightOutlined /></Link>
      </section>

      <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    </>
  )
}
