import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Drawer, Form, Input, Modal, Segmented, Select, Table, Tag, List, Typography, Space } from 'antd'
import { crmApi, crmFeedbackLabel, type Feedback, type FeedbackStatus } from '@/api/crm'
import { coreApi } from '@/api/core'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'
import { useAuthStore } from '@/store/authStore'

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  NEW: 'red', IN_PROGRESS: 'gold', ESCALATED: 'volcano', RESOLVED: 'blue', CLOSED: 'default',
}
const SENTIMENT_COLOR = { POSITIVE: 'green', NEUTRAL: 'default', NEGATIVE: 'red' }
const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']

export function FeedbacksPage() {
  const [status, setStatus] = useState<FeedbackStatus | 'ALL'>('ALL')
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-feedbacks', status], queryFn: () => crmApi.feedbacks(status === 'ALL' ? undefined : status), retry: false })
  const [open, setOpen] = useState<Feedback | null>(null)
  const staff = useQuery({ queryKey: ['staff'], queryFn: coreApi.staff, enabled: !!open, refetchOnMount: 'always', refetchOnWindowFocus: true })
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const { user } = useAuthStore()
  const { message } = App.useApp()
  const isManager = user?.roles.includes('ADMIN') ?? false
  const [processForm] = Form.useForm()
  const save = useAction((v: { id: number } & Parameters<typeof crmApi.updateFeedback>[1]) => crmApi.updateFeedback(v.id, v), [['crm-feedbacks']])
  const selectedStatus = Form.useWatch('status', processForm) as FeedbackStatus | undefined
  const replyQuery = useQuery({ queryKey: ['crm-feedback-replies', open?.id], queryFn: () => crmApi.feedbackReplies(open!.id), enabled: !!open, retry: false })
  const reply = useAction((v: { id: number; message: string }) => crmApi.replyToFeedback(v.id, v.message), [['crm-feedback-replies', open?.id]])
  const escalate = useAction((v: { id: number; staffId?: number }) => crmApi.escalateFeedback(v.id, v.staffId), [['crm-feedbacks']], 'Đã gửi yêu cầu chuyển cấp để quản lý duyệt')
  const decideApproval = useAction((v: { id: number; decision: 'APPROVE' | 'REJECT'; note?: string }) => crmApi.decideFeedbackEscalation(v.id, v.decision, v.note), [['crm-feedbacks']], 'Đã cập nhật quyết định duyệt')

  useEffect(() => {
    if (open) {
      processForm.resetFields()
      processForm.setFieldsValue(open)
    }
  }, [open, processForm])

  return (
    <>
      <PageHeader title="Phản hồi & khiếu nại" subtitle="Tiếp nhận, phân loại, gắn chủ đề, chuyển cấp và phản hồi khách hàng" />
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as FeedbackStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.keys(STATUS_COLOR).map((value) => ({ value, label: crmFeedbackLabel('status', value) }))]} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data} onRow={(f) => ({ onClick: () => setOpen(f), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Ngày gửi', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', render: (_, f) => <>{f.customerName}<div className="a-muted">{f.customerPhone}</div></> },
            { title: 'Chủ đề', dataIndex: 'topic' },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
            { title: 'Cảm xúc', render: (_, f) => f.sentiment && <Tag color={SENTIMENT_COLOR[f.sentiment]}>{crmFeedbackLabel('sentiment', f.sentiment)}</Tag> },
            { title: 'Trạng thái', render: (_, f) => <Tag color={STATUS_COLOR[f.status]}>{crmFeedbackLabel('status', f.status)}</Tag> },
          ]} />
      </ServiceGate>
      <Drawer open={!!open} onClose={() => setOpen(null)} width={520} title="Xử lý phản hồi">
        {open && (
          <>
            <blockquote className="a-quote">{open.content}</blockquote>
            <Typography.Title level={5}>Câu trả lời khách có thể xem</Typography.Title>
            <List
              size="small"
              loading={replyQuery.isLoading}
              locale={{ emptyText: 'Chưa có câu trả lời nào' }}
              dataSource={replyQuery.data ?? []}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <span><b>{item.senderType === 'CUSTOMER' ? 'Khách hàng' : 'Cửa hàng'}:</b> {item.message}</span>
                    <Typography.Text type="secondary">{dateTime(item.sentAt)}{item.senderType === 'STAFF' ? ` · ${item.readAt ? `Khách đã đọc ${dateTime(item.readAt)}` : 'Khách chưa đọc'}` : ''}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
            <Form layout="vertical" onFinish={(v: { message: string }) => reply.mutate({ id: open.id, message: v.message }, { onSuccess: () => replyQuery.refetch() })}>
              <Form.Item name="message" label="Trả lời khách hàng" rules={[{ required: true, whitespace: true, message: 'Nhập nội dung trả lời' }, { max: 10000 }]}>
                <Input.TextArea rows={3} maxLength={10000} showCount placeholder="Nội dung khách có thể xem trong tài khoản" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={reply.isPending}>Gửi câu trả lời lên tài khoản khách</Button>
            </Form>
            <Typography.Title level={5} style={{ marginTop: 24 }}>Cập nhật xử lý</Typography.Title>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Chọn trạng thái, nhập kết quả nếu cần, rồi bấm Lưu xử lý một lần. Nếu chọn ‘Đã đóng’, cần chọn mức độ hài lòng." />
            <Space wrap style={{ marginBottom: 16 }}>
              {open.approvalStatus === 'PENDING'
                ? <Tag color="orange">Đang chờ quản lý duyệt chuyển cấp</Tag>
                : <Button onClick={() => escalate.mutate({ id: open.id, staffId: user?.staffId }, { onSuccess: () => setOpen({ ...open, status: 'ESCALATED', escalated: true, approvalStatus: 'PENDING' }) })} loading={escalate.isPending} disabled={open.approvalStatus === 'APPROVED'}>Yêu cầu chuyển cấp</Button>}
              {isManager && open.approvalStatus === 'PENDING' && <>
                <Button type="primary" onClick={() => decideApproval.mutate({ id: open.id, decision: 'APPROVE' }, { onSuccess: () => setOpen({ ...open, approvalStatus: 'APPROVED', approvedBy: user?.username }) })} loading={decideApproval.isPending}>Duyệt chuyển cấp</Button>
                <Button danger onClick={() => { setRejectNote(''); setRejecting(true) }}>Từ chối</Button>
              </>}
              {open.approvalStatus === 'APPROVED' && <Tag color="green">Đã được quản lý duyệt</Tag>}
              {open.approvalStatus === 'REJECTED' && <Tag color="red">Đã bị từ chối: {open.approvalNote}</Tag>}
            </Space>
            <Form form={processForm} layout="vertical" onFinish={(v) => save.mutate({ id: open.id, ...v }, { onSuccess: () => setOpen(null) })}>
              <div className="a-grid-2">
                <Form.Item name="topic" label="Chủ đề" rules={[{ max: 50, message: 'Chủ đề tối đa 50 ký tự' }]}><Select allowClear options={TOPICS.map((t) => ({ value: t, label: t }))} /></Form.Item>
                <Form.Item name="category" label="Phân loại"><Select allowClear options={[{ value: 'COMPLAINT', label: 'Khiếu nại' }, { value: 'SUGGESTION', label: 'Góp ý' }, { value: 'PRAISE', label: 'Khen ngợi' }]} /></Form.Item>
                <Form.Item name="sentiment" label="Cảm xúc"><Select allowClear options={Object.keys(SENTIMENT_COLOR).map((value) => ({ value, label: crmFeedbackLabel('sentiment', value) }))} /></Form.Item>
                <Form.Item name="status" label="Trạng thái"><Select options={Object.keys(STATUS_COLOR).filter((value) => value !== 'ESCALATED').map((value) => ({ value, label: crmFeedbackLabel('status', value) }))} /></Form.Item>
              </div>
              <Form.Item name="staffId" label="Nhân viên / quản lý phụ trách" rules={[{ required: true, message: 'Chọn nhân viên phụ trách' }]}>
                <Select
                  showSearch optionFilterProp="label" loading={staff.isFetching}
                  placeholder="Chọn nhân viên đang làm việc"
                  options={(staff.data ?? []).filter((member) => member.workStatus !== 'RESIGNED')
                    .map((member) => ({ value: member.id, label: `#${member.id} · ${member.fullName} · ${member.position ?? 'Nhân viên'}` }))}
                />
              </Form.Item>
              <Form.Item name="resolution" label="Phương án / kết quả xử lý" rules={[{ max: 10000, message: 'Phương án tối đa 10.000 ký tự' }]}><Input.TextArea rows={3} maxLength={10000} showCount placeholder="Ghi cách xử lý hoặc kết quả cuối cùng…" /></Form.Item>
              {selectedStatus === 'CLOSED' && <Form.Item name="satisfaction" label="Mức độ hài lòng" rules={[{ required: true, message: 'Chọn mức độ hài lòng trước khi đóng' }]}><Select options={[{ value: 'SATISFIED', label: 'Hài lòng' }, { value: 'UNSATISFIED', label: 'Chưa hài lòng' }]} /></Form.Item>}
              <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu xử lý</Button>
            </Form>
          </>
        )}
      </Drawer>
      <Modal open={rejecting} title="Từ chối yêu cầu chuyển cấp" okText="Xác nhận từ chối" cancelText="Hủy" onCancel={() => setRejecting(false)} confirmLoading={decideApproval.isPending}
        onOk={() => new Promise<void>((resolve, reject) => {
          if (!rejectNote.trim()) { message.warning('Nhập lý do từ chối'); reject(); return }
          if (!open) { reject(); return }
          decideApproval.mutate({ id: open.id, decision: 'REJECT', note: rejectNote.trim() }, {
            onSuccess: () => { setOpen({ ...open, approvalStatus: 'REJECTED', approvalNote: rejectNote.trim(), escalated: false, status: 'IN_PROGRESS' }); setRejecting(false); resolve() },
            onError: () => reject(),
          })
        })}>
        <Input.TextArea rows={4} maxLength={2000} showCount value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Nhập lý do để nhân viên biết hướng xử lý tiếp theo" />
      </Modal>
    </>
  )
}
