import { useEffect, useState } from 'react'
import { Input, Modal, Tag } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'
import { flyToCart } from '@/lib/flyToCart'

/** Lời dặn hay gặp ở quầy; the bar still makes the drink by its recipe, the note only tells how to serve it. */
const QUICK_NOTES = ['Ít đá', 'Không đá', 'Đá riêng', 'Ít ngọt', 'Không đường']

/**
 * One size, no options: a coffee is made by its recipe, the guest picks how many and may leave a note (ít đá, ít ngọt…).
 * Cups with a different note are a separate line in the cart.
 */
export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const { add, lines } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) {
      setQty(1)
      setNote('')
    }
  }, [coffee])

  const parts = note.split(',').map((s) => s.trim()).filter(Boolean)
  const toggle = (q: string) => setNote((parts.includes(q) ? parts.filter((p) => p !== q) : [...parts, q]).join(', '))

  if (!coffee) return null
  const unit = coffee.salePrice != null && coffee.salePrice < coffee.price ? coffee.salePrice : coffee.price
  const max = Math.min(99, addableOf(coffee.id))

  // close at once and let the request run in the background; the photo flies into the cart
  const submit = () => {
    flyToCart(document.querySelector('.g-modal-img'), imageSrc(coffee.imageUrl))
    add.mutate({ coffeeId: coffee.id, quantity: qty, note: note.trim() || undefined })
    onClose()
  }

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      {coffee.imageUrl && <img className="g-modal-img" src={imageSrc(coffee.imageUrl)} alt={coffee.name} />}
      <div className="g-modal-body">
        <h3>{coffee.name}</h3>
        {coffee.description && <p className="g-muted">{coffee.description}</p>}

        {max < 10 && max > 0 && <p className="g-stock-hint">Chỉ còn pha được {max} ly</p>}
        <div className="g-note-picker">
          {QUICK_NOTES.map((q) => (
            <Tag.CheckableTag key={q} checked={parts.includes(q)} onChange={() => toggle(q)}>{q}</Tag.CheckableTag>
          ))}
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} allowClear
            placeholder="Ghi chú cho món (không bắt buộc)" aria-label="Ghi chú cho món" />
        </div>
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
