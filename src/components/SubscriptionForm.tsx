import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select, Space, TimePicker } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { Subscription, SubscriptionFrequency, SubscriptionPayload } from '@/api/types'
import { VnAddressInput } from '@/components/VnAddressInput'
import { vnAddressRule } from '@/lib/vnAddress'
import { useDeliveryArea } from '@/lib/useDeliveryArea'

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: d === 7 ? 'CN' : `T${d + 1}` }))

type Values = {
  customerName?: string; customerPhone?: string; recipientName: string; recipientPhone: string; address: string
  items: { coffeeId: number; quantity: number; note?: string }[]
  frequency: SubscriptionFrequency; days?: number[]; deliveryTime: Dayjs; range: [Dayjs, Dayjs | null]; note?: string
}

/**
 * Form đăng ký / sửa gói giao định kỳ: món, địa chỉ giao, lịch (mỗi ngày / các thứ trong tuần), giờ giao cố định,
 * ngày bắt đầu – kết thúc. {@code withCustomer}: nhân viên nhập SĐT / tên khách (khách tự đăng ký thì không cần).
 */
export function SubscriptionForm({ initial, coffees, withCustomer, saving, onSubmit, prefill }: {
  initial?: Subscription | null
  coffees: { id: number; name: string; price: number }[]
  withCustomer?: boolean
  saving?: boolean
  prefill?: { recipientName?: string; recipientPhone?: string }
  onSubmit: (p: SubscriptionPayload) => void
}) {
  const [form] = Form.useForm<Values>()
  const address = Form.useWatch('address', form)
  const area = useDeliveryArea(address)
  const frequency = Form.useWatch('frequency', form)
  const init: Partial<Values> = initial ? {
    customerName: initial.customerName, customerPhone: initial.customerPhone,
    recipientName: initial.recipientName, recipientPhone: initial.recipientPhone, address: initial.address,
    items: initial.items.map((i) => ({ coffeeId: i.coffeeId, quantity: i.quantity, note: i.note })),
    frequency: initial.frequency, days: initial.days, deliveryTime: dayjs(initial.deliveryTime.slice(0, 5), 'HH:mm'),
    range: [dayjs(initial.startDate), initial.endDate ? dayjs(initial.endDate) : null], note: initial.note,
  } : {
    recipientName: prefill?.recipientName, recipientPhone: prefill?.recipientPhone,
    items: [{ coffeeId: undefined as unknown as number, quantity: 1 }], frequency: 'DAILY', days: [1, 2, 3, 4, 5],
    deliveryTime: dayjs('08:00', 'HH:mm'), range: [dayjs().add(1, 'day'), null],
  }
  return (
    <Form<Values> form={form} layout="vertical" initialValues={init}
      onFinish={(v) => onSubmit({
        customerName: v.customerName, customerPhone: v.customerPhone,
        delivery: { recipientName: v.recipientName, recipientPhone: v.recipientPhone, address: v.address },
        items: v.items, frequency: v.frequency, days: v.frequency === 'WEEKLY' ? v.days : undefined,
        deliveryTime: v.deliveryTime.format('HH:mm'), startDate: v.range[0].format('YYYY-MM-DD'),
        endDate: v.range[1]?.format('YYYY-MM-DD'), note: v.note,
      })}>
      {withCustomer && (
        <div className="a-grid-2">
          <Form.Item name="customerPhone" label="SĐT khách" rules={[{ required: true, pattern: /^0\d{9,10}$/, message: 'SĐT không hợp lệ' }]}>
            <Input disabled={!!initial} />
          </Form.Item>
          <Form.Item name="customerName" label="Tên khách"><Input disabled={!!initial} /></Form.Item>
        </div>
      )}
      <div className="a-grid-2">
        <Form.Item name="recipientName" label="Người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="recipientPhone" label="SĐT người nhận" rules={[{ required: true, pattern: /^0\d{9,10}$/, message: 'SĐT không hợp lệ' }]}><Input /></Form.Item>
      </div>
      <Form.Item name="address" label="Địa chỉ giao" rules={[vnAddressRule('nơi nhận')]}
        extra={area?.outside ? <span style={{ color: '#cf1322' }}>{area.message ?? 'Ngoài khu vực giao hàng'}</span> : undefined}>
        <VnAddressInput />
      </Form.Item>

      <div style={{ marginBottom: 8, fontWeight: 600 }}>Món mỗi lần giao</div>
      <Form.List name="items">
        {(fields, { add, remove }) => <>
          {fields.map((f) => (
            <Space key={f.key} align="baseline" style={{ display: 'flex' }} wrap>
              <Form.Item name={[f.name, 'coffeeId']} rules={[{ required: true, message: 'Chọn món' }]} style={{ width: 240, marginBottom: 8 }}>
                <Select showSearch optionFilterProp="label" placeholder="Chọn món"
                  options={coffees.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
              <Form.Item name={[f.name, 'quantity']} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <InputNumber min={1} max={99} addonAfter="ly" style={{ width: 110 }} />
              </Form.Item>
              <Form.Item name={[f.name, 'note']} style={{ width: 180, marginBottom: 8 }}><Input placeholder="Ghi chú (ít đá…)" maxLength={255} /></Form.Item>
              {fields.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(f.name)} />}
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })} style={{ marginBottom: 16 }}>Thêm món</Button>
        </>}
      </Form.List>

      <div className="a-grid-2">
        <Form.Item name="frequency" label="Lịch giao">
          <Radio.Group optionType="button" buttonStyle="solid"
            options={[{ value: 'DAILY', label: 'Mỗi ngày' }, { value: 'WEEKLY', label: 'Theo thứ trong tuần' }]} />
        </Form.Item>
        <Form.Item name="deliveryTime" label="Giờ giao cố định" rules={[{ required: true, message: 'Chọn giờ giao' }]}>
          <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} />
        </Form.Item>
      </div>
      {frequency === 'WEEKLY' && (
        <Form.Item name="days" label="Giao vào các thứ" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất 1 ngày' }]}>
          <Checkbox.Group options={WEEK_DAYS} />
        </Form.Item>
      )}
      <Form.Item name="range" label="Từ ngày – đến ngày (để trống ngày kết thúc = không hạn)" rules={[{ required: true }]}>
        <DatePicker.RangePicker allowEmpty={[false, true]} format="DD/MM/YYYY" style={{ width: '100%' }}
          disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
      </Form.Item>
      <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} maxLength={500} /></Form.Item>
      <p className="a-muted small" style={{ marginTop: -8 }}>
        Quán tự tạo đơn trước giờ giao khoảng 1 tiếng, thanh toán khi nhận hàng. Giá theo thực đơn tại thời điểm giao.
      </p>
      <Button type="primary" htmlType="submit" block loading={saving} disabled={!!area?.outside}>Lưu gói</Button>
    </Form>
  )
}
