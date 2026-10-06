import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { crmApi, type Interaction, type InteractionChannel, type InteractionStatus } from '@/api/crm'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const CHANNELS: Record<InteractionChannel, string> = { CALL: 'Cuộc gọi', CHAT: 'Trò chuyện', EMAIL: 'Email', IN_STORE: 'Tại quán', NOTE: 'Ghi chú' }
const STATUS: Record<InteractionStatus, { t: string; c: string }> = { OPEN: { t: 'Đang mở', c: 'blue' }, FOLLOW_UP: { t: 'Cần chăm sóc lại', c: 'gold' }, CLOSED: { t: 'Đã kết thúc', c: 'default' } }

export function InteractionsPage() {
  const [status, setStatus] = useState<InteractionStatus | 'ALL'>('ALL')
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['crm-interactions', status], queryFn: () => crmApi.interactions(status === 'ALL' ? undefined : { status }), retry: false,
  })
  const [edit, setEdit] = useState<Partial<Interaction> | null>(null)
  const save = useAction(crmApi.saveInteraction, [['crm-interactions']])
  const close = useAction(crmApi.closeInteraction, [['crm-interactions']], 'Đã kết thúc tương tác')

  return (
    <>
      <PageHeader title="Tương tác & chăm sóc" subtitle="Ghi nhận cuộc gọi, trò chuyện, email · đặt lịch nhắc chăm sóc"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ channel: 'CALL' })}>Ghi nhận tương tác</Button>} />
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as InteractionStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.t }))]} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data}
          columns={[
            { title: 'Thời gian', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', dataIndex: 'customerName' },
            { title: 'Kênh', render: (_, i) => CHANNELS[i.channel] },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Nhắc lúc', dataIndex: 'remindAt', render: (v) => v && <Tag color={dayjs(v).isBefore(dayjs()) ? 'red' : 'blue'}>{dateTime(v)}</Tag> },
            { title: 'Trạng thái', render: (_, i) => <Tag color={STATUS[i.status].c}>{STATUS[i.status].t}</Tag> },
            { title: '', render: (_, i) => i.status !== 'CLOSED' && <Space><Button size="small" onClick={() => setEdit(i)}>Cập nhật</Button><Button size="small" onClick={() => close.mutate(i.id)}>Kết thúc</Button></Space> },
          ]} />
      </ServiceGate>
      <Modal open={!!edit} title="Tương tác khách hàng" footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ ...edit, remindAt: edit?.remindAt ? dayjs(edit.remindAt) : undefined }}
          onFinish={(v) => save.mutate({ ...edit, ...v, remindAt: v.remindAt?.format('YYYY-MM-DDTHH:mm:ss') }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="customerId" label="ID khách hàng" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="channel" label="Kênh"><Select options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="content" label="Nội dung"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="remindAt" label="Nhắc chăm sóc lúc"><DatePicker showTime style={{ width: '100%' }} format="HH:mm DD/MM/YYYY" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
