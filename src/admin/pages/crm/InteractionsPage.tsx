import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, DatePicker, Form, Input, Modal, Segmented, Select, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { crmApi, type Interaction, type InteractionChannel, type InteractionStatus } from '@/api/crm'
import { coreApi } from '@/api/core'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const CHANNELS: Record<InteractionChannel, string> = { CALL: 'Cuộc gọi', CHAT: 'Trò chuyện', EMAIL: 'Email', IN_STORE: 'Tại quán', NOTE: 'Ghi chú' }
const STATUS: Record<InteractionStatus, { t: string; c: string }> = { OPEN: { t: 'Đang mở', c: 'blue' }, FOLLOW_UP: { t: 'Cần chăm sóc lại', c: 'gold' }, CLOSED: { t: 'Đã kết thúc', c: 'default' } }

export function InteractionsPage() {
  const [status, setStatus] = useState<InteractionStatus | 'ALL'>('ALL')
  const [edit, setEdit] = useState<Partial<Interaction> | null>(null)
  const [closing, setClosing] = useState<Interaction | null>(null)
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['crm-interactions', status], queryFn: () => crmApi.interactions(status === 'ALL' ? undefined : { status }), retry: false,
  })
  const reminders = useQuery({ queryKey: ['crm-interaction-reminders'], queryFn: crmApi.dueReminders, retry: false })
  const reminderNotifications = useQuery({ queryKey: ['crm-interaction-reminder-notifications'], queryFn: crmApi.reminderNotifications, retry: false, refetchInterval: 60_000 })
  const [customerSearch, setCustomerSearch] = useState('')
  const customers = useQuery({
    queryKey: ['crm-customer-options', customerSearch], queryFn: () => crmApi.customers(customerSearch || undefined),
    enabled: !!edit, refetchOnMount: 'always', refetchOnWindowFocus: true,
  })
  const staff = useQuery({ queryKey: ['staff'], queryFn: coreApi.staff, enabled: !!edit, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const save = useAction(crmApi.saveInteraction, [['crm-interactions'], ['crm-interaction-reminders'], ['crm-interaction-reminder-notifications']])
  const close = useAction((v: { id: number; outcome?: string }) => crmApi.closeInteraction(v.id, v.outcome), [['crm-interactions'], ['crm-interaction-reminders'], ['crm-interaction-reminder-notifications']], 'Đã kết thúc tương tác')
  const markReminderRead = useAction(crmApi.markReminderRead, [['crm-interaction-reminder-notifications']], 'Đã ghi nhận')

  return (
    <>
      <PageHeader title="Tương tác & chăm sóc" subtitle="Ghi nhận cuộc gọi, trò chuyện, email · đặt lịch nhắc chăm sóc"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ channel: 'CALL' })}>Ghi nhận tương tác</Button>} />
      {/* <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Muốn khách xem nội dung, bật ‘Hiển thị trong tài khoản khách hàng’ khi tạo hoặc cập nhật. Đây là chia sẻ trên website sau khi lưu, không gửi SMS hay email; ghi chú nội bộ luôn riêng tư." /> */}
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as InteractionStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.t }))]} />
      <Card size="small" title={`Lịch nhắc đến hạn (${reminders.data?.length ?? 0})`} style={{ marginBottom: 16 }}>
        <Table size="small" rowKey="id" loading={reminders.isLoading} dataSource={reminders.data ?? []} pagination={{ pageSize: 5 }}
          columns={[{ title: 'Khách hàng', dataIndex: 'customerName', render: (v, i) => v || `Khách #${i.customerId}` }, { title: 'Kênh', render: (_, i) => CHANNELS[i.channel] }, { title: 'Nội dung', dataIndex: 'content', ellipsis: true }, { title: 'Nhắc lúc', dataIndex: 'remindAt', render: dateTime }, { title: '', render: (_, i) => <Button size="small" onClick={() => setEdit(i)}>Mở xử lý</Button> }]} />
      </Card>
      <Card size="small" title={`Thông báo nhắc mới (${reminderNotifications.data?.length ?? 0})`} style={{ marginBottom: 16 }}>
        <Table size="small" rowKey="id" loading={reminderNotifications.isLoading} dataSource={reminderNotifications.data ?? []} pagination={{ pageSize: 5 }}
          columns={[{ title: 'Tương tác', dataIndex: 'interactionId', render: (v) => `#${v}` }, { title: 'Nhân viên', dataIndex: 'staffId', render: (v) => v ? `#${v}` : 'Chưa phân công' }, { title: 'Đến hạn', dataIndex: 'remindAt', render: dateTime }, { title: '', render: (_, n) => <Button size="small" onClick={() => markReminderRead.mutate(n.id)}>Đã xem</Button> }]} />
      </Card>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data}
          columns={[
            { title: 'Thời gian', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', dataIndex: 'customerName' },
            { title: 'Kênh', render: (_, i) => CHANNELS[i.channel] },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Khách được xem', dataIndex: 'visibleToCustomer', render: (v) => v ? <Tag color="green">Đang hiển thị</Tag> : <Tag>Riêng tư</Tag> },
            { title: 'Khách đã đọc', dataIndex: 'customerReadAt', render: (v) => v ? <Tag color="green">{dateTime(v)}</Tag> : <Tag>Chưa đọc</Tag> },
            { title: 'Nhắc lúc', dataIndex: 'remindAt', render: (v) => v && <Tag color={dayjs(v).isBefore(dayjs()) ? 'red' : 'blue'}>{dateTime(v)}</Tag> },
            { title: 'Trạng thái', render: (_, i) => <Tag color={STATUS[i.status].c}>{STATUS[i.status].t}</Tag> },
            { title: '', render: (_, i) => i.status !== 'CLOSED' && <Space><Button size="small" onClick={() => setEdit(i)}>Cập nhật</Button><Button size="small" onClick={() => setClosing(i)}>Kết thúc</Button></Space> },
          ]} />
      </ServiceGate>
      <Modal open={!!edit} title="Tương tác khách hàng" footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ ...edit, remindAt: edit?.remindAt ? dayjs(edit.remindAt) : undefined }}
          onFinish={(v) => save.mutate({ ...edit, ...v, remindAt: v.remindAt?.format('YYYY-MM-DDTHH:mm:ss') }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="customerId" label="Khách hàng (ID · tên · số điện thoại)" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch filterOption={false} onSearch={setCustomerSearch} loading={customers.isFetching}
              placeholder="Tìm theo tên hoặc số điện thoại" disabled={!!edit?.id}
              options={(customers.data ?? []).map((customer) => ({ value: customer.id, label: `#${customer.id} · ${customer.fullName || 'Chưa có tên'} · ${customer.phone}` }))}
            />
          </Form.Item>
          <Form.Item name="staffId" label="Nhân viên / quản lý phụ trách" rules={[{ required: true, message: 'Chọn nhân viên phụ trách' }]}>
            <Select
              showSearch optionFilterProp="label" loading={staff.isFetching}
              placeholder="Chọn nhân viên đang làm việc"
              options={(staff.data ?? []).filter((member) => member.workStatus !== 'RESIGNED')
                .map((member) => ({ value: member.id, label: `#${member.id} · ${member.fullName} · ${member.position ?? 'Nhân viên'}` }))}
            />
          </Form.Item>
          <Form.Item name="channel" label="Kênh" rules={[{ required: true, message: 'Chọn kênh tương tác' }]}><Select options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="content" label="Nội dung trao đổi" rules={[{ max: 10000, message: 'Nội dung tối đa 10.000 ký tự' }]} extra="Tóm tắt cuộc gọi, tin nhắn hoặc trao đổi với khách hàng."><Input.TextArea rows={3} maxLength={10000} showCount /></Form.Item>
          <Form.Item name="note" label="Ghi chú nội bộ" rules={[{ max: 10000, message: 'Ghi chú tối đa 10.000 ký tự' }]} extra="Thông tin dành cho nhân viên; khách hàng không nhìn thấy trường này."><Input.TextArea rows={2} maxLength={10000} showCount /></Form.Item>
          <Form.Item name="visibleToCustomer" label="Hiển thị trong tài khoản khách hàng" valuePropName="checked" extra="Khách cần đăng nhập bằng tài khoản đã liên kết với hồ sơ này. Chỉ nội dung trao đổi và kết quả chăm sóc được chia sẻ; ghi chú nội bộ không hiển thị."><Switch /></Form.Item>
          <Form.Item name="remindAt" label="Nhắc chăm sóc lúc"><DatePicker showTime style={{ width: '100%' }} format="HH:mm DD/MM/YYYY" /></Form.Item>
          {edit?.id && <Form.Item name="status" label="Trạng thái"><Select options={Object.entries(STATUS).map(([value, v]) => ({ value, label: v.t }))} /></Form.Item>}
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Modal open={!!closing} title="Kết thúc tương tác" footer={null} onCancel={() => setClosing(null)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { outcome?: string }) => close.mutate({ id: closing!.id, outcome: v.outcome }, { onSuccess: () => setClosing(null) })}>
          <Form.Item name="outcome" label="Kết quả chăm sóc" rules={[{ required: true, whitespace: true, message: 'Ghi lại kết quả trước khi kết thúc' }, { max: 10000 }]}><Input.TextArea rows={4} maxLength={10000} showCount /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={close.isPending}>Lưu kết quả và kết thúc</Button>
        </Form>
      </Modal>
    </>
  )
}
