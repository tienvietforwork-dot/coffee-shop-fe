import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { promotionsApi, type VoucherStatus } from '@/api/promotions'
import { dateTime, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'
import { MoneyInput } from '../../components/MoneyInput'

const STATUS: Record<VoucherStatus, { t: string; c: string }> = {
  ISSUED: { t: 'Chưa dùng', c: 'blue' }, USED: { t: 'Đã dùng', c: 'green' }, EXPIRED: { t: 'Hết hạn', c: 'default' }, REVOKED: { t: 'Thu hồi', c: 'red' },
}

export function VouchersPage() {
  const [status, setStatus] = useState<VoucherStatus | 'ALL'>('ALL')
  const { data = [], isLoading, error } = useQuery({ queryKey: ['vouchers', status], queryFn: () => promotionsApi.vouchers(status === 'ALL' ? undefined : status), retry: false })
  const [open, setOpen] = useState(false)
  const issue = useAction(promotionsApi.issueVouchers, [['vouchers']], 'Đã phát hành voucher')
  const revoke = useAction(promotionsApi.revokeVoucher, [['vouchers']], 'Đã thu hồi')

  return (
    <>
      <PageHeader title="Voucher" subtitle="Phát hành, gán cho khách hàng và theo dõi tình trạng sử dụng"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Phát hành voucher</Button>} />
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as VoucherStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.t }))]} />
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data}
          columns={[
            { title: 'Mã', dataIndex: 'code', render: (v, x) => <><code>{v}</code>{x.incidentId && <Tag color="volcano" style={{ marginLeft: 6 }}>Đền bù</Tag>}</> },
            { title: 'Khách hàng', render: (_, v) => v.customerName || v.customerPhone || <span className="a-muted">Dùng chung</span> },
            { title: 'Giá trị', dataIndex: 'discountValue', render: money },
            { title: 'Đơn tối thiểu', dataIndex: 'minOrderValue', render: money },
            { title: 'Phát hành', dataIndex: 'issuedAt', render: dateTime },
            { title: 'Hết hạn', dataIndex: 'expiresAt', render: dateTime },
            { title: 'Đơn sử dụng', dataIndex: 'orderCode' },
            { title: 'Trạng thái', render: (_, v) => <Tag color={STATUS[v.status].c}>{STATUS[v.status].t}</Tag> },
            { title: '', render: (_, v) => v.status === 'ISSUED' && <Popconfirm title="Thu hồi voucher?" onConfirm={() => revoke.mutate(v.id)}><Button size="small" danger>Thu hồi</Button></Popconfirm> },
          ]} />
      </ServiceGate>
      <Modal open={open} title="Phát hành voucher" footer={null} onCancel={() => setOpen(false)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ quantity: 1, codePrefix: 'CH' }}
          onFinish={(v) => issue.mutate({
            discountValue: v.discountValue, minOrderValue: v.minOrderValue, quantity: v.quantity, codePrefix: v.codePrefix,
            expiresAt: v.expiresAt?.format('YYYY-MM-DDT23:59:59'),
            customerIds: v.customerIds ? String(v.customerIds).split(/[,\s]+/).filter(Boolean).map(Number) : undefined,
          }, { onSuccess: () => setOpen(false) })}>
          <div className="a-grid-2">
            <Form.Item name="discountValue" label="Giá trị giảm" rules={[{ required: true }]}><MoneyInput min={1000} /></Form.Item>
            <Form.Item name="minOrderValue" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
            <Form.Item name="expiresAt" label="Hạn dùng"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
            <Form.Item name="codePrefix" label="Tiền tố mã"><Input maxLength={6} /></Form.Item>
          </div>
          <Form.Item name="customerIds" label="Gán cho khách hàng (ID, cách nhau bởi dấu phẩy)" extra="Để trống để phát hành voucher dùng chung">
            <Input placeholder="vd: 12, 15, 40" />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng (khi dùng chung)"><InputNumber min={1} max={500} style={{ width: '100%' }} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={issue.isPending}>Phát hành</Button>
        </Form>
      </Modal>
    </>
  )
}
