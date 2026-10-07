import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Checkbox, Col, Empty, Form, Input, InputNumber, Row, Segmented, Select, Space, Tag } from 'antd'
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { OrderType, PaymentMethod } from '@/api/types'
import { PAYMENT_METHOD, imageSrc, money, options } from '@/lib/format'
import { useAddableCups } from '@/lib/stock'
import { PageHeader } from '../components/PageHeader'

interface Line { key: string; coffeeId: number; name: string; price: number; quantity: number }

/** Order tại quầy (BPMN-01, nhánh "Tại quầy"): nhập món, thu tiền. */
export function PosPage() {
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const { data: tables = [] } = useQuery({ queryKey: ['tables'], queryFn: coreApi.tables })
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

  const coffees = useMemo(() => (menu?.categories ?? [])
    .filter((c) => cat === 'all' || c.id === cat)
    .flatMap((c) => c.coffees)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())), [menu, cat, search])

  const items = lines.map((l) => ({ coffeeId: l.coffeeId, quantity: l.quantity }))
  const quote = useQuery({
    queryKey: ['pos-quote', items, orderType, voucher, phone],
    queryFn: () => coreApi.quote({ items, orderType, voucherCode: voucher || undefined, customerPhone: phone || undefined }),
    enabled: lines.length > 0,
  })

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
  const addable = useAddableCups(lines)
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
      <PageHeader title="Order tại quầy" />
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
                <button key={c.id} className="a-pos-item" disabled={!c.available || addable(c.id) < 1} onClick={() => add(c.id, c.name, c.salePrice ?? c.price)}>
                  {c.imageUrl && <img src={imageSrc(c.imageUrl)} alt="" />}
                  <b>{c.name}</b>
                  <span>{money(c.salePrice ?? c.price)}{c.salePrice != null && <s> {money(c.price)}</s>}</span>
                  {!c.available || addable(c.id) < 1 ? <Tag>Hết</Tag> : addable(c.id) < 10 && <Tag color="orange">Còn {addable(c.id)} ly</Tag>}
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
                    <InputNumber min={1} max={Math.min(99, l.quantity + addable(l.coffeeId))} size="small" value={l.quantity} onChange={(v) => v && patch(l.key, { quantity: v })} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                  </Space>
                </div>
              </div>
            ))}

            <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
              <Segmented block value={orderType} onChange={(v) => setOrderType(v as OrderType)}
                options={[{ value: 'TAKE_AWAY', label: 'Mang về' }, { value: 'DINE_IN', label: 'Tại bàn' }, { value: 'DELIVERY', label: 'Giao hàng' }]} />
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
              {orderType === 'DELIVERY' && <Form.Item name="address" label="Địa chỉ giao" rules={[{ required: true }]}><Input /></Form.Item>}
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
              {!!q?.shippingFee && <div className="a-line"><span>Phí giao</span><span>{money(q.shippingFee)}</span></div>}
              <div className="a-line a-big"><span>Tổng</span><span>{money(q?.total ?? 0)}</span></div>
            </div>
            <Button type="primary" size="large" block disabled={!lines.length || !!q?.voucherMessage || (orderType === 'DINE_IN' && !tableId)} loading={create.isPending} onClick={submit}>
              Tạo đơn
            </Button>
          </Card>
        </Col>
      </Row>
    </>
  )
}
