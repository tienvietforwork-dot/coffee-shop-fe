import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, TimePicker, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { DeliveryFeePlan, DeliveryFeeTier, DeliveryTimeSlot } from '@/api/types'
import { money } from '@/lib/format'
import { VnAddressInput } from '@/components/VnAddressInput'
import { vnAddressRule } from '@/lib/vnAddress'
import { MoneyInput } from './MoneyInput'
import { DeliveryWeatherCard } from './DeliveryWeatherCard'
import { useAction } from './useCrud'

const DAYS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: d === 7 ? 'CN' : `T${d + 1}` }))
const COLORS = ['#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#2f54eb', '#a0d911']
const DEFAULT_COLOR = '#95de64'
const t = (s?: string) => (s ? dayjs(s.slice(0, 5), 'HH:mm') : undefined)
const hhmm = (s?: string) => s?.slice(0, 5) ?? ''
const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
const dayText = (d: number[]) => (!d.length ? 'Mọi ngày' : d.map((x) => DAYS[x - 1].label).join(', '))
const km = (v: number) => `${Number(v)}`

/** does [start, end) (may cross midnight) cover minute m of the day */
const covers = (start: string, end: string, m: number) => {
  const a = mins(start), b = mins(end)
  return a < b ? m >= a && m < b : m >= a || m < b
}

/** Phí giao hàng: cửa hàng (địa chỉ, giờ mở cửa), option giá theo km, khung giờ dùng option. */
export function DeliveryFeeSettings() {
  const { data: plans = [] } = useQuery({ queryKey: ['delivery-fee-plans'], queryFn: coreApi.deliveryFeePlans })
  const { data: slots = [] } = useQuery({ queryKey: ['delivery-time-slots'], queryFn: coreApi.deliveryTimeSlots })
  const colorOf = (planId?: number) => {
    const others = plans.filter((p) => !p.isDefault)
    const i = others.findIndex((p) => p.id === planId)
    return i < 0 ? DEFAULT_COLOR : COLORS[i % COLORS.length]
  }
  return (
    <div>
      <ShopCard />
      <DeliveryWeatherCard />
      <PlansCard plans={plans} slots={slots} colorOf={colorOf} />
      <SlotsCard plans={plans} slots={slots} colorOf={colorOf} />
    </div>
  )
}

// ---- cửa hàng ------------------------------------------------------------------

function ShopCard() {
  const { data, isLoading } = useQuery({ queryKey: ['delivery-settings'], queryFn: coreApi.deliverySettings })
  const [form] = Form.useForm()
  const save = useAction(coreApi.saveDeliverySettings, [['delivery-settings'], ['delivery-settings-public']], 'Đã lưu')
  if (isLoading || !data) return <Card loading style={{ marginBottom: 16 }} />
  return (
    <Card title="Cửa hàng" size="small" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical"
        initialValues={{ ...data, hours: data.openTime && data.closeTime ? [t(data.openTime), t(data.closeTime)] : undefined }}
        onFinish={(v: { shopAddress: string; hours?: [Dayjs, Dayjs]; freeShipThreshold?: number; minOrderAmount?: number; minutesPerKm?: number }) => save.mutate({
          shopAddress: v.shopAddress, freeShipThreshold: v.freeShipThreshold, minOrderAmount: v.minOrderAmount, minutesPerKm: v.minutesPerKm,
          openTime: v.hours?.[0]?.format('HH:mm'), closeTime: v.hours?.[1]?.format('HH:mm'),
        })}>
        <Form.Item name="shopAddress" label="Địa chỉ quán" rules={[vnAddressRule('quán')]}><VnAddressInput /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 12px' }}>
          <Form.Item name="hours" label="Giờ mở cửa"><TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="freeShipThreshold" label="Miễn phí ship từ"><MoneyInput /></Form.Item>
          <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
          <Form.Item name="minutesPerKm" label="Thời gian di chuyển"><InputNumber min={0.5} max={30} step={0.5} addonAfter="phút/km" style={{ width: '100%' }} /></Form.Item>
        </div>
        <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
      </Form>
    </Card>
  )
}

// ---- option giá ----------------------------------------------------------------

type Props = { plans: DeliveryFeePlan[]; slots: DeliveryTimeSlot[]; colorOf: (planId?: number) => string }

function PlansCard({ plans, slots, colorOf }: Props) {
  const [edit, setEdit] = useState<Partial<DeliveryFeePlan> | null>(null)
  const [view, setView] = useState<DeliveryFeePlan | null>(null)
  const [form] = Form.useForm<{ name: string; isDefault: boolean; note?: string; tiers: DeliveryFeeTier[]; maxKm?: number }>()
  const keys = [['delivery-fee-plans'], ['delivery-time-slots']]
  const save = useAction(coreApi.saveDeliveryFeePlan, keys, 'Đã lưu option')
  const remove = useAction(coreApi.deleteDeliveryFeePlan, keys, 'Đã xóa option')
  const open = (p: Partial<DeliveryFeePlan>) => {
    setEdit(p)
    form.resetFields()
    form.setFieldsValue({
      name: p.name ?? '', note: p.note, isDefault: p.isDefault ?? !plans.length, maxKm: p.maxKm ?? 10,
      tiers: p.tiers?.length ? p.tiers.map((x) => ({ fromKm: x.fromKm, fee: x.fee }) as DeliveryFeeTier) : [{ fromKm: 0, fee: 15000 } as DeliveryFeeTier],
    })
  }
  const usedIn = (id: number) => slots.filter((s) => s.planId === id)

  return (
    <Card title="Option giá" size="small" style={{ marginBottom: 16 }}
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => open({})}>Thêm option</Button>}>
      <Table<DeliveryFeePlan> rowKey="id" size="small" pagination={false} dataSource={plans}
        columns={[
          {
            title: 'Tên', render: (_, p) => <Space>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorOf(p.isDefault ? undefined : p.id) }} />
              <b>{p.name}</b>
            </Space>,
          },
          {
            title: 'Mức km', render: (_, p) => <>
              {p.tiers.map((x) => <Tag key={x.fromKm}>Từ {km(x.fromKm)} km: {money(x.fee)}</Tag>)}
              {p.maxKm != null && <span className="a-muted small">Không giao quá {km(p.maxKm)} km</span>}
            </>,
          },
          { title: 'Mặc định', width: 110, align: 'center', render: (_, p) => (p.isDefault ? <Tag color="green">Có</Tag> : <span className="a-muted">Không</span>) },
          {
            title: '', width: 170, render: (_, p) => <Space size={4}>
              <Button size="small" type="link" onClick={() => setView(p)}>Xem</Button>
              <Button size="small" onClick={() => open(p)}>Sửa</Button>
              {p.isDefault ? (
                <Tooltip title="Không xóa được option mặc định"><Button size="small" danger icon={<DeleteOutlined />} disabled /></Tooltip>
              ) : (
                <Popconfirm title="Xóa option này?" onConfirm={() => remove.mutate(p.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>,
          },
        ]} />

      <Modal open={!!edit} title={edit?.id ? 'Sửa option' : 'Thêm option'} onCancel={() => setEdit(null)} destroyOnHidden width={620}
        footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <div className="a-grid-2">
            <Form.Item name="name" label="Tên option" rules={[{ required: true, message: 'Nhập tên' }]}><Input placeholder="Cao điểm" maxLength={60} /></Form.Item>
            <Form.Item name="isDefault" label="Mặc định" valuePropName="checked">
              <Switch disabled={!!edit?.isDefault} />
            </Form.Item>
          </div>
          <Form.Item noStyle shouldUpdate={(a, b) => a.isDefault !== b.isDefault}>
            {({ getFieldValue }) => !getFieldValue('isDefault') && (
              <Form.Item name="note" label="Ghi chú cho khách">
                <Input maxLength={255} placeholder={`Phí giao hàng khung giờ ${getFieldValue('name') || '…'}`} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.List name="tiers">
            {(fields, { add, remove: drop }) => (
              <>
                {fields.map((f, i) => (
                  <Space key={f.key} align="baseline" wrap style={{ display: 'flex' }}>
                    <Form.Item name={[f.name, 'fromKm']} rules={[{ required: true, message: 'Nhập' }]}>
                      <InputNumber min={0} step={0.5} addonBefore="Từ" addonAfter="km" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'fee']} rules={[{ required: true, message: 'Nhập phí' }]}><MoneyInput style={{ width: 180 }} /></Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => drop(i)} />
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                  const tiers = (form.getFieldValue('tiers') ?? []) as DeliveryFeeTier[]
                  const last = tiers[tiers.length - 1]
                  add(last ? { fromKm: Number(last.fromKm) + 3, fee: Number(last.fee) + 5000 } : { fromKm: 0, fee: 15000 })
                }}>Thêm mức km</Button>
              </>
            )}
          </Form.List>
          <Form.Item name="maxKm" label="Không giao quá" rules={[{ required: true, message: 'Nhập km' }]} style={{ marginTop: 16 }}>
            <InputNumber min={0.5} step={1} addonAfter="km" style={{ width: 180 }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={!!view} title={view?.name} footer={null} onCancel={() => setView(null)} destroyOnHidden>
        {view && <>
          <Table<DeliveryFeeTier> rowKey="fromKm" size="small" pagination={false} dataSource={view.tiers}
            columns={[
              { title: 'Mức km', render: (_, x) => `Từ ${km(x.fromKm)} km` },
              { title: 'Phí ship', align: 'right', render: (_, x) => money(x.fee) },
            ]} />
          <p style={{ marginTop: 12 }}>
            Không giao quá {km(view.maxKm ?? 0)} km.<br />
            Áp dụng: {view.isDefault ? 'mọi giờ không thuộc khung giờ nào' : usedIn(view.id).map((s) => `${hhmm(s.startTime)}–${hhmm(s.endTime)} (${dayText(s.days)})`).join('; ') || 'chưa gán khung giờ'}
          </p>
        </>}
      </Modal>
    </Card>
  )
}

// ---- khung giờ ------------------------------------------------------------------

type SlotValues = { range: [Dayjs, Dayjs]; days: number[]; planId: number }

function SlotsCard({ plans, slots, colorOf }: Props) {
  const [edit, setEdit] = useState<Partial<DeliveryTimeSlot> | null>(null)
  const [form] = Form.useForm<SlotValues>()
  const keys = [['delivery-time-slots'], ['delivery-fee-plans']]
  const save = useAction(coreApi.saveDeliveryTimeSlot, keys, 'Đã lưu khung giờ')
  const remove = useAction(coreApi.deleteDeliveryTimeSlot, keys, 'Đã xóa khung giờ')
  const { data: shop } = useQuery({ queryKey: ['delivery-settings'], queryFn: coreApi.deliverySettings })
  const choices = plans.filter((p) => !p.isDefault)
  const open = (s: Partial<DeliveryTimeSlot>) => {
    setEdit(s)
    form.resetFields()
    form.setFieldsValue({
      range: s.startTime && s.endTime ? [t(s.startTime)!, t(s.endTime)!] : undefined,
      days: s.days ?? [], planId: s.planId ?? choices[0]?.id,
    } as SlotValues)
  }
  const defaultName = plans.find((p) => p.isDefault)?.name ?? 'Mặc định'

  return (
    <Card title="Khung giờ" size="small"
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => open({})} disabled={!choices.length}>Thêm khung giờ</Button>}>
      <DayBar plans={plans} slots={slots} open={shop?.openTime} close={shop?.closeTime} colorOf={colorOf} defaultName={defaultName} />
      <Table<DeliveryTimeSlot> rowKey="id" size="small" pagination={false} dataSource={slots}
        columns={[
          { title: 'Khung giờ', render: (_, s) => <b>{hhmm(s.startTime)}–{hhmm(s.endTime)}</b> },
          { title: 'Ngày', render: (_, s) => dayText(s.days) },
          { title: 'Option', render: (_, s) => <Tag color={colorOf(s.planId)}>{s.planName}</Tag> },
          {
            title: '', width: 110, render: (_, s) => <Space size={4}>
              <Button size="small" onClick={() => open(s)}>Sửa</Button>
              <Popconfirm title="Xóa khung giờ?" onConfirm={() => remove.mutate(s.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>,
          },
        ]} />

      <Modal open={!!edit} title={edit?.id ? 'Sửa khung giờ' : 'Thêm khung giờ'} onCancel={() => setEdit(null)} destroyOnHidden
        footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({
          id: edit?.id, startTime: v.range[0].format('HH:mm'), endTime: v.range[1].format('HH:mm'), days: v.days ?? [], planId: v.planId,
        }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="range" label="Khung giờ" rules={[{ required: true, message: 'Chọn giờ' }]}
            extra={shop?.openTime && shop.closeTime ? `Mở cửa ${hhmm(shop.openTime)}–${hhmm(shop.closeTime)}` : undefined}>
            <TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }}
              hideDisabledOptions disabledTime={(_, type) => withinOpening(shop?.openTime, shop?.closeTime, type)} />
          </Form.Item>
          <Form.Item name="days" label="Ngày áp dụng"><Checkbox.Group options={DAYS} /></Form.Item>
          <Form.Item name="planId" label="Option giá" rules={[{ required: true, message: 'Chọn option' }]}>
            <Select options={choices.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

/** 24h bar: closed hours grey, each slot in its option's colour, the rest = option mặc định */
/**
 * Giờ chọn được cho khung giờ: chỉ trong giờ mở cửa — giờ bắt đầu là phút đang mở cửa, giờ kết thúc là phút ngay sau một
 * phút mở cửa (được kết thúc đúng giờ đóng cửa).
 */
const withinOpening = (open: string | undefined, close: string | undefined, type: 'start' | 'end') => {
  if (!open || !close) return {}
  const ok = (m: number) => covers(open, close, type === 'start' ? m : (m + 1439) % 1440)
  return {
    disabledHours: () => Array.from({ length: 24 }, (_, h) => h).filter((h) => ![0, 15, 30, 45].some((x) => ok(h * 60 + x))),
    disabledMinutes: (h: number) => Array.from({ length: 60 }, (_, x) => x).filter((x) => !ok(h * 60 + x)),
  }
}

/** slot {@code s} covers minute {@code m} of weekday {@code day} (1 = T2 … 7 = CN)? past midnight an overnight slot belongs to the day before */
const slotCovers = (s: DeliveryTimeSlot, day: number, m: number) => {
  if (!covers(s.startTime, s.endTime, m)) return false
  const overnight = mins(s.endTime) < mins(s.startTime)
  const owner = overnight && m < mins(s.endTime) ? (day === 1 ? 7 : day - 1) : day
  return !s.days.length || s.days.includes(owner)
}

/**
 * Tuần × 24h: mỗi dòng một thứ, mỗi ô 15 phút. Khung giờ tô màu option của nó, đúng ngày áp dụng; giờ còn lại = option mặc
 * định; ngoài giờ mở cửa xám — khung giờ rơi vào đó vẫn hiện (kẻ sọc) để thấy là không có tác dụng.
 */
function DayBar({ plans, slots, open, close, colorOf, defaultName }: {
  plans: DeliveryFeePlan[]; slots: DeliveryTimeSlot[]; open?: string; close?: string; colorOf: (planId?: number) => string; defaultName: string
}) {
  const at = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const used = plans.filter((p) => !p.isDefault && slots.some((s) => s.planId === p.id))
  return (
    <div style={{ marginBottom: 12 }}>
      {DAYS.map((d) => (
        <div key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span className="small" style={{ width: 24, textAlign: 'right' }}>{d.label}</span>
          <div style={{ display: 'flex', flex: 1, height: 14, borderRadius: 3, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
            {Array.from({ length: 96 }, (_, q) => {
              const m = q * 15
              const isOpen = !open || !close || covers(open, close, m)
              const hit = slots.find((s) => slotCovers(s, d.value, m))
              const color = hit ? colorOf(hit.planId) : DEFAULT_COLOR
              const background = isOpen ? color
                : hit ? `repeating-linear-gradient(135deg, ${color} 0 3px, #f0f0f0 3px 6px)` : '#f0f0f0'
              const what = hit ? hit.planName : defaultName
              return <div key={q} style={{ flex: 1, background }} title={`${d.label} ${at(m)} · ${isOpen ? what : `đóng cửa${hit ? ` (${what})` : ''}`}`} />
            })}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 30 }} className="a-muted small">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{h}h</span>)}
      </div>
      <Space size={14} wrap className="small" style={{ marginLeft: 30, marginTop: 4 }}>
        {[{ name: defaultName, color: DEFAULT_COLOR }, ...used.map((p) => ({ name: p.name, color: colorOf(p.id) }))].map((x) => (
          <span key={x.name}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: x.color, marginRight: 4 }} />{x.name}</span>
        ))}
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f0f0f0', border: '1px solid #d9d9d9', marginRight: 4 }} />Đóng cửa</span>
      </Space>
    </div>
  )
}
