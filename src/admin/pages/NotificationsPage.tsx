import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Form, Input, Modal, Segmented, Select, Space, Switch, Table, Tag } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { NotificationMessage, NotificationTemplate } from '@/api/types'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

const STATUS: Record<NotificationMessage['status'], { text: string; color: string }> = {
  PENDING: { text: 'Chờ gửi', color: 'gold' }, SENT: { text: 'Đã gửi', color: 'blue' }, DELIVERED: { text: 'Đã nhận', color: 'green' }, FAILED: { text: 'Lỗi', color: 'red' },
}
const PLACEHOLDERS = '{customer_name} {order_code} {amount} {status} {driver} {reason} {link}'

/**
 * Tin nhắn chăm sóc khách hàng theo đơn (QR / online): Zalo ZNS theo mẫu đã được Zalo duyệt, lỗi thì SMS brandname.
 * Chỉ tin giao dịch (không quảng cáo). Bật / tắt từng mẫu, sửa nội dung SMS, xem nhật ký gửi và gửi lại tin lỗi.
 */
export function NotificationsPage() {
  const [tab, setTab] = useState<'log' | 'templates'>('log')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(3, 'day'), dayjs()])
  const [status, setStatus] = useState<NotificationMessage['status']>()
  const [phone, setPhone] = useState('')
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), status, phone: phone || undefined }
  const { data: messages = [], isLoading } = useQuery({ queryKey: ['notification-messages', params], enabled: tab === 'log', queryFn: () => coreApi.notificationMessages(params) })
  const { data: templates = [] } = useQuery({ queryKey: ['notification-templates'], queryFn: coreApi.notificationTemplates })
  const resend = useAction(coreApi.resendNotification, [['notification-messages']], 'Đã đưa lại vào hàng đợi')
  const update = useAction((v: { code: string } & Partial<NotificationTemplate>) => coreApi.updateNotificationTemplate(v.code, v), [['notification-templates']], 'Đã lưu mẫu tin')
  const [edit, setEdit] = useState<NotificationTemplate | null>(null)
  const [form] = Form.useForm()
  const name = (code: string) => templates.find((t) => t.code === code)?.name ?? code

  return (
    <>
      <PageHeader title="Tin nhắn khách hàng" subtitle="Zalo ZNS / SMS theo đơn: xác nhận, sẵn sàng, đang giao, hoàn tất, hủy" />
      <Segmented value={tab} onChange={(v) => setTab(v as typeof tab)} style={{ marginBottom: 12 }}
        options={[{ value: 'log', label: 'Nhật ký gửi' }, { value: 'templates', label: 'Mẫu tin' }]} />
      {tab === 'log' && <>
        <Space wrap style={{ marginBottom: 12 }}>
          <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
          <Select allowClear placeholder="Trạng thái" style={{ width: 150 }} value={status} onChange={setStatus}
            options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.text }))} />
          <Input allowClear placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: 160 }} />
        </Space>
        <Table<NotificationMessage> rowKey="id" size="small" loading={isLoading} dataSource={messages} scroll={{ x: 1000 }}
          columns={[
            { title: 'Lúc', dataIndex: 'createdAt', render: dateTime, width: 140 },
            { title: 'Đơn', dataIndex: 'orderCode' },
            { title: 'Mẫu', dataIndex: 'templateCode', render: name },
            { title: 'SĐT', dataIndex: 'phone' },
            { title: 'Kênh', dataIndex: 'channel', render: (v) => (v ? <Tag color={v === 'ZNS' ? 'blue' : 'purple'}>{v}</Tag> : '—') },
            { title: 'Nội dung SMS', dataIndex: 'content', ellipsis: true },
            { title: 'Trạng thái', render: (_, m) => <><Tag color={STATUS[m.status].color}>{STATUS[m.status].text}</Tag>{m.error && <div className="small a-limit">{m.error}</div>}</> },
            { title: '', render: (_, m) => m.status === 'FAILED' && <Button size="small" onClick={() => resend.mutate(m.id)}>Gửi lại</Button> },
          ]} />
      </>}
      {tab === 'templates' && <>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Mẫu ZNS phải được Zalo duyệt trước khi gửi (nhập ID mẫu đã duyệt). SMS brandname gửi không dấu, tối đa 320 ký tự; chỉ dùng cho tin chăm sóc khách hàng." />
        <Table<NotificationTemplate> rowKey="code" size="small" pagination={false} dataSource={templates}
          columns={[
            { title: 'Mẫu', dataIndex: 'name', render: (v, t) => <><b>{v}</b><div className="a-muted small">{t.code}</div></> },
            { title: 'Bật', dataIndex: 'enabled', render: (v, t) => <Switch checked={v} onChange={(enabled) => update.mutate({ code: t.code, enabled })} /> },
            { title: 'ID mẫu ZNS', dataIndex: 'znsTemplateId', render: (v) => v ?? <span className="a-muted">chỉ SMS</span> },
            { title: 'Nội dung SMS', dataIndex: 'smsContent' },
            { title: 'SMS dự phòng', dataIndex: 'smsFallback', render: (v) => (v ? 'Có' : 'Không') },
            { title: '', render: (_, t) => <Button size="small" onClick={() => { setEdit(t); form.setFieldsValue(t) }}>Sửa</Button> },
          ]} />
      </>}
      <Modal open={!!edit} title={edit && `Mẫu tin · ${edit.name}`} onCancel={() => setEdit(null)} destroyOnHidden
        footer={<Button type="primary" loading={update.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => update.mutate({ code: edit!.code, ...v }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="znsTemplateId" label="ID mẫu ZNS (đã duyệt)"><Input placeholder="Để trống: chỉ gửi SMS" /></Form.Item>
          <Form.Item name="smsContent" label="Nội dung SMS" rules={[{ required: true }, { max: 320 }]} extra={`Biến: ${PLACEHOLDERS}`}>
            <Input.TextArea rows={3} showCount maxLength={320} />
          </Form.Item>
          <Form.Item name="smsFallback" label="Gửi SMS khi ZNS lỗi" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
