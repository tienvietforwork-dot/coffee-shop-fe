import { useState } from 'react'
import { App, Button, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Timeline } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { Order } from '@/api/types'
import {
  INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, ORDER_CHANNEL, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD,
  PAYMENT_STATUS, SHIPMENT_STATUS, dateTime, money, options,
} from '@/lib/format'
import { StatusTag } from './StatusTag'
import { OrderActions } from './OrderActions'
import { P, usePerm } from '@/lib/perm'

export function OrderDetailDrawer({ orderId, onClose }: { orderId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { can } = usePerm()
  const canRefund = can(P.ORDERS_REFUND)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [refund, setRefund] = useState<{ id: number; max: number } | null>(null)
  const [refundAmount, setRefundAmount] = useState<number | null>(null)

  const { data: order } = useQuery({ queryKey: ['order', orderId], queryFn: () => coreApi.order(orderId!), enabled: !!orderId })
  const { data: incidents = [] } = useQuery({
    queryKey: ['order-incidents', orderId], queryFn: () => coreApi.orderIncidents(orderId!), enabled: !!orderId,
  })

  const refresh = (o?: Order) => {
    if (o) qc.setQueryData(['order', o.id], o)
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['order-incidents', orderId] })
    qc.invalidateQueries({ queryKey: ['incidents'] })
  }

  const report = useMutation({
    mutationFn: (v: Parameters<typeof coreApi.reportIncident>[1]) => coreApi.reportIncident(orderId!, v),
    onSuccess: () => { setIncidentOpen(false); refresh(); message.success('Đã ghi nhận sự cố') },
    onError: (e) => message.error(errorMessage(e)),
  })
  const doRefund = useMutation({
    mutationFn: () => coreApi.refund(refund!.id, refundAmount!),
    onSuccess: () => { setRefund(null); qc.invalidateQueries({ queryKey: ['order', orderId] }); message.success('Đã hoàn tiền') },
    onError: (e) => message.error(errorMessage(e)),
  })

  return (
    <Drawer
      open={!!orderId}
      onClose={onClose}
      width={640}
      title={order ? <Space>Đơn {order.orderCode}<StatusTag label={ORDER_STATUS[order.status]} /></Space> : 'Đơn hàng'}
      extra={order && <OrderActions order={order} onDone={refresh} />}
    >
      {order && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Kênh"><StatusTag label={ORDER_CHANNEL[order.channel]} /></Descriptions.Item>
            <Descriptions.Item label="Hình thức">{ORDER_TYPE[order.orderType]}{order.tableNo && ` · Bàn ${order.tableNo}`}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{order.customerName || order.customerPhone || 'Khách lẻ'}{order.customerName && order.customerPhone && ` · ${order.customerPhone}`}</Descriptions.Item>
            <Descriptions.Item label="Barista">{order.staffName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Đặt lúc">{dateTime(order.orderedAt)}</Descriptions.Item>
            <Descriptions.Item label="Hẹn nhận">{dateTime(order.pickupTime)}</Descriptions.Item>
            {order.note && <Descriptions.Item label="Ghi chú" span={2}>{order.note}</Descriptions.Item>}
            {order.cancelReason && <Descriptions.Item label="Lý do hủy" span={2}>{order.cancelReason}</Descriptions.Item>}
          </Descriptions>

          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={order.items}
            columns={[
              { title: 'Món', render: (_, i) => <>{i.coffeeName}{i.note && <div className="a-note">📝 {i.note}</div>}</> },
              { title: 'SL', dataIndex: 'quantity', width: 50, align: 'center' },
              { title: 'Đơn giá', dataIndex: 'unitPrice', render: money, align: 'right' },
              { title: 'Thành tiền', dataIndex: 'lineTotal', render: money, align: 'right' },
            ]}
            summary={() => (
              <>
                <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>Tạm tính</Table.Summary.Cell><Table.Summary.Cell index={1} align="right">{money(order.subtotal)}</Table.Summary.Cell></Table.Summary.Row>
                {order.discountAmount > 0 && <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>Giảm giá {order.promotionName && `(${order.promotionName})`}</Table.Summary.Cell><Table.Summary.Cell index={1} align="right">-{money(order.discountAmount)}</Table.Summary.Cell></Table.Summary.Row>}
                {order.shippingFee > 0 && <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}>Phí giao hàng</Table.Summary.Cell><Table.Summary.Cell index={1} align="right">{money(order.shippingFee)}</Table.Summary.Cell></Table.Summary.Row>}
                <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={3}><b>Tổng cộng</b></Table.Summary.Cell><Table.Summary.Cell index={1} align="right"><b>{money(order.totalAmount)}</b></Table.Summary.Cell></Table.Summary.Row>
              </>
            )}
          />

          <div>
            <h4>Thanh toán</h4>
            {order.payments.map((p) => (
              <div key={p.id} className="a-line">
                <span>{PAYMENT_METHOD[p.method]} · {money(p.amount)} {p.transactionCode && <Tag>{p.transactionCode}</Tag>}</span>
                <Space>
                  <StatusTag label={PAYMENT_STATUS[p.status]} />
                  {p.refundAmount > 0 && <span className="a-muted">đã hoàn {money(p.refundAmount)}</span>}
                  {canRefund && p.status === 'PAID' && p.refundAmount < p.amount && (
                    <Button size="small" onClick={() => { setRefund({ id: p.id, max: p.amount - p.refundAmount }); setRefundAmount(p.amount - p.refundAmount) }}>Hoàn tiền</Button>
                  )}
                </Space>
              </div>
            ))}
          </div>

          {order.shipment && (
            <div>
              <h4>Giao hàng</h4>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Người nhận">{order.shipment.recipientName} · {order.shipment.recipientPhone}</Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">{order.shipment.address}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái"><StatusTag label={SHIPMENT_STATUS[order.shipment.status]} /> {order.shipment.carrier} {order.shipment.trackingCode}</Descriptions.Item>
              </Descriptions>
            </div>
          )}

          <div>
            <div className="a-line">
              <h4>Sự cố</h4>
              <Button size="small" danger onClick={() => setIncidentOpen(true)}>Ghi nhận sự cố</Button>
            </div>
            {incidents.length === 0 ? <span className="a-muted">Không có sự cố</span> : (
              <Timeline items={incidents.map((i) => ({
                color: i.status === 'RESOLVED' ? 'green' : 'red',
                children: (
                  <>
                    <b>{INCIDENT_TYPE[i.type]}</b> {i.severity && <StatusTag label={INCIDENT_SEVERITY[i.severity]} />} <StatusTag label={INCIDENT_STATUS[i.status]} />
                    <div>{i.reason}</div>
                    {i.vouchers.length > 0 && <div className="a-muted">Voucher đền bù: {i.vouchers.map((v) => v.code).join(', ')}</div>}
                  </>
                ),
              }))} />
            )}
          </div>
        </Space>
      )}

      <Modal open={incidentOpen} title="Ghi nhận sự cố đơn hàng" footer={null} onCancel={() => setIncidentOpen(false)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v) => report.mutate(v)} initialValues={{ type: 'QUALITY', severity: 'MEDIUM' }}>
          <Form.Item name="type" label="Loại sự cố"><Select options={options(INCIDENT_TYPE)} /></Form.Item>
          <Form.Item name="severity" label="Mức độ"><Select options={options(INCIDENT_SEVERITY)} /></Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input maxLength={255} /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" danger htmlType="submit" loading={report.isPending} block>Ghi nhận</Button>
        </Form>
      </Modal>

      <Modal
        open={!!refund}
        title="Hoàn tiền"
        okText="Xác nhận hoàn tiền"
        onOk={() => doRefund.mutate()}
        confirmLoading={doRefund.isPending}
        onCancel={() => setRefund(null)}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={1000}
          max={refund?.max}
          value={refundAmount}
          onChange={(v) => setRefundAmount(v)}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={(v) => Number((v ?? '').replace(/\./g, ''))}
          addonAfter="đ"
        />
      </Modal>
    </Drawer>
  )
}
