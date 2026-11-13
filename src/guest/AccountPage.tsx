import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Alert, Button, Checkbox, Collapse, Empty, Form, Input, List, Rate, Spin, Tabs, Tag, Typography } from 'antd'
import { accountApi } from '@/api/auth'
import { crmApi, type CustomerPortalFeedback, type CustomerPortalInteraction, type FeedbackReply } from '@/api/crm'
import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePerm, P } from '@/lib/perm'
import { ORDER_STATUS, date, dateTime, money } from '@/lib/format'
import { ChangePasswordModal } from '@/admin/components/ChangePasswordModal'

const VOUCHER: Record<string, { t: string; c: string }> = {
  ISSUED: { t: 'Có thể dùng', c: 'green' }, USED: { t: 'Đã dùng', c: 'default' }, EXPIRED: { t: 'Hết hạn', c: 'default' }, REVOKED: { t: 'Đã thu hồi', c: 'red' },
}
const INTERACTION_CHANNEL: Record<string, string> = { CALL: 'Cuộc gọi', CHAT: 'Trò chuyện', EMAIL: 'Email', IN_STORE: 'Tại quán', NOTE: 'Ghi chú' }
const SURVEY_OPTIONS = [
  { value: 'QUALITY', label: 'Chất lượng đồ uống' }, { value: 'SERVICE', label: 'Thái độ phục vụ' },
  { value: 'WAIT_TIME', label: 'Thời gian chờ' }, { value: 'DELIVERY', label: 'Giao hàng' },
  { value: 'PRICE', label: 'Giá cả' }, { value: 'ATMOSPHERE', label: 'Không gian' }, { value: 'OTHER', label: 'Khác' },
]

/** "Tài khoản của tôi" – khách hàng đã đăng nhập. */
export function AccountPage() {
  const { isAuthenticated, logout } = useAuthStore()
  const { can, hasAdminAccess } = usePerm()
  const qc = useQueryClient()
  const { message } = App.useApp()
  const [pwd, setPwd] = useState(false)
  const [surveyForm] = Form.useForm()
  const surveyChoices = Form.useWatch('surveyChoices', surveyForm) as string[] | undefined
  const npsScore = Form.useWatch('recommendationScore', surveyForm) as number | undefined
  const enabled = isAuthenticated && can(P.ACCOUNT)
  const profile = useQuery({ queryKey: ['account'], queryFn: accountApi.profile, enabled })
  const orders = useQuery({ queryKey: ['account-orders'], queryFn: accountApi.orders, enabled })
  const vouchers = useQuery({ queryKey: ['account-vouchers'], queryFn: accountApi.vouchers, enabled })
  const points = useQuery({ queryKey: ['account-points'], queryFn: accountApi.points, enabled })
  const portalFeedbacks = useQuery({ queryKey: ['customer-portal-feedbacks'], queryFn: crmApi.customerPortalFeedbacks, enabled, retry: false })
  const portalInteractions = useQuery({ queryKey: ['customer-portal-interactions'], queryFn: crmApi.customerPortalInteractions, enabled, retry: false })
  const sendSurvey = useMutation({
    mutationFn: (values: any) => crmApi.submitFeedbackSurvey({
      ...values,
      content: [values.content?.trim(), values.otherDetails?.trim() ? `Nội dung khác: ${values.otherDetails.trim()}` : ''].filter(Boolean).join('\n') || `Khảo sát trải nghiệm: hài lòng ${values.satisfactionScore}/5, điểm giới thiệu ${values.recommendationScore}/10.`,
      topic: 'Khảo sát trải nghiệm',
      fullName: profile.data?.fullName,
      phone: profile.data!.phone,
    }),
    onSuccess: () => { surveyForm.resetFields(); message.success('Đã gửi khảo sát; cửa hàng đã ghi nhận ý kiến của bạn'); qc.invalidateQueries({ queryKey: ['customer-portal-feedbacks'] }) },
    onError: (e) => message.error(errorMessage(e)),
  })
  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (p) => { qc.setQueryData(['account'], p); message.success('Đã lưu') },
    onError: (e) => message.error(errorMessage(e)),
  })

  if (!isAuthenticated) return <Navigate to="/" replace />
  if (!can(P.ACCOUNT)) {
    return (
      <div className="g-container g-page g-center">
        <h2>Đây là trang dành cho khách hàng</h2>
        {hasAdminAccess && <Link to="/admin" className="g-cta">Vào hệ thống quản trị</Link>}
      </div>
    )
  }
  const p = profile.data
  const usable = (vouchers.data ?? []).filter((v) => v.status === 'ISSUED')
  const unreadReplies = (portalFeedbacks.data ?? []).reduce((total, feedback) => total + feedback.replies.filter((reply) => reply.senderType === 'STAFF' && !reply.readAt).length, 0)

  return (
    <div className="g-container g-page g-narrow">
      <h1 className="g-page-title">Xin chào{p?.fullName ? `, ${p.fullName}` : ''}</h1>
      <div className="g-stats">
        <div className="g-stat"><span>Điểm tích lũy</span><b>{p?.loyaltyPoints ?? '—'}</b></div>
        <div className="g-stat"><span>Đơn đã đặt</span><b>{p?.orderCount ?? '—'}</b></div>
        <div className="g-stat"><span>Voucher có thể dùng</span><b>{usable.length}</b></div>
      </div>
      <div className="g-panel">
        <Tabs items={[
          {
            key: 'orders', label: 'Đơn hàng', children: orders.data?.length ? (
              <ul className="g-order-list">
                {orders.data.map((o) => (
                  <li key={o.id}>
                    <Link to={`/order/${o.orderCode}`} className="g-order-item g-order-row">
                      <div>
                        <strong>{o.orderCode}</strong>
                        <span className="g-muted">{dateTime(o.orderedAt)} · {o.items.map((x) => `${x.quantity}× ${x.coffeeName}`).join(', ')}</span>
                      </div>
                      <div className="g-order-right">
                        <span className={`g-status g-status-${o.status.toLowerCase()}`}>{ORDER_STATUS[o.status].text}</span>
                        <strong>{money(o.totalAmount)}</strong>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty description="Bạn chưa có đơn nào" />,
          },
          {
            key: 'vouchers', label: `Voucher (${usable.length})`, children: vouchers.data?.length ? (
              <div className="g-vouchers">
                {vouchers.data.map((v) => (
                  <div key={v.id} className={`g-voucher-card ${v.status !== 'ISSUED' ? 'is-off' : ''}`}>
                    <div className="g-voucher-value">-{money(v.discountValue)}</div>
                    <div>
                      <code>{v.code}</code> <Tag color={VOUCHER[v.status].c}>{VOUCHER[v.status].t}</Tag>
                      <div className="g-muted small">
                        {v.minOrderValue > 0 ? `Đơn từ ${money(v.minOrderValue)}` : 'Không yêu cầu đơn tối thiểu'}
                        {v.expiresAt && ` · HSD ${date(v.expiresAt)}`}{v.orderCode && ` · dùng cho ${v.orderCode}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty description="Chưa có voucher" />,
          },
          {
            key: 'points', label: 'Điểm tích lũy', children: points.data?.length ? (
              <ul className="g-sum-lines">
                {points.data.map((h) => (
                  <li key={h.id}><span>{h.reason}<small>{dateTime(h.createdAt)}</small></span><b className={h.pointsChange > 0 ? 'g-green' : ''}>{h.pointsChange > 0 ? '+' : ''}{h.pointsChange}</b></li>
                ))}
              </ul>
            ) : <Empty description="Hoàn tất đơn đầu tiên để nhận điểm (1 điểm / 10.000đ)" />,
          },
          {
            key: 'crm-feedbacks', label: <>Phản hồi & trả lời{unreadReplies > 0 && <Tag color="red" style={{ marginInlineStart: 6 }}>{unreadReplies} chưa đọc</Tag>}</>, children: (
              <>
              <div style={{marginTop:20}} />
              {portalFeedbacks.isLoading ? <div className="g-center"><Spin /></div>
                : portalFeedbacks.isError ? <Alert type="error" showIcon message="Chưa tải được phản hồi" description={errorMessage(portalFeedbacks.error)} />
                  : (portalFeedbacks.data?.length ?? 0) === 0 ? <Empty description="Bạn chưa có phản hồi nào" />
                    : <Collapse items={(portalFeedbacks.data ?? []).map((feedback) => ({
                      key: feedback.id,
                      label: <span><b>{feedback.topic || 'Phản hồi của bạn'}</b><span className="g-muted"> · {dateTime(feedback.createdAt)}</span>{feedback.replies.some((r) => r.senderType === 'STAFF' && !r.readAt) && <Tag color="red" style={{ marginInlineStart: 8 }}>Có trả lời mới</Tag>}</span>,
                      children: <CustomerFeedbackThread feedback={feedback} onRead={() => qc.invalidateQueries({ queryKey: ['customer-portal-feedbacks'] })} />,
                    }))} />}
              </>
            ),
          },
          {
            key: 'survey', label: 'Khảo sát trải nghiệm', children: <Form form={surveyForm} className="g-survey" layout="vertical" disabled={sendSurvey.isPending} onFinish={(values) => sendSurvey.mutate(values)}>
              <Alert type="info" showIcon className="g-survey-guide" message="Chia sẻ trải nghiệm của bạn" description="Chấm mức độ hài lòng, chọn điểm giới thiệu quán và những điều bạn muốn góp ý. Các câu hỏi có dấu * là bắt buộc." />
              <Form.Item name="satisfactionScore" label="Bạn hài lòng ở mức nào? (1–5 sao)" rules={[{ required: true, message: 'Vui lòng chọn số sao' }]}>
                <Rate className="g-survey-stars" tooltips={['Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng']} />
              </Form.Item>
              <Form.Item name="recommendationScore" label="Bạn có giới thiệu quán cho bạn bè không?" rules={[{ required: true, message: 'Vui lòng chọn một điểm' }]}>
                <div className="g-survey-nps" role="group" aria-label="Điểm giới thiệu từ 0 đến 10">
                  {Array.from({ length: 11 }, (_, score) => <Button key={score} htmlType="button" aria-pressed={npsScore === score} className={npsScore === score ? 'is-selected' : ''} onClick={() => surveyForm.setFieldValue('recommendationScore', score)}>{score}</Button>)}
                </div>
                <div className="g-survey-nps-hints"><span>0 · Hoàn toàn không giới thiệu</span><span>10 · Chắc chắn giới thiệu</span></div>
              </Form.Item>
              <Form.Item name="surveyChoices" label="Bạn muốn góp ý về điều gì? (có thể chọn nhiều)">
                <Checkbox.Group className="g-survey-checks" options={SURVEY_OPTIONS} />
              </Form.Item>
              {surveyChoices?.includes('OTHER') && <Form.Item name="otherDetails" label="Mô tả nội dung khác" rules={[{ max: 500, message: 'Tối đa 500 ký tự' }]}><Input maxLength={500} placeholder="Bạn muốn góp ý thêm điều gì?" /></Form.Item>}
              <Form.Item name="content" label="Ý kiến bổ sung (không bắt buộc)" rules={[{ max: 2000, message: 'Tối đa 2.000 ký tự' }]}><Input.TextArea rows={4} maxLength={2000} showCount placeholder="Bạn có góp ý gì để quán phục vụ tốt hơn không?" /></Form.Item>
              <Button type="primary" htmlType="submit" className="g-survey-submit" loading={sendSurvey.isPending} disabled={!profile.data?.phone}>Gửi khảo sát</Button>
            </Form>,
          },
          {
            key: 'crm-interactions', label: 'Chăm sóc khách hàng', children: (
              portalInteractions.isLoading ? <div className="g-center"><Spin /></div>
                : portalInteractions.isError ? <Alert type="error" showIcon message="Chưa tải được lịch sử chăm sóc" description={errorMessage(portalInteractions.error)} />
                  : (portalInteractions.data?.length ?? 0) === 0 ? <Empty description="Chưa có nội dung chăm sóc được chia sẻ với bạn" />
                    : <List
                      itemLayout="vertical"
                      dataSource={portalInteractions.data ?? []}
                      renderItem={(item) => <CustomerPortalInteractionItem item={item} onRead={() => qc.invalidateQueries({ queryKey: ['customer-portal-interactions'] })} />}
                    />
            ),
          },
          {
            key: 'profile', label: 'Thông tin', children: p && (
              <Form layout="vertical" initialValues={p} onFinish={(v) => save.mutate(v)}>
                <Form.Item label="Số điện thoại"><Input value={p.phone} disabled /></Form.Item>
                <Form.Item name="fullName" label="Họ tên"><Input maxLength={100} /></Form.Item>
                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
                <div className="g-actions" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <button type="button" className="g-btn-ghost" onClick={() => setPwd(true)}>Đổi mật khẩu</button>{' '}
                    <button type="button" className="g-btn-ghost g-danger" onClick={() => { logout(); qc.clear() }}>Đăng xuất</button>
                  </span>
                  <button className="g-cta" type="submit" disabled={save.isPending}>Lưu</button>
                </div>
              </Form>
            ),
          },
        ]} />
      </div>
      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  )
}

function CustomerPortalInteractionItem({ item, onRead }: { item: CustomerPortalInteraction; onRead: () => void }) {
  const { message } = App.useApp()
  const [readAt, setReadAt] = useState(item.customerReadAt)
  const markRead = useMutation({
    mutationFn: () => crmApi.markInteractionRead(item.id),
    onSuccess: (receipt) => { setReadAt(receipt.readAt); onRead() },
    onError: (error) => message.error(errorMessage(error)),
  })
  return <List.Item actions={!readAt ? [<Button key="read" type="link" size="small" loading={markRead.isPending} onClick={() => markRead.mutate()}>Đánh dấu đã đọc</Button>] : []}
    extra={readAt ? <Tag color="green">Đã đọc</Tag> : <Tag color="blue">Chưa đọc</Tag>}>
    <List.Item.Meta title={<>{INTERACTION_CHANNEL[item.channel] ?? item.channel} · {dateTime(item.occurredAt)}</>} description={item.content || 'Nhân viên đã ghi nhận một lần chăm sóc bạn.'} />
    {item.outcome && <Typography.Paragraph>{item.outcome}</Typography.Paragraph>}
  </List.Item>
}

function CustomerFeedbackThread({ feedback, onRead }: { feedback: CustomerPortalFeedback; onRead: () => void }) {
  const [form] = Form.useForm<{ message: string }>()
  const { message } = App.useApp()
  const sendReply = useMutation({
    mutationFn: (values: { message: string }) => crmApi.customerRespondToFeedback(feedback.id, values.message),
    onSuccess: () => {
      form.resetFields()
      message.success('Đã gửi trả lời cho cửa hàng')
      onRead()
    },
    onError: (error) => message.error(errorMessage(error)),
  })

  return (
    <div>
      <Typography.Paragraph>{feedback.content}</Typography.Paragraph>
      {feedback.replies.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có trao đổi. Bạn có thể gửi tin nhắn cho cửa hàng bên dưới." /> : (
        <List
          header="Trao đổi với cửa hàng"
          dataSource={feedback.replies}
          renderItem={(reply) => reply.senderType === 'CUSTOMER'
            ? <List.Item><List.Item.Meta title={`Bạn · ${dateTime(reply.sentAt)}`} description={reply.message} /></List.Item>
            : <CustomerReply feedbackId={feedback.id} reply={reply} onRead={onRead} />}
        />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={(values) => sendReply.mutate(values)}>
        <Form.Item name="message" label="Trả lời cửa hàng" rules={[{ required: true, whitespace: true, message: 'Nhập nội dung bạn muốn gửi' }, { max: 10000, message: 'Tối đa 10.000 ký tự' }]}>
          <Input.TextArea rows={3} maxLength={10000} showCount placeholder="Nhập nội dung trao đổi về khiếu nại hoặc góp ý này…" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={sendReply.isPending}>Gửi trả lời</Button>
      </Form>
    </div>
  )
}

function CustomerReply({ feedbackId, reply, onRead }: { feedbackId: number; reply: FeedbackReply; onRead: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [readAt, setReadAt] = useState(reply.readAt)
  const markRead = useMutation({
    mutationFn: () => crmApi.markFeedbackReplyRead(feedbackId, reply.id),
    onSuccess: (receipt) => { setReadAt(receipt.readAt); onRead() },
  })

  const openReply = () => {
    setExpanded((value) => !value)
    if (!expanded && !readAt && !markRead.isPending) markRead.mutate()
  }

  return (
    <List.Item actions={[<Button key="read" type="link" size="small" onClick={openReply}>{expanded ? 'Thu gọn' : 'Mở câu trả lời'}</Button>]}
      extra={readAt ? <Tag color="green">Đã đọc</Tag> : <Tag color="blue">Chưa đọc</Tag>}>
      <List.Item.Meta title={`Cửa hàng · ${dateTime(reply.sentAt)}`} description={expanded ? reply.message : 'Mở để xem nội dung trả lời'} />
      {markRead.isError && <Typography.Text type="danger">Không cập nhật được trạng thái đã đọc. Thử mở lại câu trả lời.</Typography.Text>}
    </List.Item>
  )
}
