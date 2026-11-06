import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Input, InputNumber, Row, Segmented, Select, Space, Tag } from 'antd'
import { Link } from 'react-router-dom'
import { P, usePerm } from '@/lib/perm'
import { DeleteOutlined, ExclamationCircleFilled, SearchOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { OrderType, PaymentMethod } from '@/api/types'
import { PAYMENT_METHOD, money, num, options, photoSrc } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { useDebounced } from '@/lib/useDebounced'
import { useDeliveryArea } from '@/lib/useDeliveryArea'
import { VnAddressInput } from '@/components/VnAddressInput'
import { isCompleteVnAddress, vnAddressRule } from '@/lib/vnAddress'

interface Line { key: string; coffeeId: number; name: string; price: number; quantity: number }

/** Order tại quầy (BPMN-01, nhánh "Tại quầy"): nhập món, thu tiền. */
export function PosPage() {
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const { data: tables = [] } = useQuery({ queryKey: ['tables'], queryFn: coreApi.tables })
  const { can } = usePerm()
  // cash taken at the counter belongs to the open cashier shift
  const { data: shift, isFetched: shiftChecked } = useQuery({ queryKey: ['cash-shift'], queryFn: coreApi.currentShift, enabled: can(P.CASH_SHIFTS) || can(P.POS) })
  const [cat, setCat] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [orderType, setOrderType] = useState<OrderType>('TAKE_AWAY')
  const [tableId, setTableId] = useState<number>()
  const [payment, setPayment] = useState<PaymentMethod>('CASH')
  const [paidNow, setPaidNow] = useState(true)
  const [voucher, setVoucher] = useState('')
  const [form] = Form.useForm()
  const phone = Form.useWatch('customerPhone', form) as string | undefined
  // phí ship theo km: đo lại khi địa chỉ ngừng thay đổi
  const rawAddress = Form.useWatch('address', form) as string | undefined
  const typed = useDebounced(rawAddress?.trim() || undefined)
  const area = useDeliveryArea(orderType === 'DELIVERY' ? rawAddress : undefined)
  const { data: shipping } = useQuery({ queryKey: ['delivery-settings-public'], queryFn: publicApi.deliverySettings, staleTime: 5 * 60_000 })
  const address = isCompleteVnAddress(typed) ? typed : undefined

  const coffees = useMemo(() => (menu?.categories ?? [])
    .filter((c) => cat === 'all' || c.id === cat)
    .flatMap((c) => c.coffees)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())), [menu, cat, search])

  const items = lines.map((l) => ({ coffeeId: l.coffeeId, quantity: l.quantity }))
  const quote = useQuery({
    queryKey: ['pos-quote', items, orderType, voucher, phone, orderType === 'DELIVERY' ? address : null],
    queryFn: () => coreApi.quote({ items, orderType, voucherCode: voucher || undefined, customerPhone: phone || undefined,
      deliveryAddress: orderType === 'DELIVERY' ? address : undefined }),
    retry: false,
    enabled: lines.length > 0,
  })
  // đơn giao tối thiểu: tiền hàng (sau giảm giá) chưa đạt thì khóa "Giao hàng"
  const minDelivery = shipping?.minOrderAmount ?? undefined
  const goods = quote.data ? quote.data.total - quote.data.shippingFee : lines.reduce((a, l) => a + l.price * l.quantity, 0)
  const belowMin = !!minDelivery && goods < minDelivery
  useEffect(() => {
    if (belowMin && orderType === 'DELIVERY') setOrderType('TAKE_AWAY')
  }, [belowMin, orderType])

  const lookup = useMutation({
    mutationFn: coreApi.lookupCustomer,
    onSuccess: (c) => { form.setFieldsValue({ customerName: c.fullName }); message.success(`${c.fullName ?? c.phone} · ${c.loyaltyPoints} điểm`) },
    onError: () => message.info('Khách mới — sẽ tạo hồ sơ khi đặt đơn'),
  })

  const create = useMutation({
    mutationFn: coreApi.createOrder,
    onSuccess: (o) => {
      modal.success({ title: `Đã tạo đơn ${o.orderCode}`, content: `Tổng ${money(o.totalAmount)} · ${o.paid ? 'đã thanh toán' : 'chưa thu tiền'}` })
      setLines([]); setVoucher(''); form.resetFields(); setTableId(undefined)
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  const add = (id: number, name: string, price: number) =>
    setLines((ls) => {
      const ex = ls.find((l) => l.coffeeId === id)
      return ex ? ls.map((l) => (l === ex ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { key: `${id}-${Date.now()}`, coffeeId: id, name, price, quantity: 1 }]
    })
  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))

  const submit = () => form.validateFields().then((v) => create.mutate({
    items, orderType, tableId: orderType === 'DINE_IN' ? tableId : undefined,
    customerName: v.customerName || undefined, customerPhone: v.customerPhone || undefined,
    delivery: orderType === 'DELIVERY' ? { recipientName: v.customerName || 'Khách', recipientPhone: v.customerPhone, address: v.address } : undefined,
    paymentMethod: payment, paidNow, voucherCode: voucher || undefined, note: v.note || undefined,
  }))

  const q = quote.data
  return (
    <>
      <PageHeader title="Order tại quầy" extra={shift && <Tag color="green">Ca {shift.code} · {shift.staffName}</Tag>} />
      {shiftChecked && !shift && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chưa mở ca thu ngân"
          description={<>Tiền thu tại quầy được tính vào ca đang mở để chốt két cuối ca. <Link to="/admin/cash-shifts">Mở ca</Link></>} />
      )}
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card>
            <Space wrap style={{ marginBottom: 12 }}>
              <Segmented<number | 'all'> value={cat} onChange={setCat}
                options={[{ value: 'all', label: 'Tất cả' }, ...(menu?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
              <Input prefix={<SearchOutlined />} placeholder="Tìm món" allowClear value={search} onChange={(e) => setSearch(e.target.value)} />
            </Space>
            <div className="a-pos-grid">
              {coffees.map((c) => (
                <button key={c.id} className="a-pos-item" disabled={!c.available} onClick={() => add(c.id, c.name, c.salePrice ?? c.price)}>
                  <img src={photoSrc(c.imageUrl)} alt="" />
                  <b>{c.name}</b>
                  <span>{money(c.salePrice ?? c.price)}{c.salePrice != null && <s> {money(c.price)}</s>}</span>
                  {!c.available && <Tag>Hết</Tag>}
                </button>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Đơn hiện tại" className="a-pos-cart">
            {lines.length === 0 ? <Empty description="Chọn món bên trái" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : lines.map((l) => (
              <div key={l.key} className="a-pos-line">
                <div className="a-pos-line-top">
                  <b>{l.name}</b>
                  <Space>
                    <InputNumber min={1} max={99} size="small" value={l.quantity} onChange={(v) => v && patch(l.key, { quantity: v })} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                  </Space>
                </div>
              </div>
            ))}

            <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
              <Segmented block value={orderType} onChange={(v) => setOrderType(v as OrderType)}
                options={[{ value: 'TAKE_AWAY', label: 'Mang về' }, { value: 'DINE_IN', label: 'Tại bàn' }, { value: 'DELIVERY', label: 'Giao hàng', disabled: belowMin }]} />
              {belowMin && <div className="a-muted small" style={{ marginTop: 4 }}>Giao hàng cho đơn từ {money(minDelivery!)}</div>}
              {orderType === 'DINE_IN' && (
                <Select style={{ width: '100%', marginTop: 8 }} placeholder="Chọn bàn" value={tableId} onChange={setTableId}
                  options={tables.filter((t) => t.status !== 'INACTIVE').map((t) => ({ value: t.id, label: `Bàn ${t.tableNo} · ${t.area ?? ''} ${t.status === 'OCCUPIED' ? '(có khách)' : ''}` }))} />
              )}
              <Row gutter={8} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Form.Item name="customerPhone" label="SĐT khách" rules={[{ required: orderType === 'DELIVERY' }, { pattern: /^0\d{9,10}$/, message: 'SĐT không hợp lệ' }]}>
                    <Input.Search onSearch={(v) => v && lookup.mutate(v)} enterButton="Tìm" />
                  </Form.Item>
                </Col>
                <Col span={12}><Form.Item name="customerName" label="Tên khách"><Input /></Form.Item></Col>
              </Row>
              {orderType === 'DELIVERY' && <>
                {shipping?.shopAddress && <div className="a-muted small" style={{ marginBottom: 6 }}>Quán: {shipping.shopAddress}</div>}
                <Form.Item name="address" label="Địa chỉ giao" rules={[vnAddressRule('nơi nhận')]}
                  extra={area?.outside ? <span style={{ color: '#cf1322' }}>Ngoài khu vực giao hàng (quán giao tối đa {area.maxKm} km)</span>
                    : quote.isError ? <span style={{ color: '#cf1322' }}>{errorMessage(quote.error)}</span>
                    : q?.deliveryDistanceKm != null ? `${num(q.deliveryDistanceKm)} km${q.deliveryOption ? ` · ${q.deliveryOption}` : ''}` : undefined}>
                  <VnAddressInput />
                </Form.Item>
              </>}
              <Form.Item name="note" label="Ghi chú đơn"><Input /></Form.Item>
              <Row gutter={8}>
                <Col span={12}><Select style={{ width: '100%' }} value={payment} onChange={setPayment} options={options(PAYMENT_METHOD)} /></Col>
                <Col span={12}><Input placeholder="Voucher" value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} /></Col>
              </Row>
              <Checkbox style={{ marginTop: 8 }} checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)}>Đã thu tiền</Checkbox>
            </Form>

            <div className="a-pos-total">
              <div className="a-line"><span>Tạm tính</span><span>{money(q?.subtotal ?? 0)}</span></div>
              {!!q?.promotionDiscount && <div className="a-line a-green"><span>{q.promotionName}</span><span>-{money(q.promotionDiscount)}</span></div>}
              {!!q?.voucherDiscount && <div className="a-line a-green"><span>Voucher</span><span>-{money(q.voucherDiscount)}</span></div>}
              {q?.voucherMessage && <div className="a-line a-red"><span>{q.voucherMessage}</span></div>}
              {!!q?.shippingFee && <div className="a-line"><span>Phí giao</span><span>{money(q.shippingFee - (q.weatherSurcharge ?? 0))}</span></div>}
              {!!q?.weatherSurcharge && <div className="a-line"><span>Phụ phí thời tiết ({q.deliveryWeather})</span><span>{money(q.weatherSurcharge)}</span></div>}
              {q?.deliveryNote && <div className="small" style={{ color: '#d46b08' }}><ExclamationCircleFilled /> {q.deliveryNote}</div>}
              <div className="a-line a-big"><span>Tổng</span><span>{money(q?.total ?? 0)}</span></div>
            </div>
            <Button type="primary" size="large" block disabled={!lines.length || !!q?.voucherMessage || (orderType === 'DINE_IN' && !tableId) || (orderType === 'DELIVERY' && !!area?.outside)} loading={create.isPending} onClick={submit}>
              Tạo đơn
            </Button>
          </Card>
        </Col>
      </Row>
    </>
  )
}
