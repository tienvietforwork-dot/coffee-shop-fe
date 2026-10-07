import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Input, Modal, Result, Spin, Steps } from 'antd'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { Order, OrderStatus } from '@/api/types'
import { ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, PAYMENT_STATUS, SHIPMENT_STATUS, dateTime, money } from '@/lib/format'

function steps(order: Order): { key: OrderStatus; title: string }[] {
  const s: { key: OrderStatus; title: string }[] = [
    { key: 'PENDING', title: 'Đã gửi đơn' },
    { key: 'CONFIRMED', title: 'Đã xác nhận' },
    { key: 'PREPARING', title: 'Đang pha chế' },
    { key: 'READY', title: order.orderType === 'DINE_IN' ? 'Đang mang ra bàn' : 'Sẵn sàng' },
  ]
  if (order.orderType === 'DELIVERY') s.push({ key: 'DELIVERING', title: 'Đang giao' })
  s.push({ key: 'COMPLETED', title: 'Hoàn tất' })
  return s
}

export function OrderTrackingPage() {
  const { code = '' } = useParams()
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['track', code],
    queryFn: () => publicApi.order(code),
    refetchInterval: (q) => (q.state.data && ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(q.state.data.status) ? false : 5000),
  })

  const cancel = useMutation({
    mutationFn: () => publicApi.cancelOrder(code, reason || 'Khách hủy'),
    onSuccess: (o) => {
      qc.setQueryData(['track', code], o)
      setCancelOpen(false)
      message.success('Đã hủy đơn')
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  if (isLoading) return <div className="g-container g-page g-center"><Spin size="large" /></div>
  if (isError || !order) return <Result status="404" title="Không tìm thấy đơn hàng" extra={<Link to="/" className="g-cta">Về thực đơn</Link>} />

  const closed = order.status === 'CANCELLED' || order.status === 'REJECTED'
  const st = steps(order)
  const current = Math.max(0, st.findIndex((s) => s.key === order.status))

  return (
    <div className="g-container g-page g-narrow">
      <div className="g-track-head">
        <div>
          <span className="g-eyebrow">Mã đơn</span>
          <h1>{order.orderCode}</h1>
          <span className="g-muted">{ORDER_TYPE[order.orderType]}{order.tableNo && ` · Bàn ${order.tableNo}`} · {dateTime(order.orderedAt)}</span>
        </div>
        <span className={`g-status g-status-${order.status.toLowerCase()}`}>{ORDER_STATUS[order.status].text}</span>
      </div>

      {closed ? (
        <div className="g-panel g-closed">
          <strong>{order.status === 'REJECTED' ? 'Cửa hàng không thể nhận đơn này' : 'Đơn đã được hủy'}</strong>
          {order.cancelReason && <p>Lý do: {order.cancelReason}</p>}
          {order.payments.some((p) => p.status === 'REFUNDED') && <p>Số tiền đã thanh toán sẽ được hoàn lại.</p>}
        </div>
      ) : (
        <div className="g-panel">
          <Steps labelPlacement="vertical" size="small" current={current} status={order.status === 'COMPLETED' ? 'finish' : 'process'} items={st.map((s) => ({ title: s.title }))} responsive />
        </div>
      )}

      <div className="g-panel">
        <h3>Chi tiết</h3>
        <ul className="g-sum-lines">
          {order.items.map((i) => (
            <li key={i.id}>
              <span><b>{i.quantity}×</b> {i.coffeeName}</span>
              <span>{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="g-totals">
          <div className="g-row"><span>Tạm tính</span><span>{money(order.subtotal)}</span></div>
          {order.discountAmount > 0 && <div className="g-row g-green"><span>Giảm giá</span><span>-{money(order.discountAmount)}</span></div>}
          {order.shippingFee > 0 && <div className="g-row"><span>Phí giao hàng</span><span>{money(order.shippingFee)}</span></div>}
          <div className="g-row g-total"><span>Tổng cộng</span><span>{money(order.totalAmount)}</span></div>
        </div>
        {order.payments.map((p) => (
          <div key={p.id} className="g-row g-muted">
            <span>{PAYMENT_METHOD[p.method]}</span><span>{PAYMENT_STATUS[p.status].text}</span>
          </div>
        ))}
        {order.shipment && (
          <div className="g-ship">
            <strong>Giao đến:</strong> {order.shipment.recipientName} · {order.shipment.address}
            <div className="g-muted">
              {SHIPMENT_STATUS[order.shipment.status].text}
              {order.shipment.carrier && ` · ${order.shipment.carrier}`}
              {order.shipment.trackingCode && ` · ${order.shipment.trackingCode}`}
            </div>
          </div>
        )}
      </div>

      <div className="g-actions">
        {order.status === 'PENDING' && (
          <button className="g-btn-ghost g-danger" onClick={() => setCancelOpen(true)}>Hủy đơn</button>
        )}
        {order.status === 'COMPLETED' && <Link to={`/feedback?order=${order.orderCode}`} className="g-btn-ghost">Đánh giá đơn hàng</Link>}
        <Link to="/" className="g-cta">Đặt thêm món</Link>
      </div>

      <Modal
        open={cancelOpen}
        title="Hủy đơn hàng?"
        okText="Hủy đơn"
        okButtonProps={{ danger: true, loading: cancel.isPending }}
        cancelText="Không"
        onOk={() => cancel.mutate()}
        onCancel={() => setCancelOpen(false)}
      >
        <Input.TextArea rows={3} placeholder="Lý do (không bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  )
}
