import { useState, type ReactNode } from 'react'
import { App, Button, Descriptions, Drawer, InputNumber, Modal, Space, Table, Tag, Timeline } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { Order } from '@/api/types'
import {
  INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, ORDER_CHANNEL, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD,
  PAYMENT_STATUS, SHIPMENT_STATUS, dateTime, money, num,
} from '@/lib/format'
import { StatusTag } from './StatusTag'
import { OrderActions } from './OrderActions'
import { P, usePerm } from '@/lib/perm'
import { customerText, receiveText, totalDiscount } from '@/lib/orderInfo'

export function OrderDetailDrawer({ orderId, onClose }: { orderId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { can } = usePerm()
  const canRefund = can(P.ORDERS_REFUND)
  const [refund, setRefund] = useState<{ id: number; max: number } | null>(null)
  const [refundAmount, setRefundAmount] = useState<number | null>(null)

  const { data: order } = useQuery({ queryKey: ['order', orderId], queryFn: () => coreApi.order(orderId!), enabled: !!orderId })
  // under ['order', id] so the realtime refresh of the order also refreshes its history
  const { data: history = [] } = useQuery({ queryKey: ['order', orderId, 'history'], queryFn: () => coreApi.orderHistory(orderId!), enabled: !!orderId })
  const { data: incidents = [] } = useQuery({
    queryKey: ['order-incidents', orderId], queryFn: () => coreApi.orderIncidents(orderId!), enabled: !!orderId,
  })

  const refresh = (o?: Order) => {
    if (o) qc.setQueryData(['order', o.id], o)
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['order-incidents', orderId] })
    qc.invalidateQueries({ queryKey: ['incidents'] })
  }

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
            <Descriptions.Item label="Khách hàng">{customerText(order)}</Descriptions.Item>
            <Descriptions.Item label="Đặt lúc">{dateTime(order.orderedAt)}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ nhận" span={order.pickupTime ? 1 : 2}>
              {receiveText(order)}
              {order.shipment && <div className="a-muted small">Người nhận: {order.shipment.recipientName} · {order.shipment.recipientPhone}</div>}
            </Descriptions.Item>
            {order.pickupTime && <Descriptions.Item label="Hẹn nhận">{dateTime(order.pickupTime)}</Descriptions.Item>}
            {order.note && <Descriptions.Item label="Ghi chú" span={2}>{order.note}</Descriptions.Item>}
            {order.cancelReason && <Descriptions.Item label="Lý do hủy" span={2}>{order.cancelReason}</Descriptions.Item>}
          </Descriptions>

          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={order.items}
            columns={[
              { title: 'Mã SP', dataIndex: 'coffeeCode', width: 80, render: (v) => <span className="a-code">{v ?? '—'}</span> },
              { title: 'Món', render: (_, i) => <>{i.coffeeName}{i.note && <div className="a-note">📝 {i.note}</div>}</> },
              { title: 'SL', dataIndex: 'quantity', width: 50, align: 'center' },
              { title: 'Đơn giá', align: 'right', render: (_, i) => <>{i.listPrice > i.unitPrice && <div className="a-strike">{money(i.listPrice)}</div>}{money(i.unitPrice)}</> },
              { title: 'Thành tiền', dataIndex: 'lineTotal', render: money, align: 'right' },
            ]}
            summary={() => {
              // promotionName: đợt giảm giá theo đơn, hoặc đợt theo món đầu tiên khi đơn không có đợt theo đơn
              const row = (label: ReactNode, value: ReactNode, cls?: string) => (
                <Table.Summary.Row className={cls}>
                  <Table.Summary.Cell index={0} colSpan={4}>{label}</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{value}</Table.Summary.Cell>
                </Table.Summary.Row>
              )
              return (
                <>
                  {order.itemDiscount > 0 && row('Tiền món theo giá niêm yết', money(order.subtotal + order.itemDiscount))}
                  {order.itemDiscount > 0 && row(<>Giảm giá món{order.promotionDiscount === 0 && order.promotionName && ` (${order.promotionName})`}</>, `-${money(order.itemDiscount)}`, 'a-green')}
                  {row('Tạm tính', money(order.subtotal))}
                  {order.promotionDiscount > 0 && row(<>Đợt giảm giá{order.promotionName && ` (${order.promotionName})`}</>, `-${money(order.promotionDiscount)}`, 'a-green')}
                  {order.voucherDiscount > 0 && row(<>Voucher <Tag bordered={false}>{order.voucherCode}</Tag></>, `-${money(order.voucherDiscount)}`, 'a-green')}
                  {order.shippingFee > 0 && row('Phí giao hàng', money(order.shippingFee))}
                  {row(<b>Tổng cộng</b>, <b>{money(order.totalAmount)}</b>)}
                  {totalDiscount(order) > 0 && row(<span className="a-muted">Khách được giảm</span>, <span className="a-green">{money(totalDiscount(order))}</span>)}
                </>
              )
            }}
          />

          <div>
            <h4>Thanh toán</h4>
            {order.payments.map((p) => (
              <div key={p.id}>
              <div className="a-line">
                <span>{PAYMENT_METHOD[p.method]} · {money(p.amount)} {p.transactionCode && <Tag>{p.transactionCode}</Tag>}</span>
                <Space>
                  <StatusTag label={PAYMENT_STATUS[p.status]} />
                  {p.refundAmount > 0 && <span className="a-muted">đã hoàn {money(p.refundAmount)}</span>}
                  {p.refundRef && <Tag>Mã hoàn: {p.refundRef}</Tag>}
                  {canRefund && p.status === 'PAID' && p.refundAmount < p.amount && (
                    <Button size="small" onClick={() => { setRefund({ id: p.id, max: p.amount - p.refundAmount }); setRefundAmount(p.amount - p.refundAmount) }}>Hoàn tiền</Button>
                  )}
                </Space>
              </div>
              {p.refundNote && <div className="a-muted small" style={{ whiteSpace: 'pre-line', color: p.status === 'REFUND_PENDING' ? '#d4380d' : undefined }}>{p.refundNote}</div>}
              </div>
            ))}
          </div>

          {order.shipment && (
            <div>
              <h4>Giao hàng</h4>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Trạng thái"><StatusTag label={SHIPMENT_STATUS[order.shipment.status]} />{order.shipment.distanceKm != null && ` ${num(order.shipment.distanceKm)} km`}{order.shipment.zone && ` · ${order.shipment.zone}`}{order.shipment.shipperName && ` · giao: ${order.shipment.shipperName}`}</Descriptions.Item>
              </Descriptions>
            </div>
          )}

          <div>
            {/* ghi nhận sự cố ở mục Sự cố đơn hàng → tab Ghi nhận sự cố; ở đây chỉ xem */}
            <h4>Sự cố</h4>
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

          <div>
            <h4>Lịch sử trạng thái</h4>
            <Timeline items={history.map((h) => ({
              children: <>
                <b>{h.fromStatus ? `${ORDER_STATUS[h.fromStatus].text} → ${ORDER_STATUS[h.toStatus].text}` : 'Đặt đơn'}</b>
                <div className="a-muted small">{dateTime(h.at)} · {h.by}</div>
                {h.note && <div>{h.note}</div>}
              </>,
            }))} />
          </div>
        </Space>
      )}

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
