import { PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'

const FALLBACK = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80'

/** `soldOut` also covers stock already taken by the cart. */
export function CoffeeCard({ coffee, soldOut = !coffee.available, onPick }: { coffee: MenuCoffee; soldOut?: boolean; onPick: () => void }) {
  const onSale = coffee.salePrice != null && coffee.salePrice < coffee.price
  const off = onSale ? Math.round((1 - coffee.salePrice! / coffee.price) * 100) : 0
  return (
    <article className={`g-card ${soldOut ? 'is-out' : ''}`} onClick={soldOut ? undefined : onPick}>
      <div className="g-card-img">
        <img src={imageSrc(coffee.imageUrl) || FALLBACK} alt={coffee.name} loading="lazy" onError={(e) => { e.currentTarget.src = FALLBACK }} />
        {onSale && <span className="g-badge-sale">-{off}%</span>}
        {soldOut && <span className="g-badge-out">Tạm hết</span>}
      </div>
      <div className="g-card-body">
        <h3>{coffee.name}</h3>
        {coffee.description && <p>{coffee.description}</p>}
        <div className="g-card-foot">
          <div className="g-price">
            <span className="g-price-now">{money(onSale ? coffee.salePrice : coffee.price)}</span>
            {onSale && <span className="g-price-old">{money(coffee.price)}</span>}
          </div>
          <button
            className="g-add"
            disabled={soldOut}
            aria-label={`Thêm ${coffee.name}`}
            onClick={(e) => { e.stopPropagation(); onPick() }}
          >
            <PlusOutlined />
          </button>
        </div>
        {onSale && coffee.promotionName && <div className="g-card-promo">{coffee.promotionName}</div>}
      </div>
    </article>
  )
}
