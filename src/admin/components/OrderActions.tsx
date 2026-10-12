import { useState } from 'react'
import { App, Button, Input, Modal, Select, Space } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { Order } from '@/api/types'
import { P, usePerm } from '@/lib/perm'
import { CARRIERS } from '@/lib/format'

/**
 * Next-step buttons for an order (BPMN-02). There is no assignment: whoever presses a button
 * is recorded as the employee handling the order.
 */
export function OrderActions({ order, onDone, compact }: { order: Order; onDone: (o?: Order) => void; compact?: boolean }) {
  const { message } = App.useApp()
  const { can, canAny } = usePerm()
  const [reasonFor, setReasonFor] = useState<'reject' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')

  const run = useMutation({
    mutationFn: (fn: () => Promise<Order>) => fn(),
    onSuccess: (o) => onDone(o),
    onError: (e) => message.error(errorMessage(e)),
  })
  // delivery order ready but no ride yet: book it here instead of on the Giao hàng screen
  const [booking, setBooking] = useState(false)
  const [carrier, setCarrier] = useState<string>()
  const [trackingCode, setTrackingCode] = useState('')
  const book = useMutation({
    mutationFn: () => coreApi.updateShipment(order.shipment!.id, { status: 'BOOKED', carrier, trackingCode: trackingCode.trim() || undefined }),
    onSuccess: () => { setBooking(false); message.success('Đã đặt xe'); onDone() },
    onError: (e) => message.error(errorMessage(e)),
  })
  const needsRide = order.orderType === 'DELIVERY' && order.shipment?.status === 'PENDING'
  const size = compact ? 'small' : 'middle'
  const go = (fn: () => Promise<Order>) => run.mutate(fn)
  const s = order.status
  const loading = run.isPending
  const ops = can(P.ORDERS)
  const delivery = canAny(P.ORDERS, P.SHIPMENTS)

  return (
    <Space wrap size={6} onClick={(e) => e.stopPropagation()}>
      {ops && s === 'PENDING' && <>
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.confirm(order.id))}>Xác nhận & pha chế</Button>
        <Button size={size} danger onClick={() => setReasonFor('reject')}>Từ chối</Button>
      </>}
      {ops && s === 'CONFIRMED' && <>
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.prepare(order.id))}>Bắt đầu pha</Button>
        {!compact && <Button size={size} danger onClick={() => setReasonFor('cancel')}>Hủy</Button>}
      </>}
      {ops && s === 'PREPARING' && <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.ready(order.id))}>Pha xong</Button>}
      {delivery && s === 'READY' && order.orderType !== 'DELIVERY' && (
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.complete(order.id))}>
          {order.orderType === 'DINE_IN' ? 'Đã phục vụ' : 'Đã bàn giao'}{!order.paid && ' & thu tiền'}
        </Button>
      )}
      {delivery && s === 'READY' && needsRide && (
        <Button size={size} type="primary" onClick={() => setBooking(true)}>Đặt xe</Button>
      )}
      {delivery && s === 'READY' && order.orderType === 'DELIVERY' && !needsRide && (
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.dispatch(order.id))}>Giao cho tài xế</Button>
      )}
      {delivery && s === 'DELIVERING' && <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.complete(order.id))}>Đã giao xong</Button>}
      {!compact && canAny(P.ORDERS, P.POS) && !order.paid && ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING'].includes(s) && (
        <Button size={size} loading={loading} onClick={() => go(() => coreApi.collectPayment(order.id))}>Thu tiền</Button>
      )}

      <Modal
        open={!!reasonFor}
        title={reasonFor === 'reject' ? 'Từ chối đơn' : 'Hủy đơn'}
        okText="Xác nhận"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading }}
        onOk={() => run.mutate(() => (reasonFor === 'reject' ? coreApi.reject(order.id, reason) : coreApi.cancel(order.id, reason)),
          { onSuccess: () => setReasonFor(null) })}
        afterClose={() => setReason('')}
        onCancel={() => setReasonFor(null)}
      >
        <p>Khoản đã thanh toán sẽ được hoàn tiền tự động.</p>
        <Input.TextArea rows={3} placeholder="Lý do (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal open={booking} title={`Đặt xe · đơn ${order.orderCode}`} okText="Đặt xe" onCancel={() => setBooking(false)}
        okButtonProps={{ disabled: !carrier, loading: book.isPending }} onOk={() => book.mutate()}
        afterClose={() => { setCarrier(undefined); setTrackingCode('') }}>
        {order.shipment && <p className="a-muted">{order.shipment.recipientName} · {order.shipment.recipientPhone}<br />{order.shipment.address}</p>}
        <div style={{ marginBottom: 6 }}>Đơn vị vận chuyển</div>
        <Select value={carrier} onChange={setCarrier} options={CARRIERS.map((x) => ({ value: x, label: x }))} style={{ width: '100%' }} autoFocus />
        <div style={{ margin: '12px 0 6px' }}>Mã vận đơn (nếu có)</div>
        <Input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} />
      </Modal>
    </Space>
  )
}
