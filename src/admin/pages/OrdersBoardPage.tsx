import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, DatePicker, Segmented, Select, Space, Table, Tag, Tooltip } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Order, OrderChannel, OrderStatus, ScheduleRow } from '@/api/types'
import { ORDER_CHANNEL, ORDER_STATUS, ORDER_TYPE, money, time, dateTime, options } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { OrderActions } from '../components/OrderActions'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'
import { customerText, itemCodes, receiveText, totalDiscount } from '@/lib/orderInfo'

/**
 * Xác nhận đơn → CONFIRMED. Đơn hẹn giờ chưa tới giờ phải pha (giờ hẹn − pha − chạy xe) nằm ở "Hẹn giao", tới giờ thì
 * tự sang "Chờ pha chế" (tính lại mỗi 30 giây). "Hẹn giao" có cả lần giao sắp tới của gói định kỳ (đơn chưa tự tạo).
 * Mọi cột xếp theo giờ phải bắt đầu pha: việc gấp nhất ở trên cùng.
 */
type Col = 'PENDING' | 'SCHEDULED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERING'
const COLUMNS: { key: Col; label: { text: string; color: string } }[] = [
  { key: 'PENDING', label: ORDER_STATUS.PENDING },
  { key: 'SCHEDULED', label: { text: 'Hẹn giao', color: 'magenta' } },
  { key: 'CONFIRMED', label: ORDER_STATUS.CONFIRMED },
  { key: 'PREPARING', label: ORDER_STATUS.PREPARING },
  { key: 'READY', label: ORDER_STATUS.READY },
  { key: 'DELIVERING', label: ORDER_STATUS.DELIVERING },
]
/** thứ tự ưu tiên: giờ phải bắt đầu pha (đơn làm ngay = lúc đặt) */
const priority = (o: Order) => o.brewStartAt ?? o.orderedAt
const at = (v: string) => dayjs(v).format(dayjs(v).isSame(dayjs(), 'day') ? 'HH:mm' : 'HH:mm DD/MM')
const fromSubscription = (o: Order) => !!o.note?.startsWith('Gói định kỳ')
const runKey = (r: ScheduleRow) => `run-${r.subscriptionCode}-${r.deliverAt}`

export function OrdersBoardPage() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { canAny } = usePerm()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()])
  const [status, setStatus] = useState<OrderStatus>()
  const [channel, setChannel] = useState<OrderChannel>()
  const [openId, setOpenId] = useState<number | null>(null)

  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), channel, status: view === 'list' ? status : undefined }
  const { data: orders = [], isFetching, refetch } = useQuery({
    queryKey: ['orders', params],
    queryFn: () => coreApi.orders(params),
    refetchInterval: 30000,
  })
  // lần giao sắp tới của gói định kỳ (đơn chưa tự tạo) trong khoảng ngày đang xem
  const days = useMemo(() => {
    const out: string[] = []
    for (let d = range[0].startOf('day'); !d.isAfter(range[1], 'day') && out.length < 14; d = d.add(1, 'day')) {
      if (!d.isBefore(dayjs(), 'day')) out.push(d.format('YYYY-MM-DD'))
    }
    return out
  }, [range])
  const { data: upcoming = [] } = useQuery({
    queryKey: ['orders', 'subscription-runs', days],
    queryFn: async () => (await Promise.all(days.map((d) => coreApi.deliverySchedule(d)))).flat().filter((r) => !r.orderId),
    enabled: view === 'board' && (!channel || channel === 'ONLINE') && canAny(P.ORDERS, P.DELIVERY_SCHEDULE),
    refetchInterval: 60000,
    retry: false,
  })
  // đồng hồ của bảng: đơn hẹn giao tự sang "Chờ pha chế" khi tới giờ phải pha
  const [now, setNow] = useState(() => dayjs())
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 30000)
    return () => clearInterval(t)
  }, [])
  const byCol = useMemo(() => {
    const m: Record<Col, Order[]> = { PENDING: [], SCHEDULED: [], CONFIRMED: [], PREPARING: [], READY: [], DELIVERING: [] }
    for (const o of orders) {
      if (o.status === 'CONFIRMED') m[o.pickupTime && o.brewStartAt && now.isBefore(o.brewStartAt) ? 'SCHEDULED' : 'CONFIRMED'].push(o)
      else if (o.status in m) m[o.status as Col].push(o)
    }
    for (const l of Object.values(m)) l.sort((a, b) => priority(a).localeCompare(priority(b)))
    return m
  }, [orders, now])
  const runs = useMemo(() => [...upcoming].sort((a, b) => a.brewStartAt.localeCompare(b.brewStartAt)), [upcoming])
  /**
   * Số ưu tiên 1, 2, 3… trên toàn bảng (mọi cột, cả lần giao của gói): mốc so sánh là giờ phải bắt đầu pha — tại bàn /
   * mang về / giao ngay = lúc đặt (đặt trước làm trước), hẹn giờ = giờ hẹn − pha − chạy xe.
   */
  const rank = useMemo(() => {
    const all = [
      ...Object.values(byCol).flat().map((o) => ({ id: `o${o.id}`, at: priority(o), tie: o.orderedAt })),
      ...runs.map((r) => ({ id: runKey(r), at: r.brewStartAt, tie: r.deliverAt })),
    ].sort((a, b) => a.at.localeCompare(b.at) || a.tie.localeCompare(b.tie) || a.id.localeCompare(b.id))
    return new Map(all.map((x, i) => [x.id, i + 1]))
  }, [byCol, runs])
  const done = () => qc.invalidateQueries({ queryKey: ['orders'] })

  return (
    <>
      <PageHeader
        title="Điều phối đơn hàng"
        subtitle="Đơn tại quầy, QR tại bàn và online — cập nhật realtime"
        extra={
          <Space wrap>
            <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM" allowClear={false} />
            <Select allowClear placeholder="Kênh" style={{ width: 130 }} value={channel} onChange={setChannel} options={options(ORDER_CHANNEL)} />
            {view === 'list' && <Select allowClear placeholder="Trạng thái" style={{ width: 150 }} value={status} onChange={setStatus} options={options(ORDER_STATUS)} />}
            <Segmented value={view} onChange={(v) => setView(v as 'board' | 'list')} options={[{ value: 'board', icon: <AppstoreOutlined /> }, { value: 'list', icon: <UnorderedListOutlined /> }]} />
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()} />
          </Space>
        }
      />

      {view === 'board' ? (
        <div className="a-board">
          {COLUMNS.map(({ key, label }) => {
            const list = byCol[key]
            const extra = key === 'SCHEDULED' ? runs : []
            // hẹn giao: đơn thật và lần giao của gói xen kẽ theo giờ phải pha
            const cards: ({ order: Order } | { run: ScheduleRow })[] = [
              ...list.map((order) => ({ order })), ...extra.map((run) => ({ run })),
            ].sort((a, b) => ('order' in a ? priority(a.order) : a.run.brewStartAt).localeCompare('order' in b ? priority(b.order) : b.run.brewStartAt))
            return (
              <div key={key} className="a-col">
                <div className="a-col-head"><StatusTag label={label} /><Badge count={cards.length} showZero color="#8c6a52" /></div>
                <div className="a-col-body">
                  {cards.map((c) => 'run' in c
                    ? <RunCard key={runKey(c.run)} run={c.run} no={rank.get(runKey(c.run))} onClick={() => nav('/admin/subscriptions')} />
                    : <Ticket key={c.order.id} o={c.order} col={key} no={rank.get(`o${c.order.id}`)} onOpen={() => setOpenId(c.order.id)} onDone={done} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={orders}
          onRow={(o) => ({ onClick: () => setOpenId(o.id), style: { cursor: 'pointer' } })}
          scroll={{ x: 1250 }}
          columns={[
            {
              title: 'Ưu tiên', width: 80, align: 'center', render: (_, o) => rank.get(`o${o.id}`)
                ? <span className="a-prio a-prio-sm">{rank.get(`o${o.id}`)}</span> : <span className="a-muted">—</span>,
            },
            { title: 'Mã đơn', dataIndex: 'orderCode', width: 150 },
            { title: 'Thời gian', dataIndex: 'orderedAt', render: dateTime, width: 130 },
            { title: 'Hẹn giao', dataIndex: 'pickupTime', render: (v?: string) => (v ? at(v) : <span className="a-muted">—</span>), width: 100 },
            { title: 'Kênh', render: (_, o) => <StatusTag label={ORDER_CHANNEL[o.channel]} />, width: 110 },
            { title: 'Khách hàng', render: (_, o) => customerText(o), width: 190 },
            { title: 'Địa chỉ nhận', ellipsis: { showTitle: false }, render: (_, o) => <Tooltip title={o.shipment && receiveText(o)}>{receiveText(o)}</Tooltip> },
            { title: 'Sản phẩm', ellipsis: { showTitle: false }, render: (_, o) => <Tooltip title={o.items.map((i) => `${i.coffeeCode ?? ''} ${i.coffeeName} ×${i.quantity}`).join(', ')}><span className="a-code">{itemCodes(o)}</span></Tooltip> },
            {
              title: 'Giảm giá', align: 'right', width: 130, render: (_, o) => totalDiscount(o) > 0
                ? <><span className="a-green">-{money(totalDiscount(o))}</span>{o.voucherCode && <div className="a-code">{o.voucherCode}</div>}</>
                : <span className="a-muted">—</span>,
            },
            { title: 'Tổng', dataIndex: 'totalAmount', render: money, align: 'right', width: 110 },
            { title: 'Trạng thái', render: (_, o) => <StatusTag label={ORDER_STATUS[o.status]} />, width: 120 },
          ]}
        />
      )}
      <OrderDetailDrawer orderId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

function Ticket({ o, col, no, onOpen, onDone }: { o: Order; col: Col; no?: number; onOpen: () => void; onDone: () => void }) {
  const late = (col === 'CONFIRMED') && o.brewStartAt && dayjs().isAfter(dayjs(o.brewStartAt).add(1, 'minute')) && !!o.pickupTime
  return (
    <div className={`a-ticket ${o.status === 'PENDING' ? 'is-new' : ''}`} onClick={onOpen}>
      <div className="a-ticket-head">
        {no != null && <span className="a-prio" title="Thứ tự ưu tiên">{no}</span>}
        <b>{o.orderCode.slice(-4)}</b>
        <Tag color={ORDER_CHANNEL[o.channel].color} bordered={false}>{ORDER_CHANNEL[o.channel].text}</Tag>
        {fromSubscription(o) && <Tag color="purple" bordered={false}>Gói</Tag>}
        <span className="a-muted">{time(o.orderedAt)}</span>
      </div>
      {o.pickupTime && (
        <div className={`a-ticket-meta ${late ? 'a-red' : ''}`} style={{ fontWeight: 600 }}>
          🕒 Hẹn {o.orderType === 'DELIVERY' ? 'giao' : 'nhận'} {at(o.pickupTime)}
          {o.brewStartAt && ['PENDING', 'SCHEDULED', 'CONFIRMED'].includes(col) && <span className="a-muted" style={{ fontWeight: 400 }}> · pha lúc {at(o.brewStartAt)}</span>}
        </div>
      )}
      <div className="a-ticket-meta">
        {ORDER_TYPE[o.orderType]}{o.tableNo && ` · Bàn ${o.tableNo}`}
      </div>
      <div className="a-ticket-meta">👤 {customerText(o)}</div>
      {o.shipment && <div className="a-ticket-meta a-ticket-addr" title={o.shipment.address}>📍 {o.shipment.address}</div>}
      {o.shipment?.shipperName && <div className="a-ticket-meta">🛵 {o.shipment.shipperName}</div>}
      <ul>
        {o.items.slice(0, 3).map((i) => <li key={i.id}><b>{i.quantity}×</b> {i.coffeeCode && <span className="a-code">{i.coffeeCode}</span>} {i.coffeeName}{i.note && <em> — {i.note}</em>}</li>)}
      </ul>
      {o.items.length > 3 && <div className="a-ticket-meta">+{o.items.length - 3} món khác · {o.items.reduce((n, i) => n + i.quantity, 0)} ly</div>}
      {totalDiscount(o) > 0 && (
        <div className="a-ticket-meta a-green">Giảm {money(totalDiscount(o))}{o.voucherCode && ` · voucher ${o.voucherCode}`}</div>
      )}
      <div className="a-ticket-foot">
        <span>{money(o.totalAmount)} {o.paid ? <Tag color="green" bordered={false}>Đã TT</Tag> : <Tag color="gold" bordered={false}>Chưa TT</Tag>}</span>
      </div>
      <OrderActions order={o} onDone={onDone} compact />
    </div>
  )
}

/** lần giao sắp tới của gói định kỳ: đơn sẽ tự tạo trước giờ giao */
function RunCard({ run, no, onClick }: { run: ScheduleRow; no?: number; onClick: () => void }) {
  return (
    <div className="a-ticket" style={{ borderStyle: 'dashed', background: '#fdfaf6' }} onClick={onClick}>
      <div className="a-ticket-head">
        {no != null && <span className="a-prio" title="Thứ tự ưu tiên">{no}</span>}
        <b>{run.subscriptionCode}</b>
        <Tag color="purple" bordered={false}>Gói định kỳ</Tag>
      </div>
      <div className="a-ticket-meta" style={{ fontWeight: 600 }}>
        🕒 Hẹn giao {at(run.deliverAt)} <span className="a-muted" style={{ fontWeight: 400 }}>· pha lúc {at(run.brewStartAt)}</span>
      </div>
      <div className="a-ticket-meta">👤 {run.customerName}{run.phone && ` · ${run.phone}`}</div>
      {run.address && <div className="a-ticket-meta a-ticket-addr" title={run.address}>📍 {run.address}</div>}
      <div className="a-ticket-meta">{run.items}</div>
      {run.autoCreateAt && <div className="a-ticket-meta a-muted">Tự tạo đơn lúc {at(run.autoCreateAt)}</div>}
    </div>
  )
}
