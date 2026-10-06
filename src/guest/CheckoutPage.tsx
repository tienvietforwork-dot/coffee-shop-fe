import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { App, Alert, DatePicker, Form, Input, Radio, Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { OrderType, PaymentMethod } from '@/api/types'
import { money } from '@/lib/format'
import { useCart } from './useCart'
import { useGuestStore } from '@/store/guestStore'
import { useAuthStore } from '@/store/authStore'

const PAYMENTS: { value: PaymentMethod; title: string; desc: string }[] = [
  { value: 'CASH', title: 'Tiền mặt', desc: 'Thanh toán khi nhận đồ uống' },
  { value: 'E_WALLET', title: 'Ví điện tử', desc: 'MoMo / ZaloPay / VNPay' },
  { value: 'BANK_TRANSFER', title: 'Chuyển khoản', desc: 'QR ngân hàng' },
  { value: 'CARD', title: 'Thẻ', desc: 'Visa / Mastercard / ATM' },
]

export function CheckoutPage() {
  const { cart, loading } = useCart()
  const store = useGuestStore()
  const authUser = useAuthStore((s) => s.user)
  const isCustomer = !!authUser?.customerId
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [orderType, setOrderType] = useState<OrderType>(store.tableQr ? 'DINE_IN' : 'TAKE_AWAY')
  const [voucher, setVoucher] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<string | undefined>()
  const phone = Form.useWatch('customerPhone', form) as string | undefined

  const quote = useQuery({
    queryKey: ['quote', cart?.sessionCode, cart?.subtotal, orderType, appliedVoucher, appliedVoucher ? phone : null],
    enabled: !!cart && cart.items.length > 0,
    queryFn: () =>
      publicApi.quote(cart!.sessionCode, { orderType, voucherCode: appliedVoucher, customerPhone: phone || undefined }),
  })

  useEffect(() => {
    if (quote.data?.voucherMessage) message.warning(quote.data.voucherMessage)
  }, [quote.data?.voucherMessage, message])

  const checkout = useMutation({
    mutationFn: publicApi.checkout,
    onSuccess: (order) => {
      store.addOrder(order.orderCode)
      store.setCart(null)
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

  if (loading) return <div className="g-container g-page"><Spin /></div>
  if (!cart || cart.items.length === 0) {
    return (
      <div className="g-container g-page g-center">
        <h2>Giỏ hàng đang trống</h2>
        <Link to="/" className="g-cta">Chọn món ngay</Link>
      </div>
    )
  }

  const submit = (v: {
    customerName?: string; customerPhone?: string; recipientName?: string; address?: string
    pickupTime?: Dayjs; paymentMethod: PaymentMethod; note?: string
  }) => {
    store.setContact(v.customerName ?? '', v.customerPhone ?? '')
    checkout.mutate({
      sessionCode: cart.sessionCode,
      orderType,
      customerName: v.customerName || undefined,
      customerPhone: v.customerPhone || undefined,
      delivery: orderType === 'DELIVERY'
        ? { recipientName: v.recipientName || v.customerName || '', recipientPhone: v.customerPhone!, address: v.address! }
        : undefined,
      pickupTime: v.pickupTime ? v.pickupTime.format('YYYY-MM-DDTHH:mm:ss') : undefined,
      paymentMethod: v.paymentMethod,
      voucherCode: quote.data?.voucherMessage ? undefined : appliedVoucher,
      note: v.note || undefined,
    })
  }

  const q = quote.data
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
            customerName: isCustomer ? authUser?.fullName : store.name,
            customerPhone: isCustomer ? authUser?.phone ?? authUser?.username : store.phone,
            paymentMethod: 'CASH',
          }}
          onFinish={submit}
          requiredMark={false}
        >
          <h3>1. Hình thức nhận</h3>
          <div className="g-seg">
            {types.map((t) => (
              <button type="button" key={t.value} className={orderType === t.value ? 'is-on' : ''} onClick={() => setOrderType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>

          <h3>2. Thông tin liên hệ</h3>
          <div className="g-form-row">
            <Form.Item name="customerName" label="Họ tên">
              <Input placeholder="Tên của bạn" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="customerPhone"
              label="Số điện thoại"
              rules={[
                { required: orderType === 'DELIVERY', message: 'Cần số điện thoại để giao hàng' },
                { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
              extra={isCustomer ? 'Đơn được lưu vào tài khoản của bạn' : 'Để tích điểm và nhận voucher'}
            >
              <Input placeholder="09xx xxx xxx" inputMode="tel" disabled={isCustomer} />
            </Form.Item>
          </div>

          {orderType === 'DELIVERY' && (
            <>
              <Form.Item name="address" label="Địa chỉ giao hàng" rules={[{ required: true, message: 'Nhập địa chỉ giao hàng' }]}>
                <Input placeholder="Số nhà, đường, phường, quận" maxLength={255} />
              </Form.Item>
              <Form.Item name="recipientName" label="Người nhận (nếu khác)">
                <Input maxLength={100} />
              </Form.Item>
            </>
          )}
          {orderType !== 'DINE_IN' && (
            <Form.Item name="pickupTime" label={orderType === 'DELIVERY' ? 'Giao lúc (để trống = sớm nhất)' : 'Nhận lúc (để trống = sớm nhất)'}>
              <DatePicker
                showTime={{ format: 'HH:mm', minuteStep: 15 }}
                format="HH:mm DD/MM"
                disabledDate={(d) => d.isBefore(dayjs().startOf('day')) || d.isAfter(dayjs().add(2, 'day'))}
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
            {(q?.lines ?? cart.items.map((i) => ({ ...i, lineTotal: i.subtotal, listPrice: i.unitPrice, promotionName: undefined }))).map((l, idx) => (
              <li key={idx}>
                <span><b>{l.quantity}×</b> {l.coffeeName}{l.note && <small>{l.note}</small>}</span>
                <span>
                  {l.unitPrice < l.listPrice && <s>{money(l.listPrice * l.quantity)}</s>}
                  {money(l.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="g-voucher">
            <Input
              placeholder="Mã voucher"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value.toUpperCase())}
              onPressEnter={() => setAppliedVoucher(voucher || undefined)}
            />
            <button type="button" className="g-btn-ghost" onClick={() => setAppliedVoucher(voucher || undefined)}>
              Áp dụng
            </button>
          </div>
          {q?.voucherMessage && <Alert type="warning" showIcon message={q.voucherMessage} />}

          <div className="g-totals">
            <div className="g-row"><span>Tạm tính</span><span>{money(q?.subtotal ?? cart.subtotal)}</span></div>
            {!!q?.promotionDiscount && (
              <div className="g-row g-green"><span>{q.promotionName}</span><span>-{money(q.promotionDiscount)}</span></div>
            )}
            {!!q?.voucherDiscount && (
              <div className="g-row g-green"><span>Voucher {q.voucherCode}</span><span>-{money(q.voucherDiscount)}</span></div>
            )}
            {!!q?.shippingFee && <div className="g-row"><span>Phí giao hàng</span><span>{money(q.shippingFee)}</span></div>}
            <div className="g-row g-total"><span>Tổng cộng</span><span>{money(q?.total ?? cart.subtotal)}</span></div>
          </div>

          {!!q?.unavailableItems.length && (
            <Alert type="error" showIcon message={`Món đã hết: ${q.unavailableItems.join(', ')}`} />
          )}
          <button
            className="g-cta g-cta-block"
            disabled={checkout.isPending || quote.isFetching || !!q?.unavailableItems.length}
            onClick={() => form.submit()}
          >
            {checkout.isPending ? 'Đang gửi đơn…' : `Xác nhận đặt hàng · ${money(q?.total ?? cart.subtotal)}`}
          </button>
        </aside>
      </div>
    </div>
  )
}
