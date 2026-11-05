import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, TimePicker, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { DeliveryFeePlan, DeliveryFeeTier, DeliveryTimeSlot } from '@/api/types'
import { money } from '@/lib/format'
import { VnAddressInput } from '@/components/VnAddressInput'
import { vnAddressRule } from '@/lib/vnAddress'
import { MoneyInput } from './MoneyInput'
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
    <div style={{ maxWidth: 960 }}>
      <ShopCard />
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
        onFinish={(v: { shopAddress: string; hours?: [Dayjs, Dayjs]; freeShipThreshold?: number; minOrderAmount?: number }) => save.mutate({
          shopAddress: v.shopAddress, freeShipThreshold: v.freeShipThreshold, minOrderAmount: v.minOrderAmount,
          openTime: v.hours?.[0]?.format('HH:mm'), closeTime: v.hours?.[1]?.format('HH:mm'),
        })}>
        <Form.Item name="shopAddress" label="Địa chỉ quán" rules={[vnAddressRule('quán')]}><VnAddressInput /></Form.Item>
        <div className="a-grid-3">
          <Form.Item name="hours" label="Giờ mở cửa"><TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="freeShipThreshold" label="Miễn phí ship từ"><MoneyInput /></Form.Item>
          <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
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
  const [form] = Form.useForm<{ name: string; tiers: DeliveryFeeTier[] }>()
  const keys = [['delivery-fee-plans'], ['delivery-time-slots']]
  const save = useAction(coreApi.saveDeliveryFeePlan, keys, 'Đã lưu option')
  const remove = useAction(coreApi.deleteDeliveryFeePlan, keys, 'Đã xóa option')
  const open = (p: Partial<DeliveryFeePlan>) => {
    setEdit(p)
    form.resetFields()
    form.setFieldsValue({ name: p.name ?? '', tiers: p.tiers?.length ? p.tiers : [{ fromKm: 0, toKm: 3, fee: 15000 }] })
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
              <b>{p.name}</b>{p.isDefault && p.name !== 'Mặc định' && <Tag>Mặc định</Tag>}
            </Space>,
          },
          { title: 'Khoảng km', render: (_, p) => p.tiers.map((x) => <Tag key={x.fromKm}>{km(x.fromKm)}–{km(x.toKm)} km: {money(x.fee)}</Tag>) },
          { title: 'Khung giờ', render: (_, p) => (p.isDefault ? 'Giờ còn lại' : usedIn(p.id).map((s) => `${hhmm(s.startTime)}–${hhmm(s.endTime)}`).join(', ') || '—') },
          {
            title: '', width: 170, render: (_, p) => <Space size={4}>
              <Button size="small" type="link" onClick={() => setView(p)}>Xem</Button>
              <Button size="small" onClick={() => open(p)}>Sửa</Button>
              {!p.isDefault && (
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
          <Form.Item name="name" label="Tên option" rules={[{ required: true, message: 'Nhập tên' }]}><Input placeholder="Cao điểm" maxLength={60} /></Form.Item>
          <Form.List name="tiers">
            {(fields, { add, remove: drop }) => (
              <>
                {fields.map((f, i) => (
                  <Space key={f.key} align="baseline" wrap style={{ display: 'flex' }}>
                    <Form.Item name={[f.name, 'fromKm']} rules={[{ required: true, message: 'Nhập' }]}>
                      <InputNumber min={0} step={0.5} addonBefore="Từ" addonAfter="km" style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'toKm']} rules={[{ required: true, message: 'Nhập' }]}>
                      <InputNumber min={0.5} step={0.5} addonBefore="đến" addonAfter="km" style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'fee']} rules={[{ required: true, message: 'Nhập phí' }]}><MoneyInput style={{ width: 160 }} /></Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => drop(i)} />
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
                  const tiers = (form.getFieldValue('tiers') ?? []) as DeliveryFeeTier[]
                  const last = tiers[tiers.length - 1]
                  add(last ? { fromKm: last.toKm, toKm: Number(last.toKm) + 2, fee: Number(last.fee) + 5000 } : { fromKm: 0, toKm: 3, fee: 15000 })
                }}>Thêm khoảng km</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal open={!!view} title={view?.name} footer={null} onCancel={() => setView(null)} destroyOnHidden>
        {view && <>
          <Table<DeliveryFeeTier> rowKey="fromKm" size="small" pagination={false} dataSource={view.tiers}
            columns={[
              { title: 'Khoảng km', render: (_, x) => `${km(x.fromKm)}–${km(x.toKm)} km` },
              { title: 'Phí ship', align: 'right', render: (_, x) => money(x.fee) },
            ]} />
          <p style={{ marginTop: 12 }}>
            Ngoài {km(view.tiers[view.tiers.length - 1]?.toKm ?? 0)} km: không giao.<br />
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
      <DayBar slots={slots} open={shop?.openTime} close={shop?.closeTime} colorOf={colorOf} defaultName={defaultName} />
      <Table<DeliveryTimeSlot> rowKey="id" size="small" pagination={false} dataSource={slots}
        locale={{ emptyText: 'Chưa có khung giờ — cả ngày dùng option mặc định' }}
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
          <Form.Item name="range" label="Khung giờ" rules={[{ required: true, message: 'Chọn giờ' }]}>
            <TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="days" label="Ngày áp dụng" extra="Không chọn = mọi ngày"><Checkbox.Group options={DAYS} /></Form.Item>
          <Form.Item name="planId" label="Option giá" rules={[{ required: true, message: 'Chọn option' }]}>
            <Select options={choices.map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

/** 24h bar: closed hours grey, each slot in its option's colour, the rest = option mặc định */
function DayBar({ slots, open, close, colorOf, defaultName }: {
  slots: DeliveryTimeSlot[]; open?: string; close?: string; colorOf: (planId?: number) => string; defaultName: string
}) {
  const cells = Array.from({ length: 96 }, (_, q) => {
    const m = q * 15
    const isOpen = !open || !close || covers(open, close, m)
    const hit = slots.find((s) => covers(s.startTime, s.endTime, m))
    return { m, isOpen, hit }
  })
  const at = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid #d9d9d9' }}>
        {cells.map((c) => (
          <Tooltip key={c.m} title={`${at(c.m)} · ${!c.isOpen ? 'đóng cửa' : c.hit ? `${c.hit.planName} (${dayText(c.hit.days)})` : defaultName}`}>
            <div style={{ flex: 1, background: !c.isOpen ? '#f0f0f0' : c.hit ? colorOf(c.hit.planId) : DEFAULT_COLOR }} />
          </Tooltip>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }} className="a-muted small">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{h}h</span>)}
      </div>
    </div>
  )
}
