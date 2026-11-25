import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Checkbox, Empty, Input, Radio, Select, Skeleton } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

import { publicApi } from '@/api/public'
import { merchandisingApi, type Bundle } from '@/api/merchandising'
import type { MenuCoffee } from '@/api/types'
import { flyToCart } from '@/lib/flyToCart'

import { AddToCartModal } from './AddToCartModal'
import { CoffeeCard } from './CoffeeCard'
import { BundleCard, BundleModal } from './ComboCards'
import { sellableBundles } from './bundles'
import { useCart } from './useCart'

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name'
type PriceKey = 'all' | 'lt30' | '30to50' | 'gt50'
/** a category id, or the combos */
type CategoryKey = number | 'combo' | null

const PRICE_OPTIONS: { value: PriceKey; label: string }[] = [
  { value: 'all', label: 'Mọi mức giá' },
  { value: 'lt30', label: 'Dưới 30.000đ' },
  { value: '30to50', label: '30.000đ – 50.000đ' },
  { value: 'gt50', label: 'Trên 50.000đ' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Mặc định' },
  { value: 'price-asc', label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' },
  { value: 'name', label: 'Tên A → Z' },
]

// what the guest actually pays (sale price first)
const finalPrice = (c: MenuCoffee) => c.salePrice ?? c.price

const inPriceRange = (p: number, key: PriceKey) => {
  if (key === 'lt30') return p < 30000
  if (key === '30to50') return p >= 30000 && p <= 50000
  if (key === 'gt50') return p > 50000
  return true
}

function sortBy<T>(list: T[], sort: SortKey, price: (x: T) => number, name: (x: T) => string) {
  if (sort === 'price-asc') list.sort((a, b) => price(a) - price(b))
  if (sort === 'price-desc') list.sort((a, b) => price(b) - price(a))
  if (sort === 'name') list.sort((a, b) => name(a).localeCompare(name(b), 'vi'))
  return list
}

/**
 * Thực đơn: filters in a column on the left (on top on phones) and the products — every category's coffees,
 * then the combos as one more category. Banners live on the home page.
 */
export function MenuPage() {
  const { data: menu, isLoading } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const bundleQuery = useQuery({ queryKey: ['merch-public-bundles'], queryFn: merchandisingApi.publicBundles, retry: 1 })

  const [search, setSearch] = useState('')
  const [active, setActive] = useState<CategoryKey>(null)
  const [price, setPrice] = useState<PriceKey>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [onSale, setOnSale] = useState(false)
  const [inStock, setInStock] = useState(false)
  const [picked, setPicked] = useState<MenuCoffee | null>(null)
  const [pickedBundle, setPickedBundle] = useState<Bundle | null>(null)
  const { add } = useCart()

  const quickAdd = (coffee: MenuCoffee, photo: HTMLImageElement | null) => {
    flyToCart(photo, photo?.currentSrc)
    add.mutate({ coffeeId: coffee.id, quantity: 1 })
  }

  const allCategories = menu?.categories ?? []
  const allBundles = useMemo(() => sellableBundles(bundleQuery.data), [bundleQuery.data])
  const q = search.trim().toLowerCase()

  const categories = useMemo(() => (menu?.categories ?? [])
    .filter((c) => active === null || c.id === active)
    .map((c) => ({
      ...c,
      coffees: sortBy(c.coffees.filter((x) =>
        (!q || x.name.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q))
        && inPriceRange(finalPrice(x), price)
        && (!onSale || x.salePrice != null)
        && (!inStock || x.available)), sort, finalPrice, (x) => x.name),
    }))
    .filter((c) => c.coffees.length > 0), [menu, q, active, price, sort, onSale, inStock])

  // combos are always buyable here (sellableBundles); "đang giảm giá" = cheaper than buying the drinks one by one
  const bundles = useMemo(() => (active === null || active === 'combo')
    ? sortBy(allBundles.filter((b) =>
      (!q || b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q)
        || b.items.some((i) => i.coffee.name.toLowerCase().includes(q)))
      && inPriceRange(b.bundlePrice, price)
      && (!onSale || b.savingAmount > 0)), sort, (b) => b.bundlePrice, (b) => b.name)
    : [], [allBundles, active, q, price, sort, onSale])

  const total = categories.reduce((n, c) => n + c.coffees.length, 0) + bundles.length
  const filtered = !!q || active !== null || price !== 'all' || sort !== 'default' || onSale || inStock
  const resetFilters = () => {
    setSearch('')
    setActive(null)
    setPrice('all')
    setSort('default')
    setOnSale(false)
    setInStock(false)
  }
  const chip = (key: CategoryKey, label: string) => (
    <button key={String(key)} type="button" className={`g-side-cat ${active === key ? 'is-active' : ''}`}
      onClick={() => setActive(active === key && key !== null ? null : key)}>
      {label}
    </button>
  )

  return (
    <>
      <section className="g-container g-menu-page">
        <div className="g-menu-title">
          <h1>Thực đơn</h1>
          {!isLoading && <span>{total} sản phẩm</span>}
        </div>

        <div className="g-menu-layout">
          <aside className="g-menu-side">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm món, combo…" className="g-search"
              value={search} onChange={(e) => setSearch(e.target.value)} />

            <div className="g-side-block">
              <h4>Danh mục</h4>
              <div className="g-side-cats">
                {chip(null, 'Tất cả')}
                {allCategories.map((c) => chip(c.id, c.name))}
                {allBundles.length > 0 && chip('combo', 'Combo')}
              </div>
            </div>

            <div className="g-side-block">
              <h4>Mức giá</h4>
              <Radio.Group className="g-side-radios" value={price} onChange={(e) => setPrice(e.target.value)} options={PRICE_OPTIONS} />
            </div>

            <div className="g-side-block">
              <h4>Sắp xếp</h4>
              <Select className="g-side-select" value={sort} options={SORT_OPTIONS} onChange={setSort} />
            </div>

            <div className="g-side-block g-side-checks">
              <Checkbox checked={onSale} onChange={(e) => setOnSale(e.target.checked)}>Đang giảm giá</Checkbox>
              <Checkbox checked={inStock} onChange={(e) => setInStock(e.target.checked)}>Còn hàng</Checkbox>
            </div>

            {filtered && <button type="button" className="g-filter-reset" onClick={resetFilters}>Xoá bộ lọc</button>}
          </aside>

          <div className="g-menu-main">
            {isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
            {!isLoading && total === 0 && <Empty description="Không tìm thấy món phù hợp" />}

            {categories.map((c) => (
              <section key={c.id} className="g-section">
                <div className="g-section-head">
                  <h2>{c.name}<span className="g-section-count">{c.coffees.length} món</span></h2>
                  {c.description && <p>{c.description}</p>}
                </div>
                <div className="g-grid">
                  {c.coffees.map((coffee) => (
                    <CoffeeCard key={coffee.id} coffee={coffee} soldOut={!coffee.available}
                      onPick={() => setPicked(coffee)} onQuickAdd={(photo) => quickAdd(coffee, photo)} />
                  ))}
                </div>
              </section>
            ))}

            {bundles.length > 0 && (
              <section className="g-section">
                <div className="g-section-head">
                  <h2>Combo<span className="g-section-count">{bundles.length} combo</span></h2>
                  <p>Kết hợp nhiều món, giá rẻ hơn mua lẻ.</p>
                </div>
                <div className="g-grid">
                  {bundles.map((b) => <BundleCard key={b.id} bundle={b} onOpen={() => setPickedBundle(b)} />)}
                </div>
              </section>
            )}
          </div>
        </div>
      </section>

      <AddToCartModal coffee={picked} onClose={() => setPicked(null)} />
      <BundleModal bundle={pickedBundle} onClose={() => setPickedBundle(null)} />
    </>
  )
}
