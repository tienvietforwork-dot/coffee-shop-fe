import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, Skeleton, Empty } from "antd";
import { SearchOutlined, TagOutlined } from "@ant-design/icons";

<<<<<<< Updated upstream
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Skeleton, Empty, Select, Checkbox } from 'antd'
import {
  SearchOutlined,
  TagOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
=======
import { publicApi } from "@/api/public";
import type { MenuCoffee } from "@/api/types";
import { money, date } from "@/lib/format";
>>>>>>> Stashed changes

import { CoffeeCard } from "./CoffeeCard";
import { AddToCartModal } from "./AddToCartModal";
import { MerchandisingSections } from "./MerchandisingSections";

<<<<<<< Updated upstream
import { CoffeeCard } from './CoffeeCard'
import { AddToCartModal } from './AddToCartModal'
import { MerchandisingSections } from './MerchandisingSections'

import { useGuestStore } from '@/store/guestStore'
import { useCart } from './useCart'
import { flyToCart } from '@/lib/flyToCart'
=======
import { useGuestStore } from "@/store/guestStore";
import { useAddableCups } from "@/lib/stock";
import { useCart } from "./useCart";
import { flyToCart } from "@/lib/flyToCart";
>>>>>>> Stashed changes

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name'
type PriceKey = 'all' | 'lt30' | '30to50' | 'gt50'

const PRICE_OPTIONS: { value: PriceKey; label: string }[] = [
  { value: 'all', label: 'Mọi mức giá' },
  { value: 'lt30', label: 'Dưới 30.000đ' },
  { value: '30to50', label: '30.000đ – 50.000đ' },
  { value: 'gt50', label: 'Trên 50.000đ' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Sắp xếp: mặc định' },
  { value: 'price-asc', label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' },
  { value: 'name', label: 'Tên A → Z' },
]

// Gia thuc te khach phai tra (uu tien gia khuyen mai)
const finalPrice = (c: MenuCoffee) => c.salePrice ?? c.price

const inPriceRange = (c: MenuCoffee, key: PriceKey) => {
  const p = finalPrice(c)
  if (key === 'lt30') return p < 30000
  if (key === '30to50') return p >= 30000 && p <= 50000
  if (key === 'gt50') return p > 50000
  return true
}

// Mot hang mon cuon ngang, co nut trai/phai tren desktop
function ScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="g-row-wrap">
      <button
        type="button"
        className="g-row-nav is-prev"
        aria-label="Cuộn sang trái"
        onClick={() => scroll(-1)}
      >
        <LeftOutlined />
      </button>

      <div className="g-row" ref={ref}>
        {children}
      </div>

      <button
        type="button"
        className="g-row-nav is-next"
        aria-label="Cuộn sang phải"
        onClick={() => scroll(1)}
      >
        <RightOutlined />
      </button>
    </div>
  )
}

export function MenuPage() {
  const { data: menu, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: publicApi.menu,
  });

<<<<<<< Updated upstream
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const [price, setPrice] = useState<PriceKey>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [onSale, setOnSale] = useState(false)
  const [inStock, setInStock] = useState(false)
  const [picked, setPicked] = useState<MenuCoffee | null>(null)

  const { add } = useCart()
=======
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [picked, setPicked] = useState<MenuCoffee | null>(null);

  const { lines, add } = useCart();
  const addable = useAddableCups(lines);
>>>>>>> Stashed changes

  const tableNo = useGuestStore((s) => s.tableNo);

<<<<<<< Updated upstream
=======
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

>>>>>>> Stashed changes
  // Them san pham le vao gio hang
  const quickAdd = (coffee: MenuCoffee, photo: HTMLImageElement | null) => {
    flyToCart(photo, photo?.currentSrc);

    add.mutate({
      coffeeId: coffee.id,
      quantity: 1,
    });
  };

  // Danh sach danh muc cho thanh chip (khong phu thuoc bo loc)
  const allCategories = menu?.categories ?? []

  // Loc san pham theo danh muc, ten/mo ta, gia, khuyen mai, con hang
  const categories = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (menu?.categories ?? [])
      .filter((c) => active === null || c.id === active)
      .map((c) => {
        const coffees = c.coffees.filter(
          (x) =>
<<<<<<< Updated upstream
            (!q ||
              x.name.toLowerCase().includes(q) ||
              x.description?.toLowerCase().includes(q)) &&
            inPriceRange(x, price) &&
            (!onSale || x.salePrice != null) &&
            (!inStock || x.available)
        )

        if (sort === 'price-asc')
          coffees.sort((a, b) => finalPrice(a) - finalPrice(b))
        if (sort === 'price-desc')
          coffees.sort((a, b) => finalPrice(b) - finalPrice(a))
        if (sort === 'name')
          coffees.sort((a, b) => a.name.localeCompare(b.name, 'vi'))

        return { ...c, coffees }
      })
      .filter((c) => c.coffees.length > 0)
  }, [menu, search, active, price, sort, onSale, inStock])

  const filtered =
    !!search.trim() ||
    active !== null ||
    price !== 'all' ||
    sort !== 'default' ||
    onSale ||
    inStock

  const resetFilters = () => {
    setSearch('')
    setActive(null)
    setPrice('all')
    setSort('default')
    setOnSale(false)
    setInStock(false)
  }
=======
            !q ||
            x.name.toLowerCase().includes(q) ||
            x.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.coffees.length > 0);
  }, [menu, search]);

  // Chuyen den danh muc
  const jump = (id: number) => {
    setActive(id);

    sectionRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
>>>>>>> Stashed changes

  return (
    <>
      {/* HERO BANNER */}
      <section className="g-hero">
        <div className="g-container g-hero-inner">
          <div className="g-hero-text">
            <span className="g-eyebrow">
              {tableNo
                ? `Bạn đang ngồi bàn ${tableNo}`
                : "Rang mộc · Pha tay · Mỗi ngày"}
            </span>

            <h1>
              Một ly cà phê
              <br />
              <em>đúng gu</em> của bạn.
            </h1>

            <p>
              Chọn món và đặt ngay — uống tại bàn, mang đi hay giao tận nơi.
            </p>

            <button
              className="g-cta"
              onClick={() =>
                document
                  .getElementById("menu")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Xem thực đơn
            </button>
          </div>

          <div className="g-hero-art" aria-hidden>
            <img
              src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=80"
              alt=""
            />
          </div>
        </div>
      </section>

      {/* KHUYEN MAI */}
      {!!menu?.orderPromotions.length && (
        <section className="g-container g-promos">
          {menu.orderPromotions.map((p) => (
            <div key={p.id} className="g-promo">
              <TagOutlined className="g-promo-icon" />

              <div>
                <strong>{p.name}</strong>

                <span>
                  {p.discountPercent
                    ? p.discountType === "FIXED_AMOUNT"
                      ? `Giảm ${money(p.discountPercent)}`
                      : `Giảm ${p.discountPercent}%`
                    : ""}

                  {p.minOrderAmount
                    ? ` cho đơn từ ${money(p.minOrderAmount)}`
                    : ""}

                  {" · đến "}
                  {date(p.endDate)}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* PRODUCT PLACEMENT + PRODUCT BUNDLE */}
      {/* Lay du lieu public tu app-stats */}
      <MerchandisingSections />

      {/* THUC DON HIEN TAI */}
      <section id="menu" className="g-container g-menu">
        <div className="g-menu-bar">
          <div className="g-chips">
            <button
              className={`g-chip ${active === null ? 'is-active' : ''}`}
              onClick={() => setActive(null)}
            >
              Tất cả
            </button>

            {allCategories.map((c) => (
              <button
                key={c.id}
<<<<<<< Updated upstream
                className={`g-chip ${
                  active === c.id ? 'is-active' : ''
                }`}
                onClick={() =>
                  setActive(active === c.id ? null : c.id)
                }
=======
                className={`g-chip ${active === c.id ? "is-active" : ""}`}
                onClick={() => jump(c.id)}
>>>>>>> Stashed changes
              >
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

          {/* BO LOC */}
          <div className="g-filters">
            <Select
              className="g-filter-select"
              value={price}
              options={PRICE_OPTIONS}
              onChange={setPrice}
            />

            <Select
              className="g-filter-select"
              value={sort}
              options={SORT_OPTIONS}
              onChange={setSort}
            />

            <Checkbox
              checked={onSale}
              onChange={(e) => setOnSale(e.target.checked)}
            >
              Đang giảm giá
            </Checkbox>

            <Checkbox
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
            >
              Còn hàng
            </Checkbox>

            {filtered && (
              <button
                type="button"
                className="g-filter-reset"
                onClick={resetFilters}
              >
                Xoá bộ lọc
              </button>
            )}
        </div>
        </div>

        {isLoading && <Skeleton active paragraph={{ rows: 8 }} />}

        {!isLoading && categories.length === 0 && (
          <Empty description="Không tìm thấy món phù hợp" />
        )}

        {categories.map((c) => (
<<<<<<< Updated upstream
          <section key={c.id} className="g-section">
=======
          <section
            key={c.id}
            className="g-section"
            ref={(el) => {
              sectionRefs.current[c.id] = el;
            }}
          >
>>>>>>> Stashed changes
            <div className="g-section-head">
              <h2>
                {c.name}
                <span className="g-section-count">
                  {c.coffees.length} món
                </span>
              </h2>

              {c.description && <p>{c.description}</p>}
            </div>

            {/* Mon trong danh muc hien thi dang cuon ngang */}
            <ScrollRow>
              {c.coffees.map((coffee) => (
                <CoffeeCard
                  key={coffee.id}
                  coffee={coffee}
<<<<<<< Updated upstream
                  soldOut={!coffee.available}
=======
                  soldOut={!coffee.available || addable(coffee.id) < 1}
>>>>>>> Stashed changes
                  onPick={() => setPicked(coffee)}
                  onQuickAdd={(photo) => quickAdd(coffee, photo)}
                />
              ))}
            </ScrollRow>
          </section>
        ))}
      </section>

      {/* MODAL THEM VAO GIO HANG */}
      <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
    </>
  );
}
