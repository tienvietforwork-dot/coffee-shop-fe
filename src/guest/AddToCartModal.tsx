import { useEffect, useState } from 'react'
import { Modal } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'
import { flyToCart } from '@/lib/flyToCart'

/** One size, no options: a coffee is made exactly by its recipe, the guest only picks how many. */
export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const { add, lines } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) setQty(1)
  }, [coffee])

  if (!coffee) return null
  const unit = coffee.salePrice != null && coffee.salePrice < coffee.price ? coffee.salePrice : coffee.price
  const max = Math.min(99, addableOf(coffee.id))

  // close at once and let the request run in the background; the photo flies into the cart
  const submit = () => {
    flyToCart(document.querySelector('.g-modal-img'), imageSrc(coffee.imageUrl))
    add.mutate({ coffeeId: coffee.id, quantity: qty })
    onClose()
  }

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      {coffee.imageUrl && <img className="g-modal-img" src={imageSrc(coffee.imageUrl)} alt={coffee.name} />}
      <div className="g-modal-body">
        <h3>{coffee.name}</h3>
        {coffee.description && <p className="g-muted">{coffee.description}</p>}

        {max < 10 && max > 0 && <p className="g-stock-hint">Chỉ còn pha được {max} ly</p>}
        <div className="g-modal-foot">
          <div className="g-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm"><MinusOutlined /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Tăng"><PlusOutlined /></button>
          </div>
          <button className="g-cta g-cta-block" onClick={submit} disabled={max < 1}>
            {max < 1 ? 'Đã hết nguyên liệu' : `Thêm vào giỏ · ${money(unit * qty)}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
