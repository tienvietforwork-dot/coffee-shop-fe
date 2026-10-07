import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Skeleton, Empty } from 'antd'
import { SearchOutlined, TagOutlined } from '@ant-design/icons'
import { publicApi } from '@/api/public'
import type { MenuCoffee } from '@/api/types'
import { money, date } from '@/lib/format'
import { CoffeeCard } from './CoffeeCard'
import { AddToCartModal } from './AddToCartModal'
import { useGuestStore } from '@/store/guestStore'
import { useAddableCups } from '@/lib/stock'
import { useCart } from './useCart'

export function MenuPage() {
  const { data: menu, isLoading } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const addable = useAddableCups(useCart().lines)
  const tableNo = useGuestStore((s) => s.tableNo)
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({})

  const categories = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (menu?.categories ?? [])
      .map((c) => ({ ...c, coffees: c.coffees.filter((x) => !q || x.name.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q)) }))
      .filter((c) => c.coffees.length > 0)
  }, [menu, search])

  const jump = (id: number) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <section className="g-hero">
        <div className="g-container g-hero-inner">
          <div className="g-hero-text">
            <span className="g-eyebrow">{tableNo ? `Bạn đang ngồi bàn ${tableNo}` : 'Rang mộc · Pha tay · Mỗi ngày'}</span>
            <h1>Một ly cà phê<br /><em>đúng gu</em> của bạn.</h1>
            <p>Chọn món, ghi chú theo khẩu vị và đặt ngay — uống tại bàn, mang đi hay giao tận nơi.</p>
            <button className="g-cta" onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}>
              Xem thực đơn
            </button>
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
                  {p.discountPercent ? `Giảm ${p.discountPercent}%` : ''}
                  {p.minOrderAmount ? ` cho đơn từ ${money(p.minOrderAmount)}` : ''} · đến {date(p.endDate)}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      <section id="menu" className="g-container g-menu">
        <div className="g-menu-bar">
          <div className="g-chips">
            {categories.map((c) => (
              <button key={c.id} className={`g-chip ${active === c.id ? 'is-active' : ''}`} onClick={() => jump(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm món…"
            className="g-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
        {!isLoading && categories.length === 0 && <Empty description="Không tìm thấy món phù hợp" />}

        {categories.map((c) => (
          <section key={c.id} className="g-section" ref={(el) => { sectionRefs.current[c.id] = el }}>
            <div className="g-section-head">
              <h2>{c.name}</h2>
              {c.description && <p>{c.description}</p>}
            </div>
            <div className="g-grid">
              {c.coffees.map((coffee) => (
                <CoffeeCard key={coffee.id} coffee={coffee} soldOut={!coffee.available || addable(coffee.id) < 1} onPick={() => setPicked(coffee)} />
              ))}
            </div>
          </section>
        ))}
      </section>

      <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    </>
  )
}
