import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Segmented, Select, Switch, Table, Tag } from 'antd'
import { crmApi, type Feedback, type FeedbackStatus } from '@/api/crm'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const STATUS: Record<FeedbackStatus, { t: string; c: string }> = {
  NEW: { t: 'Mới', c: 'red' }, IN_PROGRESS: { t: 'Đang xử lý', c: 'gold' }, ESCALATED: { t: 'Chuyển cấp', c: 'volcano' },
  RESOLVED: { t: 'Đã gửi kết quả', c: 'blue' }, CLOSED: { t: 'Đã đóng', c: 'default' },
}
const SENT = { POSITIVE: { t: 'Tích cực', c: 'green' }, NEUTRAL: { t: 'Trung lập', c: 'default' }, NEGATIVE: { t: 'Tiêu cực', c: 'red' } }
const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']

export function FeedbacksPage() {
  const [status, setStatus] = useState<FeedbackStatus | 'ALL'>('ALL')
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-feedbacks', status], queryFn: () => crmApi.feedbacks(status === 'ALL' ? undefined : status), retry: false })
  const [open, setOpen] = useState<Feedback | null>(null)
  const save = useAction((v: { id: number } & Parameters<typeof crmApi.updateFeedback>[1]) => crmApi.updateFeedback(v.id, v), [['crm-feedbacks']])

  return (
    <>
      <PageHeader title="Phản hồi & khiếu nại" subtitle="Tiếp nhận, phân loại, gắn chủ đề, chuyển cấp và phản hồi khách hàng" />
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as FeedbackStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.t }))]} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data} onRow={(f) => ({ onClick: () => setOpen(f), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Ngày gửi', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', render: (_, f) => <>{f.customerName}<div className="a-muted">{f.customerPhone}</div></> },
            { title: 'Chủ đề', dataIndex: 'topic' },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Cảm xúc', render: (_, f) => f.sentiment && <Tag color={SENT[f.sentiment].c}>{SENT[f.sentiment].t}</Tag> },
            { title: 'Trạng thái', render: (_, f) => <>{f.escalated && <Tag color="volcano">Chuyển cấp</Tag>}<Tag color={STATUS[f.status].c}>{STATUS[f.status].t}</Tag></> },
          ]} />
      </ServiceGate>
      <Drawer open={!!open} onClose={() => setOpen(null)} width={520} title="Xử lý phản hồi">
        {open && (
          <>
            <blockquote className="a-quote">{open.content}</blockquote>
            <Form layout="vertical" initialValues={open} onFinish={(v) => save.mutate({ id: open.id, ...v }, { onSuccess: () => setOpen(null) })}>
              <div className="a-grid-2">
                <Form.Item name="topic" label="Chủ đề"><Select allowClear options={TOPICS.map((t) => ({ value: t, label: t }))} /></Form.Item>
                <Form.Item name="category" label="Phân loại"><Select allowClear options={[{ value: 'COMPLAINT', label: 'Khiếu nại' }, { value: 'SUGGESTION', label: 'Góp ý' }, { value: 'PRAISE', label: 'Khen ngợi' }]} /></Form.Item>
                <Form.Item name="sentiment" label="Cảm xúc"><Select allowClear options={Object.entries(SENT).map(([value, v]) => ({ value, label: v.t }))} /></Form.Item>
                <Form.Item name="status" label="Trạng thái"><Select options={Object.entries(STATUS).map(([value, v]) => ({ value, label: v.t }))} /></Form.Item>
              </div>
              <Form.Item name="escalated" label="Vượt thẩm quyền — chuyển Quản lý" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item name="resolution" label="Phương án xử lý"><Input.TextArea rows={4} placeholder="Xin lỗi, đổi trả, tặng voucher…" /></Form.Item>
              <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
            </Form>
          </>
        )}
      </Drawer>
    </>
  )
}
