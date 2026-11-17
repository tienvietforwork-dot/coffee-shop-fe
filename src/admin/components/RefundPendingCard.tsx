import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Space, Table } from 'antd'
import { PhoneOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Payment } from '@/api/types'
import { PAYMENT_METHOD, dateTime, money } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { useAction } from './useCrud'

/**
 * Khách đã chuyển khoản / trả online nhưng đơn bị từ chối / hủy và VNPAY không hoàn được: liên hệ khách lấy số tài
 * khoản, chuyển khoản trả rồi ghi mã giao dịch ("Đã hoàn tay"); hoặc thử hoàn lại qua VNPAY.
 */
export function RefundPendingCard() {
  const canRefund = usePerm().can(P.ORDERS_REFUND)
  const { data = [] } = useQuery({ queryKey: ['refund-pending'], queryFn: coreApi.refundPending, enabled: canRefund, refetchInterval: 60000 })
  const keys = [['refund-pending'], ['payment-transactions'], ['orders']]
  const retry = useAction(coreApi.retryRefund, keys, 'Đã gửi yêu cầu hoàn lại')
  const done = useAction((v: { id: number; reference: string; note?: string }) => coreApi.manualRefund(v.id, v), keys, 'Đã ghi nhận hoàn tiền')
  const [marking, setMarking] = useState<Payment | null>(null)
  if (!canRefund || !data.length) return null
  return (
    <Card size="small" style={{ marginBottom: 16, borderColor: '#ffbb96' }}
      title={<span style={{ color: '#d4380d' }}>Chờ hoàn tiền thủ công ({data.length})</span>}>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }}
        message="Đơn đã bị từ chối / hủy sau khi khách thanh toán, VNPAY không hoàn được"
        description="Gọi khách xin số tài khoản, chuyển khoản trả đủ số tiền rồi bấm “Đã hoàn tay” và nhập mã giao dịch ngân hàng." />
      <Table<Payment> rowKey="id" size="small" pagination={false} dataSource={data}
        columns={[
          { title: 'Đơn', render: (_, p) => <><b>{p.orderCode}</b><div className="a-muted small">{p.cancelReason}</div></> },
          { title: 'Khách', render: (_, p) => <>{p.customerName ?? '—'}{p.customerPhone && <div><a href={`tel:${p.customerPhone}`}><PhoneOutlined /> {p.customerPhone}</a></div>}</> },
          { title: 'Đã trả', render: (_, p) => <>{money(p.amount - p.refundAmount)}<div className="a-muted small">{PAYMENT_METHOD[p.method]} · {p.paidAt ? dateTime(p.paidAt) : ''}</div></> },
          { title: 'Lý do chờ', dataIndex: 'refundNote', render: (v?: string) => <span className="small">{v}</span> },
          {
            title: '', width: 210, render: (_, p) => <Space>
              <Button size="small" loading={retry.isPending} onClick={() => retry.mutate(p.id)}>Thử lại VNPAY</Button>
              <Button size="small" type="primary" onClick={() => setMarking(p)}>Đã hoàn tay</Button>
            </Space>,
          },
        ]} />
      <Modal open={!!marking} title={`Đã chuyển khoản trả khách · ${marking?.orderCode}`} footer={null} onCancel={() => setMarking(null)} destroyOnHidden>
        <p>Số tiền: <b>{marking && money(marking.amount - marking.refundAmount)}</b></p>
        <Form layout="vertical" onFinish={(v: { reference: string; note?: string }) => done.mutate({ id: marking!.id, ...v }, { onSuccess: () => setMarking(null) })}>
          <Form.Item name="reference" label="Mã giao dịch chuyển khoản" rules={[{ required: true, message: 'Nhập mã giao dịch' }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} placeholder="Ngân hàng / số tài khoản khách…" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={done.isPending}>Xác nhận đã hoàn</Button>
        </Form>
      </Modal>
    </Card>
  )
}
