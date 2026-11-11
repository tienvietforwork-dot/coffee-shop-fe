import { useState } from 'react'
import { Alert, App, Button, Input, Modal, Space } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { PrinterOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { Order } from '@/api/types'
import { P, usePerm } from '@/lib/perm'
import { printCupLabels } from '@/lib/print'
import { money } from '@/lib/format'

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
      {ops && s === 'PREPARING' && <>
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.ready(order.id))}>Pha xong</Button>
        <Button size={size} icon={<PrinterOutlined />} onClick={() => printCupLabels(order)}>
          In tem ({order.items.reduce((n, i) => n + i.quantity, 0)})
        </Button>
      </>}
      {delivery && s === 'READY' && order.orderType !== 'DELIVERY' && (
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.complete(order.id))}>
          {order.orderType === 'DINE_IN' ? 'Đã phục vụ' : 'Đã bàn giao'}{!order.paid && ' & thu tiền'}
        </Button>
      )}
      {delivery && s === 'READY' && order.orderType === 'DELIVERY' && (
        <Button size={size} type="primary" loading={loading} onClick={() => go(() => coreApi.dispatch(order.id))}>Mang đi giao</Button>
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
        <RefundNotice order={order} />
        <Input.TextArea rows={3} placeholder="Lý do (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Space>
  )
}

/**
 * Trước khi từ chối / hủy: khách đã trả bao nhiêu và tiền sẽ về thế nào — trả online thì hoàn qua VNPAY (vài ngày làm
 * việc tùy ngân hàng); VNPAY không hoàn được thì khoản chuyển "Chờ hoàn tiền" để chuyển khoản tay.
 */
function RefundNotice({ order }: { order: Order }) {
  const paid = order.payments.filter((p) => p.status === 'PAID')
  const amount = paid.reduce((n, p) => n + p.amount - p.refundAmount, 0)
  if (!paid.length) return <p className="a-muted">Khách chưa thanh toán — không phát sinh hoàn tiền.</p>
  const online = paid.some((p) => p.method !== 'CASH' && order.channel !== 'COUNTER')
  return (
    <Alert type="warning" showIcon style={{ marginBottom: 12 }}
      message={`Khách đã thanh toán ${money(amount)}${online ? ' (online)' : ''}`}
      description={online
        ? 'Hệ thống hoàn tiền tự động qua VNPAY về tài khoản / thẻ khách đã dùng. Nếu VNPAY không hoàn được, khoản sẽ chuyển sang "Chờ hoàn tiền" (Đối soát thanh toán) để chuyển khoản trả khách và ghi mã giao dịch.'
        : 'Hoàn trả tiền mặt cho khách tại quầy — ghi vào ca thu ngân.'} />
  )
}
