import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Descriptions, Divider, Drawer, Form, Input, InputNumber, Popconfirm, Rate, Select, Space, Table, Tag, Timeline } from 'antd'
import { crmApi, type Feedback, type FeedbackStatus, type FeedbackUpdatePayload } from '@/api/crm'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const STATUS: Record<FeedbackStatus, { t: string; c: string }> = {
  NEW: { t: 'Mới', c: 'red' }, IN_PROGRESS: { t: 'Đang xử lý', c: 'gold' }, ESCALATED: { t: 'Chuyển cấp', c: 'volcano' },
  RESOLVED: { t: 'Đã gửi kết quả', c: 'blue' }, CLOSED: { t: 'Đã đóng', c: 'default' },
}
const SENT = { POSITIVE: { t: 'Tích cực', c: 'green' }, NEUTRAL: { t: 'Trung lập', c: 'default' }, NEGATIVE: { t: 'Tiêu cực', c: 'red' } }
const CATEGORY = { COMPLAINT: 'Khiếu nại', SUGGESTION: 'Góp ý', PRAISE: 'Khen ngợi' }
const ISSUE = { PRODUCT: 'Sản phẩm', SERVICE: 'Phục vụ', DELIVERY: 'Giao hàng', PAYMENT: 'Thanh toán', OTHER: 'Khác' }
const APPROVAL: Record<string, { t: string; c: string }> = {
  PENDING: { t: 'Chờ quản lý duyệt', c: 'orange' }, APPROVED: { t: 'Đã duyệt chuyển cấp', c: 'green' }, REJECTED: { t: 'Từ chối chuyển cấp', c: 'red' },
}
const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }))

export function FeedbacksPage() {
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-feedbacks', customerId, page, size],
    queryFn: () => crmApi.feedbacks({ customerId: customerId ?? undefined, page, size }), retry: false,
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const open = data?.content.find((f) => f.id === openId) ?? null

  return (
    <>
      <PageHeader title="Phản hồi & khiếu nại" subtitle="Tiếp nhận, phân loại, gắn chủ đề, chuyển cấp và phản hồi khách hàng"
        extra={<InputNumber placeholder="Lọc theo ID khách" min={1} value={customerId} style={{ width: 170 }} onChange={(v) => { setCustomerId(v); setPage(0) }} />} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data?.content ?? []} onRow={(f) => ({ onClick: () => setOpenId(f.id), style: { cursor: 'pointer' } })}
          pagination={{ current: page + 1, pageSize: size, total: data?.totalElements ?? 0, onChange: (p, s) => { setPage(p - 1); setSize(s) } }}
          columns={[
            { title: 'Ngày gửi', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', render: (_, f) => <>{f.customerName ?? `Khách #${f.customerId}`}<div className="a-muted">{f.customerPhone}</div></> },
            { title: 'Chủ đề', render: (_, f) => <>{f.topic}{f.category && <div className="a-muted small">{CATEGORY[f.category]}</div>}</> },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Cảm xúc', render: (_, f) => f.sentiment && <Tag color={SENT[f.sentiment].c}>{SENT[f.sentiment].t}</Tag> },
            {
              title: 'Trạng thái', render: (_, f) => <>
                <Tag color={STATUS[f.status]?.c}>{STATUS[f.status]?.t ?? f.status}</Tag>
                {f.approvalStatus && APPROVAL[f.approvalStatus] && <Tag color={APPROVAL[f.approvalStatus].c}>{APPROVAL[f.approvalStatus].t}</Tag>}
              </>,
            },
          ]} />
      </ServiceGate>
      <FeedbackDrawer feedback={open} onClose={() => setOpenId(null)} />
    </>
  )
}

function FeedbackDrawer({ feedback: f, onClose }: { feedback: Feedback | null; onClose: () => void }) {
  const keys = [['crm-feedbacks'], ['crm-feedback-replies', f?.id]]
  const replies = useQuery({ queryKey: ['crm-feedback-replies', f?.id], queryFn: () => crmApi.feedbackReplies(f!.id), enabled: !!f, retry: false })
  const save = useAction((v: FeedbackUpdatePayload) => crmApi.updateFeedback(f!.id, v), keys)
  const reply = useAction((message: string) => crmApi.replyFeedback(f!.id, { message }), keys, 'Đã lưu nội dung phản hồi')
  const escalate = useAction(() => crmApi.escalateFeedback(f!.id), keys, 'Đã gửi yêu cầu chuyển cấp')
  const decide = useAction((v: { decision: 'APPROVE' | 'REJECT'; note?: string }) => crmApi.decideEscalation(f!.id, v), keys)
  const close = useAction((v: { resolution?: string; satisfaction?: 'SATISFIED' | 'UNSATISFIED' }) => crmApi.closeFeedback(f!.id, v), keys, 'Đã đóng phản hồi')
  const remove = useAction(() => crmApi.deleteFeedback(f!.id), [['crm-feedbacks']], 'Đã xóa')
  const [replyForm] = Form.useForm()
  const [approvalNote, setApprovalNote] = useState('')
  const closed = f?.status === 'CLOSED'

  return (
    <Drawer open={!!f} onClose={onClose} width={600} title="Xử lý phản hồi"
      extra={f && <Popconfirm title="Xóa phản hồi này?" onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}><Button danger size="small">Xóa</Button></Popconfirm>}>
      {f && (
        <>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="Khách">{f.customerName ?? `#${f.customerId}`} {f.customerPhone && `· ${f.customerPhone}`}</Descriptions.Item>
            <Descriptions.Item label="Ngày gửi">{dateTime(f.createdAt)}</Descriptions.Item>
            {f.rating != null && <Descriptions.Item label="Đánh giá"><Rate disabled value={f.rating} /></Descriptions.Item>}
            {f.closedAt && <Descriptions.Item label="Đóng lúc">{dateTime(f.closedAt)}</Descriptions.Item>}
          </Descriptions>
          <blockquote className="a-quote">{f.content}</blockquote>

          <Form key={f.id} layout="vertical" disabled={closed}
            initialValues={{ topic: f.topic, category: f.category, issueType: f.issueType, sentiment: f.sentiment, status: f.status, resolution: f.resolution }}
            onFinish={(v) => save.mutate({ ...v, status: v.status === f.status ? undefined : v.status })}>
            <div className="a-grid-2">
              <Form.Item name="topic" label="Chủ đề"><Select allowClear options={TOPICS.map((t) => ({ value: t, label: t }))} /></Form.Item>
              <Form.Item name="category" label="Phân loại"><Select allowClear options={opts(CATEGORY)} /></Form.Item>
              <Form.Item name="issueType" label="Vấn đề"><Select allowClear options={opts(ISSUE)} /></Form.Item>
              <Form.Item name="sentiment" label="Cảm xúc"><Select allowClear options={Object.entries(SENT).map(([value, v]) => ({ value, label: v.t }))} /></Form.Item>
              <Form.Item name="status" label="Trạng thái">
                <Select options={Object.entries(STATUS).filter(([k]) => k !== 'ESCALATED' || f.status === 'ESCALATED').map(([value, v]) => ({ value, label: v.t }))} />
              </Form.Item>
            </div>
            <Form.Item name="resolution" label="Phương án xử lý"><Input.TextArea rows={3} placeholder="Xin lỗi, đổi trả, tặng voucher…" /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu phân loại</Button>
          </Form>

          <Divider orientation="left">Chuyển cấp</Divider>
          {f.approvalStatus === 'PENDING' ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Tag color="orange">Chờ quản lý duyệt</Tag>
              <Input.TextArea rows={2} placeholder="Ghi chú duyệt (bắt buộc khi từ chối)" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />
              <Space>
                <Button type="primary" loading={decide.isPending} onClick={() => decide.mutate({ decision: 'APPROVE', note: approvalNote || undefined })}>Duyệt chuyển cấp</Button>
                <Button danger loading={decide.isPending} onClick={() => decide.mutate({ decision: 'REJECT', note: approvalNote || undefined })}>Từ chối</Button>
              </Space>
            </Space>
          ) : (
            <Space>
              {f.approvalStatus && APPROVAL[f.approvalStatus] && <Tag color={APPROVAL[f.approvalStatus].c}>{APPROVAL[f.approvalStatus].t}</Tag>}
              {f.approvalNote && <span className="a-muted">{f.approvalNote}</span>}
              {!closed && f.approvalStatus !== 'APPROVED' && <Button onClick={() => escalate.mutate(undefined)} loading={escalate.isPending}>Vượt thẩm quyền — chuyển Quản lý</Button>}
            </Space>
          )}

          <Divider orientation="left">Nội dung đã phản hồi khách</Divider>
          {replies.data?.length
            ? <Timeline items={replies.data.map((r) => ({ color: r.senderType === 'CUSTOMER' ? 'gray' : 'blue', children: <><b>{r.senderType === 'CUSTOMER' ? 'Khách' : 'Quán'}</b> · {dateTime(r.sentAt)}<div>{r.message}</div></> }))} />
            : <p className="a-muted">Chưa có phản hồi nào.</p>}
          {!closed && (
            <Form form={replyForm} layout="vertical" onFinish={(v) => reply.mutate(v.message, { onSuccess: () => replyForm.resetFields() })}>
              <Form.Item name="message" rules={[{ required: true, message: 'Nhập nội dung trả lời' }]}><Input.TextArea rows={3} placeholder="Nội dung trả lời khách (lưu trong CRM)" /></Form.Item>
              <Button htmlType="submit" loading={reply.isPending}>Lưu phản hồi</Button>
            </Form>
          )}

          {!closed && (
            <>
              <Divider orientation="left">Đóng phản hồi</Divider>
              <Form layout="vertical" initialValues={{ resolution: f.resolution }} onFinish={(v) => close.mutate(v)}>
                <Form.Item name="resolution" label="Kết quả xử lý"><Input.TextArea rows={2} /></Form.Item>
                <Form.Item name="satisfaction" label="Khách hài lòng?"><Select allowClear options={[{ value: 'SATISFIED', label: 'Hài lòng' }, { value: 'UNSATISFIED', label: 'Chưa hài lòng' }]} /></Form.Item>
                <Button danger htmlType="submit" loading={close.isPending}>Đóng phản hồi</Button>
              </Form>
            </>
          )}
          {closed && f.satisfaction && <p>Mức hài lòng: <Tag color={f.satisfaction === 'SATISFIED' ? 'green' : 'red'}>{f.satisfaction === 'SATISFIED' ? 'Hài lòng' : 'Chưa hài lòng'}</Tag></p>}
        </>
      )}
    </Drawer>
  )
}
