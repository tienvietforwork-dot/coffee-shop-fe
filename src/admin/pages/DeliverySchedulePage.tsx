import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Badge, DatePicker, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import { ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Order, ScheduleRow } from '@/api/types'
import { ORDER_STATUS, ORDER_TYPE } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { OrderActions } from '../components/OrderActions'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

const URGENCY: Record<ScheduleRow['urgency'], { text: string; color: string }> = {
  LATE: { text: 'Trễ — pha ngay', color: 'red' },
  NOW: { text: 'Đến giờ pha', color: 'volcano' },
  SOON: { text: 'Sắp tới', color: 'gold' },
  LATER: { text: 'Chưa tới giờ', color: 'blue' },
  STARTED: { text: 'Đã bắt đầu', color: 'default' },
}
const hm = (s: string) => dayjs(s).format('HH:mm')

/**
 * Lịch hẹn giao / nhận: đơn hẹn giờ (và đơn làm ngay) trong ngày, kèm giờ phải bắt đầu pha = giờ giao − thời gian chạy
 * xe − thời gian pha − dự phòng. Đơn phải pha sớm nhất lên đầu; lần giao của gói định kỳ chưa tạo đơn hiện "dự kiến".
 */
export function DeliverySchedulePage() {
  const [day, setDay] = useState<Dayjs>(dayjs())
  const [view, setView] = useState<'todo' | 'all'>('todo')
  const date = day.format('YYYY-MM-DD')
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['delivery-schedule', date], queryFn: () => coreApi.deliverySchedule(date), refetchInterval: 30000,
  })
  const [orderId, setOrderId] = useState<number | null>(null)
  const { data: orders = [] } = useQuery({ queryKey: ['orders', 'schedule'], queryFn: () => coreApi.orders({}), refetchInterval: 30000 })
  const byId = new Map<number, Order>(orders.map((o) => [o.id, o]))
  const rows = view === 'todo' ? data.filter((r) => r.urgency !== 'STARTED') : data
  const late = data.filter((r) => r.urgency === 'LATE').length
  const now = data.filter((r) => r.urgency === 'NOW').length

  return (
    <>
      <PageHeader title="Lịch hẹn giao & thứ tự pha chế" subtitle="Đơn phải bắt đầu pha sớm nhất xếp trên cùng" />
      <Space style={{ marginBottom: 12 }} wrap>
        <DatePicker value={day} onChange={(d) => d && setDay(d)} format="DD/MM/YYYY" allowClear={false} />
        <Segmented value={view} onChange={(v) => setView(v as typeof view)} options={[
          { value: 'todo', label: `Cần pha (${data.filter((r) => r.urgency !== 'STARTED').length})` },
          { value: 'all', label: `Tất cả (${data.length})` },
        ]} />
        {late > 0 && <Badge count={late} color="red"><Tag color="red">Trễ giờ pha</Tag></Badge>}
        {now > 0 && <Badge count={now} color="volcano"><Tag color="volcano">Đến giờ pha</Tag></Badge>}
      </Space>
      {late > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={`${late} đơn đã quá giờ phải bắt đầu pha — ưu tiên làm ngay để kịp giờ hẹn`} />}
      <Table<ScheduleRow> rowKey={(r) => r.orderId ? `o${r.orderId}` : `s${r.subscriptionCode}`} loading={isLoading} dataSource={rows}
        pagination={false} scroll={{ x: 1100 }}
        rowClassName={(r) => (r.urgency === 'LATE' ? 'a-row-danger' : '')}
        columns={[
          { title: '#', width: 48, render: (_, __, i) => <b>{i + 1}</b> },
          {
            title: 'Bắt đầu pha', width: 150, render: (_, r) => <>
              <b style={{ fontSize: 16 }}><ClockCircleOutlined /> {hm(r.brewStartAt)}</b>
              <div><Tag color={URGENCY[r.urgency].color}>{URGENCY[r.urgency].text}</Tag></div>
            </>,
          },
          {
            title: 'Giờ giao / nhận', width: 140, render: (_, r) => <>
              <b>{hm(r.deliverAt)}</b>
              <div className="a-muted small">{r.scheduled ? 'Khách hẹn giờ' : 'Giao ngay (ước tính)'}</div>
            </>,
          },
          {
            title: 'Đơn', render: (_, r) => r.orderId ? <>
              <a onClick={() => setOrderId(r.orderId!)}>{r.orderCode}</a> <Tag>{ORDER_TYPE[r.orderType]}</Tag>
              {r.status && <div><StatusTag label={ORDER_STATUS[r.status]} /></div>}
            </> : <>
              <Tag icon={<SyncOutlined />} color="purple">Gói {r.subscriptionCode}</Tag>
              <div className="a-muted small">Dự kiến — đơn tự tạo lúc {r.autoCreateAt ? hm(r.autoCreateAt) : '—'}</div>
            </>,
          },
          { title: 'Món', render: (_, r) => <>{r.items}<div className="a-muted small">{r.cups} ly{r.note ? ` · ${r.note}` : ''}</div></> },
          {
            title: 'Thời gian', width: 150, render: (_, r) => (
              <Tooltip title="Pha chế (theo công thức) + chạy xe (km ÷ tốc độ) + 5 phút đóng gói">
                <span className="small">Pha {r.prepMinutes}′{r.orderType === 'DELIVERY' && ` · đi ${r.travelMinutes}′`}</span>
              </Tooltip>
            ),
          },
          {
            title: 'Khách / giao tới', render: (_, r) => <>
              {r.customerName ?? '—'}{r.phone && <span className="a-muted"> · {r.phone}</span>}
              {r.address && <div className="a-muted small">{r.address}</div>}
              {r.shipperName && <div className="small">Người giao: <b>{r.shipperName}</b></div>}
            </>,
          },
          {
            title: '', width: 220, render: (_, r) => {
              const o = r.orderId ? byId.get(r.orderId) : undefined
              return o ? <OrderActions order={o} compact onDone={() => refetch()} /> : null
            },
          },
        ]} />
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}
