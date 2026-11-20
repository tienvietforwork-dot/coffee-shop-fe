import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Col, Empty, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Tag } from 'antd'
import { ArrowLeftOutlined, CarOutlined, DeleteOutlined, ExclamationCircleFilled, SearchOutlined, ShoppingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { CustomerLookup, Order, OrderType, PaymentMethod, TableBoard } from '@/api/types'
import { ORDER_STATUS, PAYMENT_METHOD, money, num, options, photoSrc } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { useDeliveryArea } from '@/lib/useDeliveryArea'
import { itemPromo } from '@/lib/itemPromo'
import { VnAddressInput } from '@/components/VnAddressInput'
import { isCompleteVnAddress, vnAddressRule } from '@/lib/vnAddress'
import { MoneyInput } from '../../components/MoneyInput'
import { StatusTag } from '../../components/StatusTag'

/** Đơn đang làm ở màn order tại quầy: một bàn (trả sau), mang về, hoặc giao hàng. */
export type PosTarget = { kind: 'TABLE'; table: TableBoard } | { kind: 'TAKE_AWAY' } | { kind: 'DELIVERY' }

interface Line { key: string; coffeeId: number; name: string; price: number; quantity: number }

const PHONE = /^0\d{9,10}$/
const unpaidOf = (o: Order) => o.payments.filter((p) => p.status === 'PENDING').reduce((a, p) => a + Number(p.amount), 0)

/**
 * Màn order: thực đơn bên trái, hóa đơn + tạm tính bên phải. Mỗi loại có phần riêng:
 * bàn — các lượt đã gọi, "Gửi món" (trả sau) và "Thanh toán" (thu hết, trả bàn);
 * mang về — thu tiền ngay; giao hàng — SĐT (tìm khách, tự điền tên + địa chỉ đã lưu), họ tên, địa chỉ.
 */
export function PosOrder({ target, onBack }: { target: PosTarget; onBack: () => void }) {
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const kind = target.kind
  const table = target.kind === 'TABLE' ? target.table : undefined
  const orderType: OrderType = kind === 'TABLE' ? 'DINE_IN' : kind
  const isDelivery = kind === 'DELIVERY'

  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu })
  const [cat, setCat] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [payment, setPayment] = useState<PaymentMethod>('CASH')
  const [paidNow, setPaidNow] = useState(false)
  const [voucher, setVoucher] = useState('')
  const [saved, setSaved] = useState<CustomerLookup['addresses']>([])
  const [form] = Form.useForm()
  const phone = Form.useWatch('customerPhone', form) as string | undefined
  // giao hàng: phí ship theo khu vực, đo lại khi địa chỉ ngừng thay đổi
  const rawAddress = Form.useWatch('address', form) as string | undefined
  const typed = useDebounced(rawAddress?.trim() || undefined)
  const area = useDeliveryArea(isDelivery ? rawAddress : undefined)
  const { data: shipping } = useQuery({ queryKey: ['delivery-settings-public'], queryFn: publicApi.deliverySettings, staleTime: 5 * 60_000, enabled: isDelivery })
  const address = isDelivery && isCompleteVnAddress(typed) ? typed : undefined

  // bàn: các lượt đã gửi còn mở (đang làm / chưa thu tiền)
  const { data: sent = [] } = useQuery({
    queryKey: ['tables', table?.id, 'orders'], queryFn: () => coreApi.tableOrders(table!.id), enabled: !!table, refetchInterval: 30_000,
  })
  const { data: board } = useQuery({ queryKey: ['tables', 'board'], queryFn: coreApi.tableBoard, enabled: !!table })
  const live = board?.find((t) => t.id === table?.id) ?? table
  const due = sent.reduce((a, o) => a + unpaidOf(o), 0)
  const sentTotal = sent.reduce((a, o) => a + Number(o.totalAmount), 0)
  const waiting = sent.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED')

  const coffees = useMemo(() => (menu?.categories ?? [])
    .filter((c) => cat === 'all' || c.id === cat)
    .flatMap((c) => c.coffees)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())), [menu, cat, search])

  const items = lines.map((l) => ({ coffeeId: l.coffeeId, quantity: l.quantity }))
  const quote = useQuery({
    queryKey: ['pos-quote', items, orderType, voucher, phone, address ?? null],
    queryFn: () => coreApi.quote({ items, orderType, voucherCode: voucher || undefined, customerPhone: phone && PHONE.test(phone) ? phone : undefined, deliveryAddress: address }),
    retry: false,
    enabled: lines.length > 0,
  })
  const q = quote.data
  const itemOff = itemPromo(q?.lines)
  // đơn giao tối thiểu: tiền hàng (sau giảm giá) chưa đạt thì chưa tạo được
  const minDelivery = isDelivery ? shipping?.minOrderAmount ?? undefined : undefined
  const goods = q ? q.total - q.shippingFee : lines.reduce((a, l) => a + l.price * l.quantity, 0)
  const belowMin = !!minDelivery && lines.length > 0 && goods < minDelivery

  // giao hàng: gõ đủ SĐT là tìm khách, tự điền họ tên + địa chỉ mặc định
  const { mutate: findCustomer, isPending: finding } = useMutation({
    mutationFn: coreApi.lookupCustomer,
    onSuccess: (c) => {
      const def = c.addresses.find((a) => a.isDefault) ?? c.addresses[0]
      setSaved(c.addresses)
      form.setFieldsValue({ customerName: c.fullName ?? def?.recipientName, ...(isDelivery && def ? { address: def.address } : {}) })
      message.success(`${c.fullName ?? c.phone} · ${c.loyaltyPoints} điểm${isDelivery && c.addresses.length ? ` · ${c.addresses.length} địa chỉ đã lưu` : ''}`)
    },
    onError: () => { setSaved([]); message.info(isDelivery ? 'Khách mới — nhập họ tên và địa chỉ' : 'Khách mới — sẽ tạo hồ sơ khi đặt đơn') },
  })
  const looked = useRef<string>()
  useEffect(() => {
    if (!isDelivery || !phone || !/^0\d{9}$/.test(phone) || looked.current === phone) return
    looked.current = phone
    findCustomer(phone)
  }, [isDelivery, phone, findCustomer])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['tables'] })
    qc.invalidateQueries({ queryKey: ['cash-shift'] })
  }

  const create = useMutation({
    mutationFn: coreApi.createOrder,
    onSuccess: (o) => {
      refresh()
      setLines([]); setVoucher('')
      if (table) {
        message.success(`Đã gửi ${o.items.reduce((n, i) => n + i.quantity, 0)} món · bàn ${table.tableNo} · ${o.orderCode}`)
        form.resetFields(['note'])
        return
      }
      modal.success({ title: `Đã tạo đơn ${o.orderCode}`, content: `Tổng ${money(o.totalAmount)} · ${o.paid ? 'đã thanh toán' : 'chưa thu tiền'}` })
      form.resetFields(); setSaved([]); looked.current = undefined
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH')
  const [given, setGiven] = useState<number | null>(null)
  const checkout = useMutation({
    mutationFn: () => coreApi.checkoutTable(table!.id, payMethod),
    onSuccess: () => {
      refresh()
      setPayOpen(false)
      message.success(due ? `Đã thu ${money(due)} · bàn ${table!.tableNo} đã trống` : `Đã trả bàn ${table!.tableNo}`)
      onBack()
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
    items, orderType, tableId: table?.id,
    customerName: v.customerName || undefined, customerPhone: v.customerPhone || undefined,
    delivery: isDelivery ? { recipientName: v.customerName, recipientPhone: v.customerPhone, address: v.address } : undefined,
    // bàn: trả sau (thu khi thanh toán bàn); mang về: thu ngay; giao: thu ngay hoặc thu khi giao
    paymentMethod: table ? 'CASH' : payment,
    paidNow: table ? false : kind === 'TAKE_AWAY' ? true : paidNow,
    voucherCode: voucher || undefined, note: v.note || undefined,
  }))

  const blocked = !lines.length || !!q?.voucherMessage || (isDelivery && (!!area?.outside || belowMin))
  const title = table ? `Bàn ${table.tableNo}` : kind === 'TAKE_AWAY' ? 'Mang về' : 'Giao hàng'
  const where = table ? [live?.floor, live?.area].filter(Boolean).join(' · ') : undefined

  return (
    <>
      <div className="a-pos-bar">
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Sơ đồ bàn</Button>
        <h2>
          {kind === 'TAKE_AWAY' && <ShoppingOutlined />}{isDelivery && <CarOutlined />} {title}
        </h2>
        {where && <span className="a-muted">{where}{table?.capacity ? ` · ${table.capacity} chỗ` : ''}</span>}
        {table && (live?.occupied ? <Tag color="orange">Có khách{live.since ? ` từ ${dayjs(live.since).format('HH:mm')}` : ''}</Tag> : <Tag color="green">Bàn trống</Tag>)}
      </div>
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
          <Card title={table ? `Hóa đơn bàn ${table.tableNo}` : kind === 'TAKE_AWAY' ? 'Đơn mang về' : 'Đơn giao hàng'} className="a-pos-cart">
            <Form form={form} layout="vertical" size="small">
              {isDelivery && <>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="customerPhone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập SĐT người nhận' }, { pattern: PHONE, message: 'SĐT không hợp lệ' }]}>
                      <Input.Search placeholder="0901234567" loading={finding} enterButton="Tìm" onSearch={(v) => PHONE.test(v) && findCustomer(v)} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="customerName" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên người nhận' }]}><Input maxLength={100} /></Form.Item>
                  </Col>
                </Row>
                {saved.length > 1 && (
                  <Select style={{ width: '100%', marginBottom: 8 }} placeholder="Chọn địa chỉ đã lưu" value={saved.find((a) => a.address === rawAddress)?.id}
                    onChange={(id) => form.setFieldsValue({ address: saved.find((a) => a.id === id)?.address })}
                    options={saved.map((a) => ({ value: a.id, label: `${a.label ? `${a.label}: ` : ''}${a.address}` }))} />
                )}
                <Form.Item name="address" label="Địa chỉ giao" rules={[vnAddressRule('nơi nhận')]}
                  extra={area?.outside ? <span style={{ color: '#cf1322' }}>{area.message ?? 'Ngoài khu vực giao hàng'}</span>
                    : quote.isError ? <span style={{ color: '#cf1322' }}>{errorMessage(quote.error)}</span>
                    : q?.deliveryZone ? `Giao tới ${q.deliveryZone}${q.deliveryDistanceKm != null ? ` · ~${num(q.deliveryDistanceKm)} km` : ''}${q.deliveryMinutes ? ` · giao ~${q.deliveryMinutes} phút` : ''}` : undefined}>
                  <VnAddressInput deliveryOnly />
                </Form.Item>
              </>}

              {table && sent.length > 0 && (
                <div className="a-pos-sent">
                  <div className="a-pos-sec">Đã gọi</div>
                  {sent.map((o) => (
                    <div key={o.id} className="a-pos-round">
                      <div className="a-pos-round-head">
                        <span className="a-muted small">{dayjs(o.orderedAt).format('HH:mm')} · {o.orderCode}</span>
                        <StatusTag label={ORDER_STATUS[o.status]} />
                        {o.paid && <Tag color="green" bordered={false}>Đã thu</Tag>}
                      </div>
                      {o.items.map((i) => (
                        <div key={i.id} className="a-line small"><span>{i.quantity}× {i.coffeeName}</span><span>{money(i.lineTotal)}</span></div>
                      ))}
                      {!!o.discountAmount && <div className="a-line small a-green"><span>Giảm giá</span><span>-{money(o.discountAmount)}</span></div>}
                    </div>
                  ))}
                  <div className="a-line"><b>Đã gọi</b><b>{money(sentTotal)}</b></div>
                </div>
              )}

              {table && <div className="a-pos-sec">{sent.length ? 'Gọi thêm' : 'Món mới'}</div>}
              {lines.length === 0
                ? <Empty description={table && sent.length ? 'Chọn món bên trái để gọi thêm' : 'Chọn món bên trái'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : lines.map((l) => (
                  <div key={l.key} className="a-pos-line">
                    <div className="a-pos-line-top">
                      <span><b>{l.name}</b><br /><span className="a-muted small">{money(l.price)}</span></span>
                      <Space>
                        <InputNumber min={1} max={99} size="small" value={l.quantity} onChange={(v) => v && patch(l.key, { quantity: v })} />
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                      </Space>
                    </div>
                  </div>
                ))}

              <Row gutter={8} style={{ marginTop: 12 }}>
                {!isDelivery && (
                  <Col span={12}>
                    <Form.Item name="customerPhone" rules={[{ pattern: PHONE, message: 'SĐT không hợp lệ' }]}>
                      <Input placeholder="SĐT khách (tích điểm)" allowClear />
                    </Form.Item>
                  </Col>
                )}
                <Col span={isDelivery ? 24 : 12}>
                  <Input placeholder="Voucher" value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} />
                </Col>
              </Row>
              <Form.Item name="note" style={{ marginTop: isDelivery ? 8 : 0 }}>
                <Input placeholder={table ? 'Ghi chú cho bar (ít đá, ít ngọt…)' : 'Ghi chú đơn'} />
              </Form.Item>
              {!table && <>
                <Select style={{ width: '100%' }} value={payment} onChange={setPayment} options={options(PAYMENT_METHOD)} />
                {isDelivery && <Checkbox style={{ marginTop: 8 }} checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)}>Đã thu tiền (bỏ chọn = thu khi giao)</Checkbox>}
              </>}
            </Form>

            {lines.length > 0 && (
              <div className="a-pos-total">
                <div className="a-line"><span>Tạm tính</span><span>{money((q?.subtotal ?? 0) + itemOff.discount)}</span></div>
                {!!itemOff.discount && <div className="a-line a-green"><span>{itemOff.label}</span><span>-{money(itemOff.discount)}</span></div>}
                {!!q?.promotionDiscount && <div className="a-line a-green"><span>{q.promotionName}</span><span>-{money(q.promotionDiscount)}</span></div>}
                {!!q?.voucherDiscount && <div className="a-line a-green"><span>Voucher</span><span>-{money(q.voucherDiscount)}</span></div>}
                {q?.voucherMessage && <div className="a-line a-red"><span>{q.voucherMessage}</span></div>}
                {!!q?.shippingFee && <div className="a-line"><span>Phí giao</span><span>{money(q.shippingFee)}</span></div>}
                {q?.deliveryNote && <div className="small" style={{ color: '#d46b08' }}><ExclamationCircleFilled /> {q.deliveryNote}</div>}
                <div className="a-line a-big"><span>{table && sent.length ? 'Gọi thêm' : 'Tổng'}</span><span>{money(q?.total ?? 0)}</span></div>
              </div>
            )}
            {belowMin && <div className="a-muted small" style={{ marginBottom: 8 }}>Giao hàng cho đơn từ {money(minDelivery!)}</div>}
            {table && (sent.length > 0 || live?.occupied) && (
              <div className="a-line a-big a-pos-due"><span>Cần thu</span><span>{money(due)}</span></div>
            )}

            {table ? (
              <Space.Compact block>
                <Button type="primary" size="large" style={{ flex: 1 }} disabled={blocked} loading={create.isPending} onClick={submit}>
                  Gửi món{lines.length ? ` (${lines.reduce((n, l) => n + l.quantity, 0)})` : ''}
                </Button>
                <Button size="large" style={{ flex: 1 }} className="a-pos-pay" disabled={!sent.length && !live?.occupied}
                  onClick={() => { setGiven(null); setPayMethod('CASH'); setPayOpen(true) }}>
                  {due > 0 || sent.length ? 'Thanh toán' : 'Trả bàn'}
                </Button>
              </Space.Compact>
            ) : (
              <Button type="primary" size="large" block disabled={blocked || (isDelivery && quote.isError)} loading={create.isPending} onClick={submit}>
                {kind === 'TAKE_AWAY' ? `Thu tiền & tạo đơn${q ? ` · ${money(q.total)}` : ''}` : 'Tạo đơn giao'}
              </Button>
            )}
          </Card>
        </Col>
      </Row>

      {table && (
        <Modal open={payOpen} title={`Thanh toán bàn ${table.tableNo}`} onCancel={() => setPayOpen(false)}
          okText={due ? `Thu ${money(due)} & trả bàn` : 'Trả bàn'} onOk={() => checkout.mutate()}
          okButtonProps={{ disabled: waiting.length > 0, loading: checkout.isPending }} destroyOnHidden>
          {lines.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Còn ${lines.length} món chưa gửi — gửi món hoặc xóa trước khi thanh toán`} />}
          {waiting.length > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message={`Đơn khách tự gọi chưa nhận pha: ${waiting.map((o) => o.orderCode).join(', ')}`} description="Nhận hoặc hủy ở màn Điều phối đơn trước khi thanh toán." />}
          {sent.map((o) => (
            <div key={o.id} className="a-line"><span>{o.orderCode} · {o.items.reduce((n, i) => n + i.quantity, 0)} món</span>
              <span>{o.paid ? <Tag color="green" bordered={false}>Đã thu</Tag> : money(unpaidOf(o))}</span></div>
          ))}
          {!sent.length && <div className="a-muted">Bàn không còn đơn nào — trả bàn để mở lại.</div>}
          <div className="a-line a-big" style={{ borderTop: '1px solid var(--line)', marginTop: 8 }}><span>Cần thu</span><span>{money(due)}</span></div>
          {due > 0 && <>
            <Segmented block value={payMethod} onChange={(v) => setPayMethod(v as PaymentMethod)} options={options(PAYMENT_METHOD)} style={{ margin: '8px 0' }} />
            {payMethod === 'CASH' && (
              <Row gutter={8} align="middle">
                <Col span={14}><MoneyInput placeholder="Khách đưa" value={given ?? undefined} onChange={(v) => setGiven(v)} /></Col>
                <Col span={10} style={{ textAlign: 'right' }}>
                  {given != null && given >= due ? <>Thối lại <b>{money(given - due)}</b></> : given != null ? <span className="a-red">Thiếu {money(due - given)}</span> : null}
                </Col>
              </Row>
            )}
          </>}
        </Modal>
      )}
    </>
  )
}
