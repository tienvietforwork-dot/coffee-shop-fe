import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, DatePicker, Segmented, Select, Space, Table, Tag } from 'antd'
import { AppstoreOutlined, UnorderedListOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Order, OrderChannel, OrderStatus } from '@/api/types'
import { ORDER_CHANNEL, ORDER_STATUS, ORDER_TYPE, money, time, dateTime, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { OrderActions } from '../components/OrderActions'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

const COLUMNS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']

export function OrdersBoardPage() {
  const qc = useQueryClient()
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
  const byStatus = useMemo(() => {
    const m: Record<string, Order[]> = {}
    for (const o of orders) (m[o.status] ??= []).push(o)
    Object.values(m).forEach((l) => l.sort((a, b) => a.orderedAt.localeCompare(b.orderedAt)))
    return m
  }, [orders])
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
          {COLUMNS.map((s) => (
            <div key={s} className="a-col">
              <div className="a-col-head"><StatusTag label={ORDER_STATUS[s]} /><Badge count={byStatus[s]?.length ?? 0} showZero color="#8c6a52" /></div>
              <div className="a-col-body">
                {(byStatus[s] ?? []).map((o) => (
                  <div key={o.id} className={`a-ticket ${o.status === 'PENDING' ? 'is-new' : ''}`} onClick={() => setOpenId(o.id)}>
                    <div className="a-ticket-head">
                      <b>{o.orderCode.slice(-4)}</b>
                      <Tag color={ORDER_CHANNEL[o.channel].color} bordered={false}>{ORDER_CHANNEL[o.channel].text}</Tag>
                      <span className="a-muted">{time(o.orderedAt)}</span>
                    </div>
                    <div className="a-ticket-meta">
                      {ORDER_TYPE[o.orderType]}{o.tableNo && ` · Bàn ${o.tableNo}`}{o.staffName && ` · ${o.staffName}`}
                    </div>
                    <ul>
                      {o.items.map((i) => <li key={i.id}><b>{i.quantity}×</b> {i.coffeeName}{i.note && <em> — {i.note}</em>}</li>)}
                    </ul>
                    <div className="a-ticket-foot">
                      <span>{money(o.totalAmount)} {o.paid ? <Tag color="green" bordered={false}>Đã TT</Tag> : <Tag color="gold" bordered={false}>Chưa TT</Tag>}</span>
                    </div>
                    <OrderActions order={o} onDone={done} compact />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={orders}
          onRow={(o) => ({ onClick: () => setOpenId(o.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Mã đơn', dataIndex: 'orderCode' },
            { title: 'Thời gian', dataIndex: 'orderedAt', render: dateTime },
            { title: 'Kênh', render: (_, o) => <StatusTag label={ORDER_CHANNEL[o.channel]} /> },
            { title: 'Hình thức', render: (_, o) => `${ORDER_TYPE[o.orderType]}${o.tableNo ? ` · ${o.tableNo}` : ''}` },
            { title: 'Khách', render: (_, o) => o.customerName || o.customerPhone || 'Khách lẻ' },
            { title: 'Tổng', dataIndex: 'totalAmount', render: money, align: 'right' },
            { title: 'Trạng thái', render: (_, o) => <StatusTag label={ORDER_STATUS[o.status]} /> },
          ]}
        />
      )}
      <OrderDetailDrawer orderId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
