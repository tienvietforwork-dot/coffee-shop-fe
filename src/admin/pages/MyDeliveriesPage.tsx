import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Empty, Form, Input, Modal, Segmented, Space, Spin, Tag } from 'antd'
import { CarOutlined, EnvironmentOutlined, PhoneOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Shipment, ShipmentStatus } from '@/api/types'
import { ORDER_STATUS, SHIPMENT_STATUS, dateTime, money } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { RoutePlanView } from '../components/RouteMap'

const OPEN: ShipmentStatus[] = ['PENDING', 'BOOKED', 'DRIVER_ACCEPTED', 'DELIVERING']

/**
 * Người giao: đơn được phân công cho mình (chờ lấy đồ / đang giao, đã xong hôm nay), tuyến đi gợi ý trên bản đồ,
 * mở Google Maps chỉ đường, gọi khách, cập nhật đã giao / không giao được.
 */
export function MyDeliveriesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['my-deliveries'], queryFn: coreApi.myDeliveries, refetchInterval: 15000 })
  const [view, setView] = useState<'open' | 'done'>('open')
  const open = data.filter((s) => OPEN.includes(s.status))
  const rows = view === 'open' ? open : data.filter((s) => !OPEN.includes(s.status))
  const ids = open.map((s) => s.id)
  const { data: plan, isFetching: routing } = useQuery({
    queryKey: ['shipment-route', ids], enabled: ids.length > 0, queryFn: () => coreApi.shipmentRoute(ids), staleTime: 60_000, retry: false,
  })
  const [failing, setFailing] = useState<Shipment | null>(null)
  const save = useAction((v: { id: number; status: ShipmentStatus; note?: string }) => coreApi.updateShipment(v.id, v), [['my-deliveries'], ['shipments']])
  // thứ tự đi theo tuyến gợi ý
  const order = new Map([...(plan?.stops ?? []), ...(plan?.unlocated ?? [])].map((s, i) => [s.shipmentId, i + 1]))
  const sorted = view === 'open' ? [...rows].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)) : rows

  return (
    <>
      <PageHeader title="Đơn giao của tôi" subtitle="Đơn quản lý đã phân công cho bạn"
        extra={plan?.googleMapsUrl && <Button type="primary" icon={<CarOutlined />} href={plan.googleMapsUrl} target="_blank" rel="noreferrer">Chỉ đường cả tuyến</Button>} />
      <Segmented value={view} onChange={(v) => setView(v as typeof view)} style={{ marginBottom: 12 }}
        options={[{ value: 'open', label: `Cần giao (${open.length})` }, { value: 'done', label: `Đã xong hôm nay (${data.length - open.length})` }]} />
      {view === 'open' && ids.length > 0 && (
        <Card size="small" title="Tuyến giao gợi ý" style={{ marginBottom: 12 }}>
          {routing && !plan ? <Spin /> : plan && <RoutePlanView plan={plan} />}
        </Card>
      )}
      {isLoading ? <Spin /> : !sorted.length ? <Empty description={view === 'open' ? 'Chưa có đơn nào cần giao' : 'Hôm nay chưa xong đơn nào'} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {sorted.map((s) => (
            <Card key={s.id} size="small"
              title={<Space>{order.get(s.id) && view === 'open' && <Tag color="blue">#{order.get(s.id)}</Tag>}{s.orderCode}</Space>}
              extra={<StatusTag label={SHIPMENT_STATUS[s.status]} />}>
              <div><b>{s.recipientName}</b> · <a href={`tel:${s.recipientPhone}`}><PhoneOutlined /> {s.recipientPhone}</a></div>
              <div style={{ margin: '4px 0' }}><EnvironmentOutlined /> {s.address}</div>
              {s.pickupTime && <Tag color="purple">Hẹn giao {dateTime(s.pickupTime)}</Tag>}
              {s.orderStatus && <StatusTag label={ORDER_STATUS[s.orderStatus]} />}
              <div style={{ margin: '6px 0' }}>
                {s.paid ? <Tag color="green">Đã thanh toán</Tag> : <Tag color="red">Thu hộ {money(s.orderTotal ?? 0)}</Tag>}
              </div>
              {s.orderNote && <div className="a-muted small">Ghi chú: {s.orderNote}</div>}
              {s.status === 'FAILED' && s.note && <div className="small" style={{ color: '#cf1322' }}>{s.note}</div>}
              {OPEN.includes(s.status) && (
                <Space wrap style={{ marginTop: 8 }}>
                  <Button size="small" icon={<CarOutlined />} target="_blank" rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=${encodeURIComponent(s.address)}`}>Chỉ đường</Button>
                  {s.status !== 'DELIVERING' ? (
                    <Button size="small" type="primary" disabled={s.orderStatus !== 'READY'} loading={save.isPending}
                      title={s.orderStatus !== 'READY' ? 'Chờ quầy pha xong' : undefined}
                      onClick={() => save.mutate({ id: s.id, status: 'DELIVERING' })}>Đã lấy đồ, bắt đầu giao</Button>
                  ) : <>
                    <Button size="small" type="primary" loading={save.isPending} onClick={() => save.mutate({ id: s.id, status: 'DELIVERED' })}>Đã giao</Button>
                    <Button size="small" danger onClick={() => setFailing(s)}>Không giao được</Button>
                  </>}
                </Space>
              )}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!failing} title={`Giao không thành công · ${failing?.orderCode}`} footer={null} onCancel={() => setFailing(null)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { note: string }) => save.mutate({ id: failing!.id, status: 'FAILED', note: v.note }, { onSuccess: () => setFailing(null) })}>
          <Form.Item name="note" label="Lý do" rules={[{ required: true, message: 'Nhập lý do' }]}><Input.TextArea rows={2} placeholder="Khách không nghe máy, sai địa chỉ…" /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={save.isPending}>Xác nhận</Button>
        </Form>
      </Modal>
    </>
  )
}
