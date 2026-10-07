import { useEffect, useState } from 'react'
import { Input, Modal } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
import { useCart } from './useCart'
import { useAddableCups } from '@/lib/stock'

const QUICK_NOTES = ['Ít đá', 'Không đá', 'Ít đường', 'Không đường', 'Nhiều sữa', 'Đá riêng']

export function AddToCartModal({ coffee, onClose }: { coffee: MenuCoffee | null; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const { add, lines } = useCart()
  const addableOf = useAddableCups(lines)

  useEffect(() => {
    if (coffee) { setQty(1); setTags([]); setNote('') }
  }, [coffee])

  if (!coffee) return null
  const unit = coffee.salePrice != null && coffee.salePrice < coffee.price ? coffee.salePrice : coffee.price
  const max = Math.min(99, addableOf(coffee.id))
  const fullNote = [...tags, note.trim()].filter(Boolean).join(', ')

  const submit = () =>
    add.mutate({ coffeeId: coffee.id, quantity: qty, note: fullNote || undefined }, { onSuccess: onClose })

  return (
    <Modal open onCancel={onClose} footer={null} width={460} className="g-modal" centered destroyOnHidden>
      {coffee.imageUrl && <img className="g-modal-img" src={imageSrc(coffee.imageUrl)} alt={coffee.name} />}
      <div className="g-modal-body">
        <h3>{coffee.name}</h3>
        {coffee.description && <p className="g-muted">{coffee.description}</p>}

        <div className="g-label">Tùy chỉnh</div>
        <div className="g-note-tags">
          {QUICK_NOTES.map((t) => (
            <button
              key={t}
              className={`g-tag ${tags.includes(t) ? 'is-on' : ''}`}
              onClick={() => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
            >
              {t}
            </button>
          ))}
        </div>
        <Input.TextArea
          rows={2}
          maxLength={150}
          placeholder="Ghi chú thêm cho barista…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {max < 10 && max > 0 && <p className="g-stock-hint">Chỉ còn pha được {max} ly</p>}
        <div className="g-modal-foot">
          <div className="g-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm"><MinusOutlined /></button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Tăng"><PlusOutlined /></button>
          </div>
          <button className="g-cta g-cta-block" onClick={submit} disabled={add.isPending || max < 1}>
            {max < 1 ? 'Đã hết nguyên liệu' : `Thêm vào giỏ · ${money(unit * qty)}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
