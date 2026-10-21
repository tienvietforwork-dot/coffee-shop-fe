import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Drawer, Form, Input, Modal, Segmented, Select, Space, Spin, Table, Tag, Timeline } from 'antd'
import { CarOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Shipment, ShipmentStatus } from '@/api/types'
import { CARRIERS, ORDER_STATUS, SHIPMENT_STATUS, dateTime, money, num, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

const NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = { PENDING: 'BOOKED', BOOKED: 'DRIVER_ACCEPTED', DRIVER_ACCEPTED: 'DELIVERING', DELIVERING: 'DELIVERED' }
const ACTIVE: ShipmentStatus[] = ['PENDING', 'BOOKED', 'DRIVER_ACCEPTED', 'DELIVERING']

/**
 * Sổ giao hàng: đặt xe Ahamove (báo giá → đặt → trạng thái tự về qua webhook, hủy chuyến khi tài xế chưa lấy hàng) hoặc
 * gọi xe ngoài (Grab, Be, shipper quán) và cập nhật tay. Phí ship khách trả (theo khu vực) đặt cạnh phí quán trả đối tác.
 */
export function ShipmentsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['shipments'], queryFn: coreApi.shipments, refetchInterval: 15000 })
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const rows = data.filter((s) => filter === 'all' || ACTIVE.includes(s.status))
  const [manual, setManual] = useState<Shipment | null>(null)
  const [booking, setBooking] = useState<Shipment | null>(null)
  const [cancelling, setCancelling] = useState<Shipment | null>(null)
  const [historyOf, setHistoryOf] = useState<Shipment | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const keys = [['shipments'], ['orders']]
  const save = useAction((v: { id: number; status: ShipmentStatus; carrier?: string; trackingCode?: string; note?: string }) =>
    coreApi.updateShipment(v.id, v), keys)
  const book = useAction(coreApi.ahamoveBook, keys, 'Đã đặt xe Ahamove')
  const cancel = useAction((v: { id: number; reason: string }) => coreApi.ahamoveCancel(v.id, v.reason), keys, 'Đã hủy chuyến')
  const { data: estimate, isFetching: estimating, error: estimateError } = useQuery({
    queryKey: ['ahamove-estimate', booking?.id], enabled: !!booking, retry: false, queryFn: () => coreApi.ahamoveEstimate(booking!.id),
  })
  const { data: events = [] } = useQuery({ queryKey: ['shipment-events', historyOf?.id], enabled: !!historyOf, queryFn: () => coreApi.shipmentEvents(historyOf!.id) })
  const viaAhamove = (s: Shipment) => s.partner === 'AHAMOVE' && ['BOOKED', 'DRIVER_ACCEPTED', 'DELIVERING'].includes(s.status)

  return (
    <>
      <PageHeader title="Điều phối giao hàng" subtitle="Đặt xe Ahamove hoặc gọi xe ngoài · chờ đặt xe → tài xế nhận → đang giao → đã giao" />
      <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} style={{ marginBottom: 12 }}
        options={[{ value: 'active', label: `Đang xử lý (${data.filter((s) => ACTIVE.includes(s.status)).length})` }, { value: 'all', label: 'Tất cả' }]} />
      <Table<Shipment> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 1150 }}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, s) => <><a onClick={() => setOrderId(s.orderId)}>{v}</a>{s.orderStatus && <div><StatusTag label={ORDER_STATUS[s.orderStatus]} /></div>}</> },
          { title: 'Người nhận', render: (_, s) => <>{s.recipientName}<div className="a-muted">{s.recipientPhone}</div></> },
          { title: 'Địa chỉ', render: (_, s) => <>{s.address}{s.district && <div className="a-muted small">{s.district}{s.zoneName && ` · ${s.zoneName}`}</div>}</>, ellipsis: true },
          {
            title: 'Vận chuyển', render: (_, s) => (s.carrier ? <>
              {s.partner === 'AHAMOVE' ? <Tag color="orange">Ahamove</Tag> : s.carrier}
              <div className="a-muted small">{s.trackingUrl ? <a href={s.trackingUrl} target="_blank" rel="noreferrer">{s.trackingCode}</a> : s.trackingCode}</div>
              {s.driverName && <div className="small">{s.driverName} · {s.driverPhone}</div>}
            </> : '—'),
          },
          { title: 'Phí khách trả / quán trả', render: (_, s) => <>{money(s.shippingFee)}{s.partnerFee != null && <div className={s.partnerFee > s.shippingFee ? 'a-limit small' : 'a-muted small'}>đối tác {money(s.partnerFee)}{s.distanceKm != null && ` · ${num(s.distanceKm)} km`}</div>}</> },
          { title: 'Trạng thái', render: (_, s) => <><StatusTag label={SHIPMENT_STATUS[s.status]} />{s.partnerStatus && s.partner && <div className="a-muted small">{s.partnerStatus}</div>}</> },
          {
            title: '', render: (_, s) => (
              <Space wrap>
                {s.status === 'PENDING' && <Button size="small" type="primary" icon={<CarOutlined />} onClick={() => setBooking(s)}>Đặt xe Ahamove</Button>}
                {s.status === 'PENDING' && <Button size="small" onClick={() => setManual(s)}>Gọi xe ngoài</Button>}
                {!viaAhamove(s) && s.status !== 'PENDING' && NEXT[s.status] && <Button size="small" type="primary" onClick={() => setManual(s)}>{SHIPMENT_STATUS[NEXT[s.status]!].text}</Button>}
                {viaAhamove(s) && s.status !== 'DELIVERING' && <Button size="small" danger onClick={() => setCancelling(s)}>Hủy chuyến</Button>}
                <Button size="small" type="link" onClick={() => setHistoryOf(s)}>Lịch sử</Button>
              </Space>
            ),
          },
        ]} />

      <Modal open={!!booking} title={`Đặt xe Ahamove · ${booking?.orderCode}`} onCancel={() => setBooking(null)} destroyOnHidden
        footer={<Button type="primary" disabled={!estimate} loading={book.isPending} onClick={() => book.mutate(booking!.id, { onSuccess: () => setBooking(null) })}>Đặt xe</Button>}>
        {estimating ? <Spin /> : estimateError ? <Alert type="error" message="Không lấy được báo giá Ahamove" description={String((estimateError as Error).message)} /> : estimate && (
          <Descriptions size="small" column={1} bordered items={[
            { label: 'Giao tới', children: booking?.address },
            { label: 'Dịch vụ', children: estimate.serviceId },
            { label: 'Quãng đường', children: estimate.distanceKm != null ? `${num(estimate.distanceKm)} km` : '—' },
            { label: 'Thời gian dự kiến', children: estimate.durationMinutes ? `${estimate.durationMinutes} phút` : '—' },
            { label: 'Phí Ahamove (quán trả)', children: <b>{money(estimate.fee)}</b> },
            { label: 'Phí khách đã trả', children: money(booking?.shippingFee) },
          ]} />
        )}
        <p className="a-muted" style={{ marginTop: 8 }}>Nên đặt xe khi đồ uống sắp xong để tài xế tới là lấy được hàng. Tài xế nhận đơn, lấy hàng, giao xong — trạng thái tự cập nhật.</p>
      </Modal>

      <Modal open={!!manual} title={`Cập nhật giao hàng ${manual?.orderCode}`} footer={null} onCancel={() => setManual(null)} destroyOnHidden>
        {manual && (
          <Form layout="vertical" initialValues={{ ...manual, status: NEXT[manual.status] }}
            onFinish={(v) => save.mutate({ id: manual.id, ...v }, { onSuccess: () => setManual(null) })}>
            <Form.Item name="status" label="Trạng thái mới"><Select options={options(SHIPMENT_STATUS)} /></Form.Item>
            <Form.Item name="carrier" label="Đơn vị vận chuyển"><Select allowClear options={CARRIERS.filter((c) => c !== 'Ahamove').map((x) => ({ value: x, label: x }))} /></Form.Item>
            <Form.Item name="trackingCode" label="Mã chuyến / vận đơn"><Input /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={save.isPending}>Cập nhật</Button>
          </Form>
        )}
      </Modal>

      <Modal open={!!cancelling} title={`Hủy chuyến Ahamove · ${cancelling?.orderCode}`} footer={null} onCancel={() => setCancelling(null)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { reason: string }) => cancel.mutate({ id: cancelling!.id, reason: v.reason }, { onSuccess: () => setCancelling(null) })}>
          <p className="a-muted">Chỉ hủy được khi tài xế chưa lấy hàng. Đơn giao trở về "chờ đặt xe".</p>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={cancel.isPending}>Hủy chuyến</Button>
        </Form>
      </Modal>

      <Drawer open={!!historyOf} title={`Lịch sử chuyến · ${historyOf?.orderCode}`} onClose={() => setHistoryOf(null)} width={480}>
        <Timeline items={events.map((e) => ({
          color: e.source === 'PARTNER' ? 'orange' : 'blue',
          children: <>
            <b>{e.status ? SHIPMENT_STATUS[e.status].text : '—'}</b>{e.partnerStatus && <Tag style={{ marginLeft: 6 }}>{e.partnerStatus}</Tag>}
            <div className="a-muted small">{dateTime(e.at)} · {e.source === 'PARTNER' ? 'Ahamove' : e.by}</div>
            {e.note && <div className="small">{e.note}</div>}
          </>,
        }))} />
      </Drawer>
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}
