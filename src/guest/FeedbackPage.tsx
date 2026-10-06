import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Form, Input, Result, Select } from 'antd'
import { crmApi } from '@/api/crm'
import { errorMessage, isServiceUnavailable } from '@/api/client'
import { useGuestStore } from '@/store/guestStore'

const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']

export function FeedbackPage() {
  const [params] = useSearchParams()
  const { name, phone } = useGuestStore()
  const send = useMutation({ mutationFn: crmApi.submitFeedback })

  if (send.isSuccess) {
    return (
      <Result
        status="success"
        title="Cảm ơn bạn đã góp ý!"
        subTitle="Coffeeholic sẽ phản hồi qua số điện thoại bạn để lại trong thời gian sớm nhất."
      />
    )
  }

  return (
    <div className="g-container g-page g-narrow">
      <h1 className="g-page-title">Góp ý & khiếu nại</h1>
      <p className="g-muted">Mọi ý kiến đều giúp chúng mình pha ly cà phê tiếp theo ngon hơn.</p>
      <Form
        layout="vertical"
        className="g-panel"
        requiredMark={false}
        initialValues={{ fullName: name, phone, orderCode: params.get('order') ?? undefined }}
        onFinish={(v) => send.mutate(v)}
      >
        <div className="g-form-row">
          <Form.Item name="fullName" label="Họ tên"><Input maxLength={100} /></Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Cần số điện thoại để phản hồi bạn' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}
          >
            <Input inputMode="tel" />
          </Form.Item>
        </div>
        <div className="g-form-row">
          <Form.Item name="orderCode" label="Mã đơn (nếu có)"><Input /></Form.Item>
          <Form.Item name="topic" label="Chủ đề">
            <Select allowClear options={TOPICS.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
        </div>
        <Form.Item name="content" label="Nội dung" rules={[{ required: true, message: 'Bạn muốn chia sẻ điều gì?' }]}>
          <Input.TextArea rows={5} maxLength={2000} showCount />
        </Form.Item>
        {send.isError && (
          <p className="g-error">
            {isServiceUnavailable(send.error)
              ? 'Hệ thống tiếp nhận góp ý đang bảo trì, bạn vui lòng thử lại sau hoặc báo trực tiếp với nhân viên.'
              : errorMessage(send.error)}
          </p>
        )}
        <button className="g-cta" type="submit" disabled={send.isPending}>Gửi góp ý</button>
      </Form>
    </div>
  )
}
