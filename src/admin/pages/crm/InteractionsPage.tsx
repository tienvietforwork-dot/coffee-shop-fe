import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { crmApi, type Interaction, type InteractionChannel, type InteractionStatus } from '@/api/crm'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const CHANNELS: Record<InteractionChannel, string> = { CALL: 'Cuộc gọi', CHAT: 'Trò chuyện', EMAIL: 'Email', IN_STORE: 'Tại quán', NOTE: 'Ghi chú' }
const STATUS: Record<InteractionStatus, { t: string; c: string }> = { OPEN: { t: 'Đang mở', c: 'blue' }, FOLLOW_UP: { t: 'Cần chăm sóc lại', c: 'gold' }, CLOSED: { t: 'Đã kết thúc', c: 'default' } }
const LDT = 'YYYY-MM-DDTHH:mm:ss'

export function InteractionsPage() {
  const [view, setView] = useState<'ALL' | 'DUE'>('ALL')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-interactions', view, customerId, page, size],
    queryFn: () => (view === 'DUE'
      ? crmApi.dueReminders({ page, size })
      : crmApi.interactions({ customerId: customerId ?? undefined, page, size })),
    retry: false,
  })
  // Interaction rows carry only customerId; resolve names from the customer list (first 100 profiles).
  const lookup = useQuery({ queryKey: ['crm-customers', 'lookup'], queryFn: () => crmApi.customers({ size: 100 }), retry: false })
  const byId = useMemo(() => new Map((lookup.data?.content ?? []).map((c) => [c.id, c])), [lookup.data])
  const [edit, setEdit] = useState<Partial<Interaction> | null>(null)
  const [closing, setClosing] = useState<Interaction | null>(null)
  const save = useAction(
    (v: Partial<Interaction> & { clearReminder?: boolean }) => {
      if (v.id) {
        return crmApi.updateInteraction(v.id, {
          channel: v.channel, content: v.content, note: v.note, status: v.status, visibleToCustomer: v.visibleToCustomer,
          remindAt: v.clearReminder ? undefined : v.remindAt, clearReminder: v.clearReminder || undefined,
        })
      }
      return crmApi.createInteraction({
        customerId: v.customerId!, channel: v.channel!, content: v.content, note: v.note, remindAt: v.remindAt, visibleToCustomer: v.visibleToCustomer,
      })
    },
    [['crm-interactions']],
  )
  const close = useAction((v: { id: number; outcome?: string }) => crmApi.closeInteraction(v.id, v.outcome), [['crm-interactions']], 'Đã kết thúc tương tác')
  const remove = useAction(crmApi.deleteInteraction, [['crm-interactions']], 'Đã xóa')

  return (
    <>
      <PageHeader title="Tương tác & chăm sóc" subtitle="Ghi nhận cuộc gọi, trò chuyện, email · đặt lịch nhắc chăm sóc"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ channel: 'CALL' })}>Ghi nhận tương tác</Button>} />
      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented value={view} onChange={(v) => { setView(v as 'ALL' | 'DUE'); setPage(0) }}
          options={[{ value: 'ALL', label: 'Tất cả' }, { value: 'DUE', label: 'Lịch nhắc đến hạn' }]} />
        {view === 'ALL' && (
          <InputNumber placeholder="Lọc theo ID khách" min={1} value={customerId} style={{ width: 170 }}
            onChange={(v) => { setCustomerId(v); setPage(0) }} />
        )}
      </Space>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data?.content ?? []}
          pagination={{ current: page + 1, pageSize: size, total: data?.totalElements ?? 0, onChange: (p, s) => { setPage(p - 1); setSize(s) } }}
          columns={[
            { title: 'Thời gian', render: (_, i) => dateTime(i.occurredAt ?? i.createdAt) },
            {
              title: 'Khách hàng', render: (_, i) => {
                const c = byId.get(i.customerId)
                return c ? <>{c.fullName || 'Chưa có tên'}<div className="a-muted">{c.phone}</div></> : <>Khách #{i.customerId}</>
              },
            },
            { title: 'Kênh', render: (_, i) => CHANNELS[i.channel] ?? i.channel },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Nhắc lúc', dataIndex: 'remindAt', render: (v) => v && <Tag color={dayjs(v).isBefore(dayjs()) ? 'red' : 'blue'}>{dateTime(v)}</Tag> },
            { title: 'Trạng thái', render: (_, i) => <><Tag color={STATUS[i.status]?.c}>{STATUS[i.status]?.t ?? i.status}</Tag>{i.outcome && <div className="a-muted small">{i.outcome}</div>}</> },
            {
              title: '', render: (_, i) => (
                <Space>
                  {i.status !== 'CLOSED' && <Button size="small" onClick={() => setEdit(i)}>Cập nhật</Button>}
                  {i.status !== 'CLOSED' && <Button size="small" onClick={() => setClosing(i)}>Kết thúc</Button>}
                  <Popconfirm title="Xóa tương tác?" onConfirm={() => remove.mutate(i.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
                </Space>
              ),
            },
          ]} />
      </ServiceGate>
      <Modal open={!!edit} title={edit?.id ? 'Cập nhật tương tác' : 'Ghi nhận tương tác'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ ...edit, remindAt: edit?.remindAt ? dayjs(edit.remindAt) : undefined }}
          onFinish={(v) => save.mutate({ ...v, id: edit?.id, remindAt: v.remindAt ? v.remindAt.format(LDT) : undefined }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="customerId" label="ID khách hàng" rules={[{ required: true }]}><InputNumber min={1} disabled={!!edit?.id} style={{ width: '100%' }} /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="channel" label="Kênh" rules={[{ required: true }]}><Select options={Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))} /></Form.Item>
            {edit?.id && <Form.Item name="status" label="Trạng thái"><Select options={Object.entries(STATUS).filter(([k]) => k !== 'CLOSED').map(([value, s]) => ({ value, label: s.t }))} /></Form.Item>}
          </div>
          <Form.Item name="content" label="Nội dung"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="note" label="Ghi chú nội bộ"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="remindAt" label="Nhắc chăm sóc lúc"><DatePicker showTime style={{ width: '100%' }} format="HH:mm DD/MM/YYYY" /></Form.Item>
          {edit?.id && edit.remindAt && <Form.Item name="clearReminder" label="Bỏ lịch nhắc" valuePropName="checked"><Switch /></Form.Item>}
          <Form.Item name="visibleToCustomer" label="Khách xem được trong tài khoản" valuePropName="checked"><Switch /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Modal open={!!closing} title="Kết thúc tương tác" footer={null} onCancel={() => setClosing(null)} destroyOnHidden>
        <Form layout="vertical" onFinish={(v) => close.mutate({ id: closing!.id, outcome: v.outcome }, { onSuccess: () => setClosing(null) })}>
          <Form.Item name="outcome" label="Kết quả chăm sóc"><Input.TextArea rows={3} placeholder="Khách hài lòng, đã tặng voucher…" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={close.isPending}>Kết thúc</Button>
        </Form>
      </Modal>
    </>
  )
}
