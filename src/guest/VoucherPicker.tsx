import { useEffect, useState } from 'react'
import { Drawer, Empty, Input } from 'antd'
import { CheckCircleFilled, RightOutlined, TagOutlined } from '@ant-design/icons'
import { useVoucherOptions } from './voucherOptions'
import { date, money } from '@/lib/format'

/**
 * Checkout row "Voucher & khuyến mãi" + a sheet listing what can lower the order, like Shopee:
 * usable / not yet (with how much more to order), pick one voucher or type a code.
 * The server still decides on checkout (the quote validates the chosen code).
 */
export function VoucherPicker({ subtotal, applied, promotionName, voucherDiscount, onApply }: {
  subtotal: number
  /** code currently applied to the quote */
  applied?: string
  /** order promotion the quote applied, if any */
  promotionName?: string
  voucherDiscount?: number
  onApply: (code?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | undefined>(applied)
  const [typed, setTyped] = useState('')
  const { vouchers, promotions } = useVoucherOptions()
  useEffect(() => { if (open) { setPicked(applied); setTyped('') } }, [open, applied])

  const missing = (min?: number) => Math.max(0, (min ?? 0) - subtotal)
  const sorted = [...vouchers].sort((a, b) => Number(missing(a.minOrderValue) > 0) - Number(missing(b.minOrderValue) > 0) || b.discountValue - a.discountValue)
  const confirm = (code?: string) => { onApply(code); setOpen(false) }

  return (
    <>
      <button type="button" className="g-voucher-row" onClick={() => setOpen(true)}>
        <TagOutlined />
        <span className="g-voucher-row-label">Voucher & khuyến mãi</span>
        <span className="g-voucher-row-value">
          {applied
            ? <b>{applied}{voucherDiscount ? ` · -${money(voucherDiscount)}` : ''}</b>
            : vouchers.length ? `${vouchers.length} voucher` : 'Chọn hoặc nhập mã'}
        </span>
        <RightOutlined />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} placement="right" width={440} className="g-drawer" title="Voucher & khuyến mãi"
        footer={(
          <div className="g-voucher-foot">
            <button type="button" className="g-btn-ghost" onClick={() => confirm(undefined)} disabled={!applied && !picked}>Bỏ chọn</button>
            <button type="button" className="g-cta" onClick={() => confirm(picked)}>Đồng ý</button>
          </div>
        )}>
        <div className="g-voucher">
          <Input placeholder="Nhập mã voucher" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase().trim())}
            onPressEnter={() => typed && confirm(typed)} />
          <button type="button" className="g-btn-ghost" disabled={!typed} onClick={() => confirm(typed)}>Áp dụng</button>
        </div>

        {!!promotions.length && <div className="g-offer-title">Khuyến mãi của cửa hàng <small>tự áp dụng khi đủ điều kiện</small></div>}
        {promotions.map((p) => {
          const need = missing(p.minOrderAmount)
          const on = promotionName === p.name
          return (
            <div key={p.id} className={`g-offer ${need > 0 ? 'is-off' : ''}`}>
              <div className="g-offer-badge is-promo">{p.discountPercent ? `-${p.discountPercent}%` : 'KM'}</div>
              <div className="g-offer-body">
                <b>{p.name}</b>
                <span>{p.minOrderAmount ? `Đơn từ ${money(p.minOrderAmount)}` : 'Mọi đơn hàng'} · HSD {date(p.endDate)}</span>
                {need > 0 ? <em>Mua thêm {money(need)} để được giảm</em> : on && <em className="is-on">Đang áp dụng cho đơn này</em>}
              </div>
              {on && <CheckCircleFilled className="g-offer-check" />}
            </div>
          )
        })}

        <div className="g-offer-title">Voucher của bạn</div>
        {!sorted.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có voucher — nhập mã ở trên nếu bạn có" />}
        {sorted.map((v) => {
          const need = missing(v.minOrderValue)
          const sel = picked === v.code
          return (
            <button type="button" key={v.code} disabled={need > 0} onClick={() => setPicked(sel ? undefined : v.code)}
              className={`g-offer ${need > 0 ? 'is-off' : ''} ${sel ? 'is-picked' : ''}`}>
              <div className="g-offer-badge">-{money(v.discountValue)}</div>
              <div className="g-offer-body">
                <b>{v.code}</b>
                <span>{v.minOrderValue ? `Đơn từ ${money(v.minOrderValue)}` : 'Mọi đơn hàng'}{v.expiresAt ? ` · HSD ${date(v.expiresAt)}` : ''}</span>
                {need > 0 && <em>Mua thêm {money(need)} để dùng</em>}
              </div>
              <span className={`g-offer-radio ${sel ? 'is-on' : ''}`} />
            </button>
          )
        })}
      </Drawer>
    </>
  )
}
