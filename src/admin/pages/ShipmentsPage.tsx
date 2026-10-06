import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select, Table } from 'antd'
import { coreApi } from '@/api/core'
import type { Shipment, ShipmentStatus } from '@/api/types'
import { SHIPMENT_STATUS, dateTime, money, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

const NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = { PENDING: 'BOOKED', BOOKED: 'DRIVER_ACCEPTED', DRIVER_ACCEPTED: 'DELIVERING', DELIVERING: 'DELIVERED' }

export function ShipmentsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['shipments'], queryFn: coreApi.shipments, refetchInterval: 30000 })
  const [edit, setEdit] = useState<Shipment | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const save = useAction((v: { id: number; status: ShipmentStatus; carrier?: string; trackingCode?: string; note?: string }) =>
    coreApi.updateShipment(v.id, v), [['shipments'], ['orders']])

  return (
    <>
      <PageHeader title="Điều phối giao hàng" subtitle="Đặt xe → tài xế nhận đơn → đang giao → đã giao" />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, s) => <a onClick={() => setOrderId(s.orderId)}>{v}</a> },
          { title: 'Người nhận', render: (_, s) => <>{s.recipientName}<div className="a-muted">{s.recipientPhone}</div></> },
          { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true },
          { title: 'Vận chuyển', render: (_, s) => s.carrier ? <>{s.carrier}<div className="a-muted">{s.trackingCode}</div></> : '—' },
          { title: 'Phí', dataIndex: 'shippingFee', render: money },
          { title: 'Trạng thái', render: (_, s) => <StatusTag label={SHIPMENT_STATUS[s.status]} /> },
          { title: 'Mốc thời gian', render: (_, s) => <div className="a-muted small">Đặt xe {dateTime(s.bookedAt)}<br />Giao xong {dateTime(s.deliveredAt)}</div> },
          {
            title: '', render: (_, s) => NEXT[s.status] && (
              <Button size="small" type="primary" onClick={() => setEdit(s)}>{SHIPMENT_STATUS[NEXT[s.status]!].text}</Button>
            ),
          },
        ]}
      />
      <Modal open={!!edit} title={`Cập nhật giao hàng ${edit?.orderCode}`} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        {edit && (
          <Form layout="vertical" initialValues={{ ...edit, status: NEXT[edit.status] }}
            onFinish={(v) => save.mutate({ id: edit.id, ...v }, { onSuccess: () => setEdit(null) })}>
            <Form.Item name="status" label="Trạng thái mới"><Select options={options(SHIPMENT_STATUS)} /></Form.Item>
            <Form.Item name="carrier" label="Đơn vị vận chuyển"><Select allowClear options={['Grab', 'Be', 'Ahamove', 'Lalamove', 'Shipper cửa hàng'].map((x) => ({ value: x, label: x }))} /></Form.Item>
            <Form.Item name="trackingCode" label="Mã vận đơn"><Input /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={save.isPending}>Cập nhật</Button>
          </Form>
        )}
      </Modal>
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}
