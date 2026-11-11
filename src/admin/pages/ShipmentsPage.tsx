import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Modal, Segmented, Select, Space, Table, Tabs, Tag, Timeline, Tooltip } from 'antd'
import { NodeIndexOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Shipment, ShipmentStatus, ShipperStat } from '@/api/types'
import { ORDER_STATUS, SHIPMENT_STATUS, dateTime, money, num } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { DeliveryFeeSettings } from '../components/DeliveryFeeSettings'
import { useAction } from '../components/useCrud'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'
import { RouteDrawer } from '../components/RouteMap'

/**
 * Giao hàng (quán tự giao): danh sách đơn giao với trạng thái chờ giao → đang giao → đã giao / giao không thành công,
 * phân công người giao, tuyến giao trên bản đồ, theo dõi người giao, và cấu hình phí ship theo khu vực.
 */
export function ShipmentsPage() {
  const { can } = usePerm()
  const [params, setParams] = useSearchParams()
  const canFee = can(P.DELIVERY_ZONES)
  const tab = params.get('tab') === 'fee' && canFee ? 'fee' : params.get('tab') === 'shippers' ? 'shippers' : 'orders'
  return (
    <>
      <PageHeader title="Giao hàng" />
      <Tabs activeKey={tab} onChange={(k) => setParams(k === 'orders' ? {} : { tab: k }, { replace: true })}
        items={[
          { key: 'orders', label: 'Đơn giao', children: <ShipmentList /> },
          { key: 'shippers', label: 'Người giao', children: <ShippersTab /> },
          ...(canFee ? [{ key: 'fee', label: 'Phí giao hàng', children: <DeliveryFeeSettings /> }] : []),
        ]} />
    </>
  )
}

const ACTIVE: ShipmentStatus[] = ['PENDING', 'BOOKED', 'DRIVER_ACCEPTED', 'DELIVERING']
const waiting = (s: ShipmentStatus) => s === 'PENDING' || s === 'BOOKED' || s === 'DRIVER_ACCEPTED'

function ShipmentList() {
  const { data = [], isLoading } = useQuery({ queryKey: ['shipments'], queryFn: coreApi.shipments, refetchInterval: 15000 })
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const rows = data.filter((s) => filter === 'all' || ACTIVE.includes(s.status))
  const [failing, setFailing] = useState<Shipment | null>(null)
  const [historyOf, setHistoryOf] = useState<Shipment | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const keys = [['shipments'], ['orders']]
  const save = useAction((v: { id: number; status: ShipmentStatus; note?: string }) => coreApi.updateShipment(v.id, v), keys)
  const { data: events = [] } = useQuery({ queryKey: ['shipment-events', historyOf?.id], enabled: !!historyOf, queryFn: () => coreApi.shipmentEvents(historyOf!.id) })
  const { data: shippers = [] } = useQuery({ queryKey: ['shippers'], queryFn: coreApi.shippers, refetchInterval: 30000 })
  const assign = useAction((v: { id: number; staffId: number | null }) => coreApi.assignShipper(v.id, v.staffId), [...keys, ['shippers']], 'Đã phân công')
  const [selected, setSelected] = useState<number[]>([])
  const [route, setRoute] = useState<number[] | null>(null)
  const busy = (st: ShipperStat) => st.pending + st.delivering

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)}
          options={[{ value: 'active', label: `Đang xử lý (${data.filter((s) => ACTIVE.includes(s.status)).length})` }, { value: 'all', label: 'Tất cả' }]} />
        <Button icon={<NodeIndexOutlined />} disabled={!selected.length} onClick={() => setRoute(selected)}>
          Xem tuyến giao{selected.length ? ` (${selected.length} đơn)` : ''}
        </Button>
      </Space>
      <Table<Shipment> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 1200 }}
        rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as number[]), getCheckboxProps: (s) => ({ disabled: !ACTIVE.includes(s.status) }) }}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, s) => <><a onClick={() => setOrderId(s.orderId)}>{v}</a>{s.orderStatus && <div><StatusTag label={ORDER_STATUS[s.orderStatus]} /></div>}</> },
          { title: 'Hẹn giao', width: 110, render: (_, s) => (s.pickupTime ? <Tag color="purple">{dateTime(s.pickupTime)}</Tag> : <span className="a-muted small">Giao ngay</span>) },
          { title: 'Người nhận', render: (_, s) => <>{s.recipientName}<div className="a-muted">{s.recipientPhone}</div></> },
          { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true, render: (v: string, s) => <Tooltip title={v}>{v}{s.zone && <div className="a-muted small">{s.zone}{s.distanceKm != null && ` · ~${num(s.distanceKm)} km`}</div>}</Tooltip> },
          { title: 'Phí ship', dataIndex: 'shippingFee', align: 'right', render: (v: number) => (v ? money(v) : 'Miễn phí') },
          {
            title: 'Người giao', width: 190, render: (_, s) => waiting(s.status) ? (
              <Select size="small" style={{ width: 175 }} allowClear placeholder="Phân công…" value={s.shipperId}
                loading={assign.isPending} onChange={(v?: number) => assign.mutate({ id: s.id, staffId: v ?? null })}
                options={shippers.map((st) => ({ value: st.id, label: `${st.fullName}${busy(st) ? ` · ${busy(st)} đơn` : ''}` }))} />
            ) : s.shipperName ? <>{s.shipperName}<div className="a-muted small">{s.shipperPhone}</div></> : '—',
          },
          { title: 'Trạng thái', render: (_, s) => <><StatusTag label={SHIPMENT_STATUS[s.status]} />{s.status === 'FAILED' && s.note && <div className="a-muted small">{s.note}</div>}</> },
          {
            title: '', render: (_, s) => (
              <Space wrap>
                {waiting(s.status) && (
                  <Button size="small" type="primary" disabled={s.orderStatus !== 'READY'} loading={save.isPending}
                    title={s.orderStatus !== 'READY' ? 'Chờ đồ uống pha xong' : undefined}
                    onClick={() => save.mutate({ id: s.id, status: 'DELIVERING' })}>Bắt đầu giao</Button>
                )}
                {s.status === 'DELIVERING' && <>
                  <Button size="small" type="primary" loading={save.isPending} onClick={() => save.mutate({ id: s.id, status: 'DELIVERED' })}>Đã giao</Button>
                  <Button size="small" danger onClick={() => setFailing(s)}>Không giao được</Button>
                </>}
                <Button size="small" type="link" onClick={() => setHistoryOf(s)}>Lịch sử</Button>
              </Space>
            ),
          },
        ]} />

      <Modal open={!!failing} title={`Giao không thành công · ${failing?.orderCode}`} footer={null} onCancel={() => setFailing(null)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { note: string }) => save.mutate({ id: failing!.id, status: 'FAILED', note: v.note }, { onSuccess: () => setFailing(null) })}>
          <Form.Item name="note" label="Lý do" rules={[{ required: true, message: 'Nhập lý do' }]}><Input.TextArea rows={2} placeholder="Khách không nghe máy, sai địa chỉ…" /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={save.isPending}>Xác nhận</Button>
        </Form>
      </Modal>

      <Drawer open={!!historyOf} title={`Lịch sử giao · ${historyOf?.orderCode}`} onClose={() => setHistoryOf(null)} width={420}>
        <Timeline items={events.map((e) => ({
          children: <>
            <b>{e.status ? SHIPMENT_STATUS[e.status].text : 'Phân công'}</b>
            <div className="a-muted small">{dateTime(e.at)} · {e.by}</div>
            {e.note && <div className="small">{e.note}</div>}
          </>,
        }))} />
      </Drawer>
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      <RouteDrawer shipmentIds={route} onClose={() => setRoute(null)} title={`Tuyến giao · ${route?.length ?? 0} đơn`} />
    </>
  )
}

/** Theo dõi người giao: ai đang cầm bao nhiêu đơn, hôm nay giao được / thất bại, thời gian giao trung bình; xem tuyến từng người. */
function ShippersTab() {
  const { data = [], isLoading } = useQuery({ queryKey: ['shippers'], queryFn: coreApi.shippers, refetchInterval: 30000 })
  const { data: shipments = [] } = useQuery({ queryKey: ['shipments'], queryFn: coreApi.shipments, refetchInterval: 15000 })
  const [route, setRoute] = useState<{ name: string; ids: number[] } | null>(null)
  const openOf = (id: number) => shipments.filter((s) => s.shipperId === id && ACTIVE.includes(s.status)).map((s) => s.id)
  return (
    <>
      <Table<ShipperStat> rowKey="id" loading={isLoading} dataSource={data} pagination={false}
        columns={[
          { title: 'Nhân viên', render: (_, st) => <><b>{st.fullName}</b><div className="a-muted small">{st.position ?? ''} · {st.phone}</div></> },
          { title: 'Chờ giao', dataIndex: 'pending', align: 'center', width: 100, render: (v: number) => (v ? <Tag color="gold">{v}</Tag> : 0) },
          { title: 'Đang giao', dataIndex: 'delivering', align: 'center', width: 100, render: (v: number) => (v ? <Tag color="geekblue">{v}</Tag> : 0) },
          { title: 'Đã giao hôm nay', dataIndex: 'deliveredToday', align: 'center', width: 130 },
          { title: 'Thất bại hôm nay', dataIndex: 'failedToday', align: 'center', width: 130, render: (v: number) => (v ? <Tag color="red">{v}</Tag> : 0) },
          { title: 'TB mỗi đơn', dataIndex: 'avgMinutesToday', align: 'center', width: 110, render: (v?: number) => (v != null ? `${v} phút` : '—') },
          {
            title: '', width: 130, render: (_, st) => {
              const ids = openOf(st.id)
              return <Button size="small" icon={<NodeIndexOutlined />} disabled={!ids.length} onClick={() => setRoute({ name: st.fullName, ids })}>Tuyến giao</Button>
            },
          },
        ]} />
      <RouteDrawer shipmentIds={route?.ids ?? null} onClose={() => setRoute(null)} title={`Tuyến giao · ${route?.name ?? ''}`} />
    </>
  )
}
