import { useEffect, useMemo, useState } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Modal } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { upsellApi, type UpsellRule } from '@/api/upsell'
import { DEFAULT_IMAGE, imageSrc, money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'

const fallbackImage = DEFAULT_IMAGE

/** Shows product suggestions related to the product currently being viewed. */
export function UpsellSuggestions({ anchor, onPick }: { anchor: MenuCoffee; onPick: (coffee: MenuCoffee) => void }) {
  const { data = [] } = useQuery({ queryKey: ['upsell', anchor.id], queryFn: () => upsellApi.suggestions(anchor.id) })
  const [selected, setSelected] = useState<UpsellRule | null>(null)
  const impression = useMemo(() => crypto.randomUUID(), [anchor.id])

  useEffect(() => {
    for (const rule of data) upsellApi.event(rule.id, impression, 'IMPRESSION').catch(() => {})
  }, [data, impression])

  if (!data.length) return null

  const photo = (url?: string) => imageSrc(url) || fallbackImage
  const choose = (rule: UpsellRule) => {
    upsellApi.event(rule.id, impression, 'ACCEPT').catch(() => {})
    onPick({
      id: rule.upgradeCoffeeId,
      name: rule.upgradeName,
      description: rule.description,
      price: Number(rule.upgradePrice),
      imageUrl: rule.imageUrl,
      available: true,
    })
    setSelected(null)
  }

  return <>
    <section className="upsell-guest" aria-label="Gợi ý sản phẩm">
      <div className="upsell-guest-heading">
        <span className="upsell-kicker">GỢI Ý SẢN PHẨM</span>
        <strong>Sản phẩm gợi ý cho bạn</strong>
        <p>Tham khảo thêm sản phẩm được giới thiệu từ món bạn đang xem.</p>
      </div>
      <div className="upsell-current-choice">
        <img src={photo(anchor.imageUrl)} alt="" onError={e => { e.currentTarget.src = fallbackImage }} />
        <span><small>BẠN ĐANG XEM</small><strong>{anchor.name}</strong></span>
        <b>{money(anchor.price)}</b>
      </div>
      <div className="upsell-suggestion-list">
        {data.map(rule => <button
          type="button"
          key={rule.id}
          className="upsell-suggestion-card"
          onClick={() => setSelected(rule)}
          aria-haspopup="dialog"
        >
          <img
            className="upsell-suggestion-photo"
            src={photo(rule.imageUrl)}
            alt={rule.upgradeName}
            loading="lazy"
            onError={e => { e.currentTarget.src = fallbackImage }}
          />
          <span className="upsell-suggestion-copy">
            <small className="upsell-suggestion-label">SẢN PHẨM GỢI Ý</small>
            <strong>{rule.upgradeName}</strong>
            <span className="upsell-suggestion-description">{rule.description || 'Thông tin sản phẩm được giới thiệu từ món bạn đang xem.'}</span>
            <span className="upsell-suggestion-price">{money(Number(rule.upgradePrice))}</span>
          </span>
          <span className="upsell-action-link">Xem sản phẩm <ArrowRightOutlined /></span>
        </button>)}
      </div>
    </section>

    <Modal
      open={!!selected}
      onCancel={() => setSelected(null)}
      footer={null}
      centered
      width={540}
      zIndex={1200}
      className="upsell-detail-modal"
      destroyOnHidden
    >
      {selected && <div className="upsell-detail">
        <span className="upsell-kicker">GỢI Ý SẢN PHẨM</span>
        <h3>{selected.upgradeName}</h3>
        <p className="upsell-detail-intro">Thông tin sản phẩm được giới thiệu từ món bạn đang xem.</p>
        <div className="upsell-product-detail">
          <img src={photo(selected.imageUrl)} alt={selected.upgradeName} onError={e => { e.currentTarget.src = fallbackImage }} />
          <div>
            <small>SẢN PHẨM GỢI Ý</small>
            <strong>{selected.upgradeName}</strong>
            <span>{money(Number(selected.upgradePrice))}</span>
          </div>
        </div>
        {selected.description && <p className="upsell-suggestion-description">{selected.description}</p>}
        <button type="button" className="upsell-confirm" onClick={() => choose(selected)}>
          Chọn sản phẩm <span>{money(Number(selected.upgradePrice))}</span>
        </button>
        <button type="button" className="upsell-keep-current" onClick={() => setSelected(null)}>
          Tiếp tục với {anchor.name}
        </button>
      </div>}
    </Modal>
  </>
}
