import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Modal, Segmented, Space, Table, Tabs, Timeline } from 'antd'
import { coreApi } from '@/api/core'
import type { Shipment, ShipmentStatus } from '@/api/types'
import { ORDER_STATUS, SHIPMENT_STATUS, dateTime, money, num } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { DeliveryFeeSettings } from '../components/DeliveryFeeSettings'
import { useAction } from '../components/useCrud'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

/**
 * Giao hàng (quán tự giao): danh sách đơn giao với trạng thái chờ giao → đang giao → đã giao / giao không thành công,
 * và cấu hình phí ship theo km (địa chỉ quán, các khoảng km, miễn phí từ, đơn tối thiểu).
 */
export function ShipmentsPage() {
  const { can } = usePerm()
  const [params, setParams] = useSearchParams()
  const canFee = can(P.DELIVERY_ZONES)
  const tab = params.get('tab') === 'fee' && canFee ? 'fee' : 'orders'
  return (
    <>
      <PageHeader title="Giao hàng" />
      <Tabs activeKey={tab} onChange={(k) => setParams(k === 'fee' ? { tab: 'fee' } : {}, { replace: true })}
        items={[
          { key: 'orders', label: 'Đơn giao', children: <ShipmentList /> },
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

  return (
    <>
      <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} style={{ marginBottom: 12 }}
        options={[{ value: 'active', label: `Đang xử lý (${data.filter((s) => ACTIVE.includes(s.status)).length})` }, { value: 'all', label: 'Tất cả' }]} />
      <Table<Shipment> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 1000 }}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, s) => <><a onClick={() => setOrderId(s.orderId)}>{v}</a>{s.orderStatus && <div><StatusTag label={ORDER_STATUS[s.orderStatus]} /></div>}</> },
          { title: 'Người nhận', render: (_, s) => <>{s.recipientName}<div className="a-muted">{s.recipientPhone}</div></> },
          { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true },
          { title: 'Quãng đường', render: (_, s) => (s.distanceKm != null ? <>{num(s.distanceKm)} km{s.feeTier && <div className="a-muted small">bậc {s.feeTier}</div>}</> : '—') },
          { title: 'Phí ship', dataIndex: 'shippingFee', align: 'right', render: (v: number) => (v ? money(v) : 'Miễn phí') },
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
            <b>{e.status ? SHIPMENT_STATUS[e.status].text : '—'}</b>
            <div className="a-muted small">{dateTime(e.at)} · {e.by}</div>
            {e.note && <div className="small">{e.note}</div>}
          </>,
        }))} />
      </Drawer>
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}
