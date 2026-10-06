import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, InputNumber, Modal, Table, Tag } from 'antd'
import { coreApi } from '@/api/core'
import type { Incident } from '@/api/types'
import { INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, dateTime } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { MoneyInput } from '../components/MoneyInput'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

export function IncidentsPage() {
  const { can } = usePerm()
  const { data = [], isLoading } = useQuery({ queryKey: ['incidents'], queryFn: coreApi.incidents })
  const [resolving, setResolving] = useState<Incident | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [compensate, setCompensate] = useState(false)
  const resolve = useAction((v: { id: number } & Parameters<typeof coreApi.resolveIncident>[1]) => coreApi.resolveIncident(v.id, v), [['incidents']], 'Đã xử lý sự cố')

  return (
    <>
      <PageHeader title="Sự cố đơn hàng" subtitle="Ghi nhận ở chi tiết đơn · xử lý và đền bù voucher cần quyền Xử lý sự cố" />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, i) => <a onClick={() => setOrderId(i.orderId)}>{v}</a> },
          { title: 'Loại', render: (_, i) => INCIDENT_TYPE[i.type] },
          { title: 'Mức độ', render: (_, i) => i.severity && <StatusTag label={INCIDENT_SEVERITY[i.severity]} /> },
          { title: 'Lý do', dataIndex: 'reason', ellipsis: true },
          { title: 'Ghi nhận', render: (_, i) => <>{dateTime(i.reportedAt)}<div className="a-muted small">bởi {i.reportedBy}</div></> },
          { title: 'Xử lý', render: (_, i) => i.status === 'RESOLVED' ? <>{i.resolution}<div className="a-muted small">{i.handledByName ?? ''} · {dateTime(i.resolvedAt)}</div></> : '—' },
          { title: 'Đền bù', render: (_, i) => i.vouchers.map((v) => <Tag key={v.code}>{v.code}</Tag>) },
          { title: 'Trạng thái', render: (_, i) => <StatusTag label={INCIDENT_STATUS[i.status]} /> },
          {
            title: '', render: (_, i) => i.status !== 'RESOLVED' && can(P.INCIDENTS_RESOLVE) &&
              <Button size="small" type="primary" onClick={() => { setCompensate(false); setResolving(i) }}>Xử lý</Button>,
          },
        ]}
        expandable={{ expandedRowRender: (i) => <pre className="a-pre">{i.description || 'Không có mô tả'}</pre> }}
      />
      <Modal open={!!resolving} title={`Xử lý sự cố đơn ${resolving?.orderCode}`} footer={null} onCancel={() => setResolving(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ voucherCount: 1, voucherValidDays: 30, voucherValue: 30000, voucherMinOrderValue: 0 }}
          onFinish={(v) => resolve.mutate({
            id: resolving!.id, resolution: v.resolution,
            ...(compensate ? { voucherValue: v.voucherValue, voucherMinOrderValue: v.voucherMinOrderValue, voucherCount: v.voucherCount, voucherValidDays: v.voucherValidDays } : {}),
          }, { onSuccess: () => setResolving(null) })}>
          <Form.Item name="resolution" label="Phương án xử lý" rules={[{ required: true, message: 'Nhập phương án xử lý' }]}>
            <Input.TextArea rows={3} placeholder="Làm lại món, xin lỗi khách…" />
          </Form.Item>
          <Checkbox checked={compensate} onChange={(e) => setCompensate(e.target.checked)}>Đền bù bằng voucher</Checkbox>
          {compensate && (
            <div className="a-grid-2" style={{ marginTop: 12 }}>
              <Form.Item name="voucherValue" label="Giá trị giảm"><MoneyInput min={1000} /></Form.Item>
              <Form.Item name="voucherMinOrderValue" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
              <Form.Item name="voucherCount" label="Số voucher"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="voucherValidDays" label="Hạn (ngày)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
            </div>
          )}
          <p className="a-muted small" style={{ marginTop: 12 }}>Người xử lý được ghi nhận theo tài khoản đang đăng nhập.</p>
          <Button type="primary" htmlType="submit" block loading={resolve.isPending}>Hoàn tất xử lý</Button>
        </Form>
      </Modal>
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}
