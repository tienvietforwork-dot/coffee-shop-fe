import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { App, Alert, DatePicker, Form, Input, Radio, Spin, Tooltip } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, ExclamationCircleFilled, MinusOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { OrderType, PaymentMethod } from '@/api/types'
import { money } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { useDeliveryArea } from '@/lib/useDeliveryArea'
import { AddressBook, type DeliveryPick } from './AddressBook'
import { isCompleteVnAddress } from '@/lib/vnAddress'
import { useCart } from './useCart'
import { VoucherPicker } from './VoucherPicker'
import { useGuestStore } from '@/store/guestStore'
import { useAuthStore } from '@/store/authStore'

const PAYMENTS: { value: PaymentMethod; title: string; desc: string }[] = [
  { value: 'CASH', title: 'Tiền mặt', desc: 'Thanh toán khi nhận đồ uống' },
  { value: 'E_WALLET', title: 'Ví điện tử', desc: 'MoMo / ZaloPay / VNPay' },
  { value: 'BANK_TRANSFER', title: 'Chuyển khoản', desc: 'QR ngân hàng' },
  { value: 'CARD', title: 'Thẻ', desc: 'Visa / Mastercard / ATM' },
]

/** giờ mở cửa "HH:mm[:ss]" → kiểm tra một thời điểm (đóng sau nửa đêm khi close < open) */
function openingHours(open?: string, close?: string) {
  if (!open || !close) return null
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const o = toMin(open), c = toMin(close)
  return {
    label: `${open.slice(0, 5)}–${close.slice(0, 5)}`,
    isOpen: (d: Dayjs) => { const m = d.hour() * 60 + d.minute(); return c > o ? m >= o && m < c : m >= o || m < c },
  }
}

export function CheckoutPage() {
  const { cart, loading, update, remove, removeBundle } = useCart()
  const store = useGuestStore()
  const authUser = useAuthStore((s) => s.user)
  const isCustomer = !!authUser?.customerId
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [orderType, setOrderType] = useState<OrderType>(store.tableQr ? 'DINE_IN' : 'TAKE_AWAY')
  // the voucher picked in the cart (or here) is remembered with the cart
  const appliedVoucher = store.voucherCode ?? undefined
  const setAppliedVoucher = (code?: string) => store.setVoucher(code ?? null)
  const phone = Form.useWatch('customerPhone', form) as string | undefined
  // phí ship theo km từ quán: đo khi khách ngừng gõ địa chỉ
  // địa chỉ nhận hàng (sổ địa chỉ kiểu Shopee)
  const [pick, setPick] = useState<DeliveryPick>()
  const rawAddress = pick?.address
  const typed = useDebounced(rawAddress?.trim() || undefined)
  const address = isCompleteVnAddress(typed) ? typed : undefined
  const deliveryAddress = orderType === 'DELIVERY' ? address : undefined
  const { data: shipping } = useQuery({ queryKey: ['delivery-settings-public'], queryFn: publicApi.deliverySettings, staleTime: 5 * 60_000 })
  // chọn xong tỉnh + phường đã biết có ngoài khu vực giao không
  const area = useDeliveryArea(orderType === 'DELIVERY' ? rawAddress : undefined)
  // giờ hẹn nhận / giao: chỉ trong giờ mở cửa; phí ship theo khung giờ của giờ hẹn
  const pickupTime = Form.useWatch('pickupTime', form) as Dayjs | undefined
  const deliveryTime = orderType === 'DELIVERY' && pickupTime ? pickupTime.format('YYYY-MM-DDTHH:mm:ss') : undefined
  const hours = openingHours(shipping?.openTime, shipping?.closeTime)
  const closedNow = !!hours && !hours.isOpen(dayjs())

  const quote = useQuery({
    queryKey: ['quote', cart?.sessionCode, cart?.subtotal, orderType, appliedVoucher, appliedVoucher ? phone : null, deliveryAddress, deliveryTime],
    enabled: !!cart && (cart.items.length > 0 || !!cart.bundles?.length),
    retry: false,
    queryFn: () =>
      publicApi.quote(cart!.sessionCode, { orderType, voucherCode: appliedVoucher, customerPhone: phone || undefined, deliveryAddress, deliveryTime }),
  })

  useEffect(() => {
    if (quote.data?.voucherMessage) message.warning(quote.data.voucherMessage)
  }, [quote.data?.voucherMessage, message])

  const checkout = useMutation({
    mutationFn: publicApi.checkout,
    onSuccess: (order) => {
      store.addOrder(order.orderCode)
      store.setCart(null)
      store.setVoucher(null)
      navigate(`/order/${order.orderCode}`, { replace: true })
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  const types = useMemo(
    () => [
      ...(store.tableQr ? [{ value: 'DINE_IN' as const, label: `Tại bàn ${store.tableNo}` }] : []),
      { value: 'TAKE_AWAY' as const, label: 'Mang về' },
      { value: 'DELIVERY' as const, label: 'Giao hàng' },
    ],
    [store.tableQr, store.tableNo],
  )
  // đơn giao tối thiểu: tiền hàng (sau giảm giá) chưa đạt thì khóa "Giao hàng" ngay từ đầu
  const minDelivery = shipping?.minOrderAmount ?? undefined
  const goods = quote.data ? quote.data.total - quote.data.shippingFee : cart?.subtotal ?? 0
  const belowMin = !!minDelivery && goods < minDelivery
  useEffect(() => {
    if (belowMin && orderType === 'DELIVERY') setOrderType(store.tableQr ? 'DINE_IN' : 'TAKE_AWAY')
  }, [belowMin, orderType, store.tableQr])

  if (loading) return <div className="g-container g-page"><Spin /></div>
  if (!cart || (cart.items.length === 0 && !cart.bundles?.length)) {
    return (
      <div className="g-container g-page g-center">
        <h2>Giỏ hàng đang trống</h2>
        <Link to="/" className="g-cta">Chọn món ngay</Link>
      </div>
    )
  }

  const submit = (v: { customerPhone?: string; pickupTime?: Dayjs; paymentMethod: PaymentMethod; note?: string }) => {
    const delivery = orderType === 'DELIVERY' && pick ? pick : undefined
    store.setContact(delivery ? delivery.recipientName : store.name ?? '', v.customerPhone || delivery?.recipientPhone || '')
    checkout.mutate({
      sessionCode: cart.sessionCode,
      orderType,
      customerName: delivery?.recipientName,
      // số tích điểm; giao hàng mà để trống thì tích cho SĐT người nhận
      customerPhone: v.customerPhone || delivery?.recipientPhone,
      addressId: isCustomer ? delivery?.id : undefined,
      delivery: delivery
        ? { recipientName: delivery.recipientName, recipientPhone: delivery.recipientPhone, address: delivery.address }
        : undefined,
      pickupTime: v.pickupTime ? v.pickupTime.format('YYYY-MM-DDTHH:mm:ss') : undefined,
      paymentMethod: v.paymentMethod,
      voucherCode: quote.data?.voucherMessage ? undefined : appliedVoucher,
      note: v.note || undefined,
    })
  }

  const q = quote.data
  // dự kiến: giờ hẹn (hoặc bây giờ khi "Sớm nhất") + thời gian pha chế các món (+ km ÷ tốc độ km/h khi giao)
  const prepMin = q?.prepMinutes ?? 0
  const travelMin = orderType === 'DELIVERY' && deliveryAddress && q?.deliveryDistanceKm != null && shipping?.speedKmh
    ? Math.max(1, Math.round(q.deliveryDistanceKm / shipping.speedKmh * 60)) : undefined
  const at = (d: Dayjs) => d.format(d.isSame(dayjs(), 'day') ? 'HH:mm' : 'HH:mm DD/MM')
  const eta = (from: Dayjs, min: number) => `${at(from.add(min, 'minute'))} (${min} phút)`
  // hẹn giờ: quán canh giờ pha + chạy xe để giao đúng giờ hẹn (chỉ trễ hơn khi giờ hẹn quá sát bây giờ)
  const earliest = dayjs().add(prepMin + (travelMin ?? 0), 'minute')
  const timeHint = orderType === 'DELIVERY'
    ? travelMin != null && (pickupTime
      ? `Dự kiến nhận hàng: ${at(pickupTime.isBefore(earliest) ? earliest : pickupTime)}`
      : `Dự kiến nhận hàng: ${eta(dayjs(), prepMin + travelMin)}`)
    : pickupTime ? `Hẹn nhận lúc ${at(pickupTime)}`
    : prepMin > 0 ? `Dự kiến xong: ${eta(dayjs(), prepMin)}` : undefined
  return (
    <div className="g-container g-page">
      <Link to="/" className="g-back"><ArrowLeftOutlined /> Tiếp tục chọn món</Link>
      <h1 className="g-page-title">Đặt hàng</h1>
      <div className="g-checkout">
        <Form
          form={form}
          layout="vertical"
          className="g-panel"
          initialValues={{
            customerPhone: isCustomer ? authUser?.phone ?? authUser?.username : store.phone,
            paymentMethod: 'CASH',
          }}
          onFinish={submit}
          requiredMark={false}
        >
          <h3>1. Hình thức nhận</h3>
          <div className="g-seg">
            {types.map((t) => (
              <button type="button" key={t.value} className={orderType === t.value ? 'is-on' : ''} onClick={() => setOrderType(t.value)}
                disabled={t.value === 'DELIVERY' && belowMin} style={t.value === 'DELIVERY' && belowMin ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
                {t.label}
              </button>
            ))}
          </div>
          {belowMin && <div className="g-muted" style={{ marginTop: 6 }}>Giao hàng cho đơn từ {money(minDelivery!)}</div>}

          <h3>2. Tích điểm</h3>
          <Form.Item name="customerPhone" label="Số điện thoại tích điểm"
            rules={[{ pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
            <Input placeholder="09xx xxx xxx" inputMode="tel" disabled={isCustomer} />
          </Form.Item>

          {orderType === 'DELIVERY' && (
            <>
              <h3>Địa chỉ nhận hàng</h3>
              {shipping?.shopAddress && <div className="g-muted" style={{ marginBottom: 8 }}>Quán: {shipping.shopAddress}</div>}
              <AddressBook value={pick} onChange={setPick} loggedIn={isCustomer}
                prefill={{ recipientName: isCustomer ? authUser?.fullName : store.name, recipientPhone: isCustomer ? authUser?.phone ?? authUser?.username : store.phone }} />
              <div style={{ margin: '6px 0 16px', fontSize: 13 }}>
                {area?.outside ? <span style={{ color: '#cf1322' }}>{area.message ?? 'Ngoài khu vực giao hàng'}</span>
                  : quote.isError && deliveryAddress ? <span style={{ color: '#cf1322' }}>{errorMessage(quote.error)}</span>
                  : quote.data?.deliveryZone ? <span className="g-muted">Giao tới {quote.data.deliveryZone}</span> : null}
              </div>
            </>
          )}
          {orderType !== 'DINE_IN' && (
            <Form.Item name="pickupTime"
              label={<>
                {orderType === 'DELIVERY' ? 'Giao lúc' : 'Nhận lúc'}
                {hours && <span className="g-muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>Mở cửa {hours.label}</span>}
              </>}
              rules={[{ required: closedNow, message: 'Quán đang đóng cửa — chọn giờ hẹn' }]}
              extra={timeHint || undefined}>
              <DatePicker
                placeholder={closedNow ? 'Chọn giờ hẹn' : 'Sớm nhất'}
                showTime={{ format: 'HH:mm', minuteStep: 15, hideDisabledOptions: true }}
                format="HH:mm DD/MM"
                disabledDate={(d) => d.isBefore(dayjs().startOf('day')) || d.isAfter(dayjs().add(2, 'day'))}
                disabledTime={(d) => ({
                  disabledHours: () => Array.from({ length: 24 }, (_, h) => h).filter((h) => !Array.from({ length: 4 }, (_, q) => (d ?? dayjs()).hour(h).minute(q * 15)).some((x) => (!hours || hours.isOpen(x)) && x.isAfter(dayjs()))),
                  disabledMinutes: (h) => Array.from({ length: 60 }, (_, m) => m).filter((m) => { const x = (d ?? dayjs()).hour(h).minute(m); return (!!hours && !hours.isOpen(x)) || !x.isAfter(dayjs()) }),
                })}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
          <Form.Item name="note" label="Ghi chú cho cửa hàng">
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>

          <h3>3. Thanh toán</h3>
          <Form.Item name="paymentMethod">
            <Radio.Group className="g-pay">
              {PAYMENTS.map((p) => (
                <Radio.Button key={p.value} value={p.value}>
                  <strong>{p.title}</strong>
                  <span>{p.desc}</span>
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>

        <aside className="g-panel g-summary">
          <h3>Đơn của bạn</h3>
          <ul className="g-sum-lines">
            {cart.items.map((i, idx) => {
              // quote lines follow the cart items in order (combo lines come after): promo price of this item
              const ql = q?.lines[idx]
              const l = ql && ql.coffeeId === i.coffeeId && ql.quantity === i.quantity ? ql : undefined
              return (
                <li key={i.id} style={{ alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>
                    {i.coffeeName}
                    {i.note && <small>{i.note}</small>}
                  </span>
                  <div className="g-stepper g-stepper-sm">
                    <button type="button" aria-label="Giảm"
                      onClick={() => (i.quantity > 1 ? update.mutate({ itemId: i.id, quantity: i.quantity - 1, note: i.note }) : remove.mutate(i.id))}>
                      <MinusOutlined />
                    </button>
                    <span>{i.quantity}</span>
                    <button type="button" aria-label="Tăng" disabled={i.quantity >= 99}
                      onClick={() => update.mutate({ itemId: i.id, quantity: i.quantity + 1, note: i.note })}>
                      <PlusOutlined />
                    </button>
                  </div>
                  <span style={{ minWidth: 84, textAlign: 'right' }}>
                    {l && l.unitPrice < l.listPrice && <s>{money(l.listPrice * l.quantity)}</s>}
                    {money(l?.lineTotal ?? i.subtotal)}
                  </span>
                  <button type="button" className="g-icon-btn" aria-label="Xóa" onClick={() => remove.mutate(i.id)}><DeleteOutlined /></button>
                </li>
              )
            })}
            {(cart.bundles ?? []).map((b) => (
              <li key={`bundle-${b.id}`} style={{ alignItems: 'center' }}>
                <span style={{ flex: 1 }}>
                  <b>{b.quantity}×</b> 🎁 {b.name}
                  {b.components?.map((component) => <small key={`${b.id}-${component.coffeeId}`} style={{ display: 'block', color: '#8b7567' }}>
                    {component.quantity * b.quantity} × {component.name}{component.choiceGroup ? ` · ${component.choiceGroup}` : ''}
                  </small>)}
                </span>
                <span>{money(b.total)}</span>
                <button type="button" className="g-icon-btn" aria-label="Xóa combo" onClick={() => removeBundle.mutate(b.id)}><DeleteOutlined /></button>
              </li>
            ))}
          </ul>

          <VoucherPicker subtotal={q?.subtotal ?? cart.subtotal} applied={appliedVoucher} promotionName={q?.promotionName}
            voucherDiscount={q?.voucherDiscount} onApply={setAppliedVoucher} />
          {q?.voucherMessage && <Alert type="warning" showIcon message={q.voucherMessage} />}

          <div className="g-totals">
            <div className="g-row"><span>Tạm tính</span><span>{money(q?.subtotal ?? cart.subtotal)}</span></div>
            {!!q?.promotionDiscount && (
              <div className="g-row g-green"><span>{q.promotionName}</span><span>-{money(q.promotionDiscount)}</span></div>
            )}
            {!!q?.voucherDiscount && (
              <div className="g-row g-green"><span>Voucher {q.voucherCode}</span><span>-{money(q.voucherDiscount)}</span></div>
            )}
            {orderType === 'DELIVERY' && q?.deliveryZone && (
              <>
                <div className="g-row">
                  <span>
                    Phí giao hàng
                    {q.deliveryNote && <Tooltip title={q.deliveryNote}><ExclamationCircleFilled style={{ color: '#fa8c16', marginLeft: 6 }} /></Tooltip>}
                  </span>
                  <span>{q.shippingFee ? money(q.shippingFee) : 'Miễn phí'}</span>
                </div>
                {!!shipping?.freeShipThreshold && (
                  <div className="g-muted" style={{ fontSize: 12, marginTop: -4 }}>
                    Miễn phí giao hàng cho đơn từ {money(shipping.freeShipThreshold)}
                    {goods < shipping.freeShipThreshold && <> · <Link to="/" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Mua thêm {money(shipping.freeShipThreshold - goods)} ›</Link></>}
                  </div>
                )}
                {q.deliveryNote && <div className="g-muted" style={{ fontSize: 12, color: '#d46b08' }}><ExclamationCircleFilled /> {q.deliveryNote}</div>}
              </>
            )}
            <div className="g-row g-total"><span>Tổng cộng</span><span>{money(q?.total ?? cart.subtotal)}</span></div>
          </div>

          {!!q?.unavailableItems.length && (
            <Alert type="error" showIcon message={`Món đã hết: ${q.unavailableItems.join(', ')}`} />
          )}
          <button
            className="g-cta g-cta-block"
            disabled={checkout.isPending || quote.isFetching || !!q?.unavailableItems.length || (orderType === 'DELIVERY' && (!deliveryAddress || quote.isError || !!area?.outside))}
            onClick={() => form.submit()}
          >
            {checkout.isPending ? 'Đang gửi đơn…' : orderType === 'DELIVERY' && !deliveryAddress ? 'Nhập địa chỉ giao hàng' : `Xác nhận đặt hàng · ${money(q?.total ?? cart.subtotal)}`}
          </button>
        </aside>
      </div>
    </div>
  )
}
