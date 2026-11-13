import { useMutation } from '@tanstack/react-query'
import { Checkbox, Form, Input, Rate, Result, Select } from 'antd'
import { crmApi } from '@/api/crm'
import { errorMessage, isServiceUnavailable } from '@/api/client'
import { useGuestStore } from '@/store/guestStore'

const TOPICS = ['Chất lượng đồ uống', 'Thái độ phục vụ', 'Thời gian chờ', 'Giao hàng', 'Giá cả', 'Không gian', 'Khác']
const SURVEY_CHOICES = [
  { value: 'QUALITY', label: 'Chất lượng đồ uống' }, { value: 'SERVICE', label: 'Thái độ phục vụ' },
  { value: 'WAIT_TIME', label: 'Thời gian chờ' }, { value: 'DELIVERY', label: 'Giao hàng' },
  { value: 'PRICE', label: 'Giá cả' }, { value: 'ATMOSPHERE', label: 'Không gian' }, { value: 'OTHER', label: 'Khác' },
]

export function FeedbackPage() {
  const { name, phone } = useGuestStore()
  const send = useMutation({ mutationFn: crmApi.submitFeedbackSurvey })

  if (send.isSuccess) {
    return (
      <Result
        status="success"
        title="Cảm ơn bạn đã góp ý!"
        subTitle="Ý kiến và câu trả lời khảo sát của bạn đã được ghi nhận."
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
        initialValues={{ fullName: name, phone }}
        onFinish={(v) => send.mutate(v)}
      >
        <div className="g-form-row">
          <Form.Item name="fullName" label="Họ tên" rules={[{ max: 100, message: 'Họ tên tối đa 100 ký tự' }]}><Input maxLength={100} /></Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, whitespace: true, message: 'Cần số điện thoại để phản hồi bạn' }, { max: 15, message: 'Số điện thoại tối đa 15 ký tự' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại phải gồm 10 hoặc 11 chữ số và bắt đầu bằng 0' }]}
          >
            <Input inputMode="tel" />
          </Form.Item>
        </div>
        <Form.Item name="topic" label="Chủ đề" rules={[{ max: 50, message: 'Chủ đề tối đa 50 ký tự' }]}>
          <Select allowClear options={TOPICS.map((t) => ({ value: t, label: t }))} />
        </Form.Item>
        <Form.Item name="content" label="Nội dung" rules={[{ required: true, whitespace: true, message: 'Bạn muốn chia sẻ điều gì?' }, { max: 2000, message: 'Nội dung tối đa 2.000 ký tự' }]}>
          <Input.TextArea rows={5} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item name="satisfactionScore" label="Bạn hài lòng với trải nghiệm ở mức nào?" rules={[{ required: true, message: 'Vui lòng chọn mức độ hài lòng' }]}>
          <Rate />
        </Form.Item>
        <Form.Item name="recommendationScore" label="Bạn có sẵn sàng giới thiệu Coffeeholic? (0–10)" rules={[{ required: true, message: 'Vui lòng chọn điểm giới thiệu' }]}>
          <Select placeholder="Chọn điểm từ 0 đến 10" options={Array.from({ length: 11 }, (_, score) => ({ value: score, label: String(score) }))} />
        </Form.Item>
        <Form.Item name="surveyChoices" label="Bạn muốn chúng mình cải thiện hoặc ghi nhận điều gì? (có thể chọn nhiều)">
          <Checkbox.Group options={SURVEY_CHOICES} />
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
