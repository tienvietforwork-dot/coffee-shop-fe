import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
<<<<<<< HEAD
import { Alert, App, Button, Card, Col, Drawer, Form, Input, Modal, Segmented, Select, Table, Tag, List, Typography, Space, Row } from 'antd'
import { crmApi, crmFeedbackLabel, type Feedback, type FeedbackStatus } from '@/api/crm'
import { coreApi } from '@/api/core'
=======
import { Button, Descriptions, Divider, Drawer, Form, Input, InputNumber, Popconfirm, Rate, Select, Space, Table, Tag, Timeline } from 'antd'
import { crmApi, type Feedback, type FeedbackStatus, type FeedbackUpdatePayload } from '@/api/crm'
>>>>>>> main
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'
import { useAuthStore } from '@/store/authStore'

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  NEW: 'red', IN_PROGRESS: 'gold', ESCALATED: 'volcano', RESOLVED: 'blue', CLOSED: 'default',
}
<<<<<<< HEAD
const SENTIMENT_COLOR = { POSITIVE: 'green', NEUTRAL: 'default', NEGATIVE: 'red' }
const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']
const SURVEY_CHOICE_LABEL: Record<string, string> = { QUALITY: 'Chất lượng đồ uống', SERVICE: 'Thái độ phục vụ', WAIT_TIME: 'Thời gian chờ', DELIVERY: 'Giao hàng', PRICE: 'Giá cả', ATMOSPHERE: 'Không gian', OTHER: 'Khác' }

export function FeedbacksPage() {
  const [status, setStatus] = useState<FeedbackStatus | 'ALL'>('ALL')
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-feedbacks', status], queryFn: () => crmApi.feedbacks(status === 'ALL' ? undefined : status), retry: false })
  const satisfaction = useQuery({ queryKey: ['crm-feedback-satisfaction'], queryFn: crmApi.feedbackSatisfactionMetrics, retry: false })
  const alerts = useQuery({ queryKey: ['crm-manager-notifications'], queryFn: () => crmApi.managerNotifications(true), retry: false })
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
  const surveyQuery = useQuery({ queryKey: ['crm-feedback-survey', open?.id], queryFn: () => crmApi.feedbackSurvey(open!.id), enabled: !!open, retry: false })
  const reply = useAction((v: { id: number; message: string }) => crmApi.replyToFeedback(v.id, v.message), [['crm-feedback-replies', open?.id]])
  const escalate = useAction((v: { id: number; staffId?: number }) => crmApi.escalateFeedback(v.id, v.staffId), [['crm-feedbacks']], 'Đã gửi yêu cầu chuyển cấp để quản lý duyệt')
  const decideApproval = useAction((v: { id: number; decision: 'APPROVE' | 'REJECT'; note?: string }) => crmApi.decideFeedbackEscalation(v.id, v.decision, v.note), [['crm-feedbacks']], 'Đã cập nhật quyết định duyệt')
  const markAlertRead = useAction(crmApi.markManagerNotificationRead, [['crm-manager-notifications']], '')

  useEffect(() => {
    if (open) {
      processForm.resetFields()
      processForm.setFieldsValue(open)
    }
  }, [open, processForm])

  return (
    <>
      <PageHeader title="Phản hồi & khiếu nại" subtitle="Tiếp nhận, phân loại, gắn chủ đề, chuyển cấp và phản hồi khách hàng" />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}><Card size="small" title="CSAT · tỷ lệ hài lòng (4–5/5)">{satisfaction.data ? `${satisfaction.data.csat_percent}% · ${satisfaction.data.csat_responses} câu trả lời` : 'Chưa có dữ liệu khảo sát'}</Card></Col>
        <Col xs={24} sm={12}><Card size="small" title="NPS · mức sẵn sàng giới thiệu (-100 đến 100)">{satisfaction.data ? `${satisfaction.data.nps} · ${satisfaction.data.nps_responses} câu trả lời` : 'Chưa có dữ liệu khảo sát'}</Card></Col>
      </Row>
      {!!alerts.data?.length && <Alert style={{ marginBottom: 16 }} type="error" showIcon message={`Có ${alerts.data.length} phản hồi tiêu cực cần theo dõi`}
        description={<List size="small" dataSource={alerts.data} renderItem={(item: any) => <List.Item style={{ cursor: 'pointer' }} onClick={() => {
          const target = data.find((feedback) => feedback.id === item.feedbackId)
          if (target) setOpen(target)
        }} actions={[<Button key="read" size="small" onClick={(event) => { event.stopPropagation(); markAlertRead.mutate(item.id) }}>Đã xem</Button>] }>
          <span><b>{item.customerName || `Khách #${item.customerId}`}</b> · {item.message} · {dateTime(item.createdAt)}<div className="a-muted">Bấm để mở phản hồi</div></span>
        </List.Item>} />} />}
      <Segmented style={{ marginBottom: 12 }} value={status} onChange={(v) => setStatus(v as FeedbackStatus | 'ALL')}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...Object.keys(STATUS_COLOR).map((value) => ({ value, label: crmFeedbackLabel('status', value) }))]} />
=======
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
>>>>>>> main
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data?.content ?? []} onRow={(f) => ({ onClick: () => setOpenId(f.id), style: { cursor: 'pointer' } })}
          pagination={{ current: page + 1, pageSize: size, total: data?.totalElements ?? 0, onChange: (p, s) => { setPage(p - 1); setSize(s) } }}
          columns={[
            { title: 'Ngày gửi', dataIndex: 'createdAt', render: dateTime },
            { title: 'Khách hàng', render: (_, f) => <>{f.customerName ?? `Khách #${f.customerId}`}<div className="a-muted">{f.customerPhone}</div></> },
            { title: 'Chủ đề', render: (_, f) => <>{f.topic}{f.category && <div className="a-muted small">{CATEGORY[f.category]}</div>}</> },
            { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
<<<<<<< HEAD
            { title: 'Cảm xúc', render: (_, f) => f.sentiment && <Tag color={SENTIMENT_COLOR[f.sentiment]}>{crmFeedbackLabel('sentiment', f.sentiment)}</Tag> },
            { title: 'Trạng thái', render: (_, f) => <Tag color={STATUS_COLOR[f.status]}>{crmFeedbackLabel('status', f.status)}</Tag> },
          ]} />
      </ServiceGate>
      <Drawer open={!!open} onClose={() => setOpen(null)} width={520} title="Xử lý phản hồi">
        {open && (
          <>
            <blockquote className="a-quote">{open.content}</blockquote>
            {surveyQuery.data && Object.keys(surveyQuery.data).length > 0 && <Card size="small" title="Khảo sát trải nghiệm" style={{ marginBottom: 16 }} loading={surveyQuery.isLoading}>
              <p>Hài lòng: {surveyQuery.data.satisfactionScore ?? '—'} / 5</p>
              <p>Sẵn sàng giới thiệu (NPS): {surveyQuery.data.recommendationScore ?? '—'} / 10</p>
              <p style={{ marginBottom: 0 }}>Lựa chọn: {(surveyQuery.data.choices ?? []).map((choice: string) => SURVEY_CHOICE_LABEL[choice] ?? choice).join(', ') || 'Không chọn'}</p>
            </Card>}
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
=======
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
>>>>>>> main
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
