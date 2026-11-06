import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Checkbox, Form, InputNumber, Space, Switch, Tag, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { DeliveryWeather, WeatherHour } from '@/api/types'
import { money } from '@/lib/format'
import { MoneyInput } from './MoneyInput'
import { useAction } from './useCrud'

/** mã thời tiết WMO → biểu tượng */
const icon = (code: number) =>
  code === 0 ? '☀️' : code <= 2 ? '🌤️' : code === 3 ? '☁️' : code <= 48 ? '🌫️' : code <= 57 ? '🌦️' : code <= 67 || (code >= 80 && code <= 82) ? '🌧️' : code >= 95 ? '⛈️' : '🌡️'
const vn = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

function Status({ h, enabled }: { h: WeatherHour; enabled: boolean }) {
  if (!enabled) return <Tag>Phụ phí tắt</Tag>
  if (h.stopped) return <Tag color="red">Ngưng giao</Tag>
  if (h.surcharge > 0) return <Tag color="orange">+{money(h.surcharge)}</Tag>
  return <Tag color="green">Bình thường</Tag>
}

/** Thời tiết tại quán (bây giờ + 6 giờ tới) và phụ phí / ngưng giao khi thời tiết xấu. */
export function DeliveryWeatherCard() {
  const { data } = useQuery({ queryKey: ['delivery-weather'], queryFn: coreApi.deliveryWeather, refetchInterval: 10 * 60_000 })
  const [form] = Form.useForm<DeliveryWeather>()
  const save = useAction(coreApi.saveDeliveryWeather, [['delivery-weather']], 'Đã lưu')
  useEffect(() => { if (data) form.setFieldsValue(data) }, [data, form])
  if (!data) return <Card loading style={{ marginBottom: 16 }} />
  const [now, ...next] = data.outlook ?? []

  return (
    <Card title="Thời tiết" size="small" style={{ marginBottom: 16 }}>
      {now ? (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
            <span style={{ fontSize: 48, lineHeight: 1 }}>{icon(now.code)}</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{vn(now.temperature)}°C</div>
              <div>{now.description}</div>
              <div className="a-muted small">Mưa {vn(now.rainMm)} mm/h · Gió {vn(now.windKmh)} km/h</div>
              <div style={{ marginTop: 4 }}><Status h={now} enabled={data.enabled} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {next.map((h) => (
              <Tooltip key={h.time} title={`${h.description} · gió ${vn(h.windKmh)} km/h`}>
                <div style={{
                  width: 76, textAlign: 'center', padding: '6px 4px', borderRadius: 8,
                  border: `1px solid ${data.enabled && h.stopped ? '#ff4d4f' : data.enabled && h.surcharge > 0 ? '#fa8c16' : '#f0f0f0'}`,
                }}>
                  <div className="a-muted small">{h.time.slice(11, 13)}h</div>
                  <div style={{ fontSize: 22 }}>{icon(h.code)}</div>
                  <div>{Math.round(h.temperature)}°</div>
                  <div className="a-muted small">{vn(h.rainMm)} mm</div>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      ) : <div className="a-muted" style={{ marginBottom: 16 }}>Không lấy được thời tiết</div>}

      <Form form={form} layout="vertical" initialValues={data}
        onFinish={(v) => save.mutate({ enabled: v.enabled, rainTiers: v.rainTiers ?? [], stormSurcharge: v.stormSurcharge, stopRainMm: v.stopRainMm, stopStorm: !!v.stopStorm })}>
        <Form.Item name="enabled" label="Phụ phí thời tiết xấu" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item label="Phụ phí theo lượng mưa">
          <Form.List name="rainTiers">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f, i) => (
                  <Space key={f.key} align="baseline" wrap style={{ display: 'flex' }}>
                    <Form.Item name={[f.name, 'minRainMm']} rules={[{ required: true, message: 'Nhập' }]}>
                      <InputNumber min={0.1} step={0.5} addonBefore="Mưa từ" addonAfter="mm/h" style={{ width: 210 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'surcharge']} rules={[{ required: true, message: 'Nhập' }]}>
                      <MoneyInput addonBefore="+" style={{ width: 180 }} />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(i)} />
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ minRainMm: 2.5, surcharge: 5000 })}>Thêm mức mưa</Button>
              </>
            )}
          </Form.List>
        </Form.Item>
        <div className="a-grid-3">
          <Form.Item name="stormSurcharge" label="Phụ phí khi giông"><MoneyInput /></Form.Item>
          <Form.Item name="stopRainMm" label="Ngưng giao khi mưa từ"><InputNumber min={0.1} step={1} addonAfter="mm/h" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="stopStorm" label=" " valuePropName="checked"><Checkbox>Ngưng giao khi có giông</Checkbox></Form.Item>
        </div>
        <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
      </Form>
    </Card>
  )
}
