import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Checkbox, Form, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, TimePicker } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { DeliveryArea, DeliveryWardRule } from '@/api/types'
import { money } from '@/lib/format'
import { VnAddressInput } from '@/components/VnAddressInput'
import { loadVnUnits, unitKey, vnAddressRule } from '@/lib/vnAddress'
import { MoneyInput } from './MoneyInput'
import { useAction } from './useCrud'

const t = (s?: string) => (s ? dayjs(s.slice(0, 5), 'HH:mm') : undefined)

/** Phí giao hàng: cửa hàng (địa chỉ, giờ mở cửa, miễn phí ship), khu vực giao theo tỉnh + phường. */
export function DeliveryFeeSettings() {
  return (
    <div>
      <ShopCard />
      <AreasCard />
    </div>
  )
}

// ---- cửa hàng ------------------------------------------------------------------

type ShopForm = {
  shopAddress: string; hours?: [Dayjs, Dayjs]; freeShipThreshold?: number; minOrderAmount?: number; speedKmh?: number; freeShipGroupIds?: number[]
}

function ShopCard() {
  const { data, isLoading } = useQuery({ queryKey: ['delivery-settings'], queryFn: coreApi.deliverySettings })
  const save = useAction(coreApi.saveDeliverySettings, [['delivery-settings'], ['delivery-settings-public']], 'Đã lưu')
  if (isLoading || !data) return <Card loading style={{ marginBottom: 16 }} />
  return (
    <Card title="Cửa hàng" size="small" style={{ marginBottom: 16 }}>
      <Form<ShopForm> layout="vertical"
        initialValues={{ ...data, hours: data.openTime && data.closeTime ? [t(data.openTime), t(data.closeTime)] : undefined }}
        onFinish={(v) => save.mutate({
          shopAddress: v.shopAddress, freeShipThreshold: v.freeShipThreshold, minOrderAmount: v.minOrderAmount, speedKmh: v.speedKmh,
          openTime: v.hours?.[0]?.format('HH:mm'), closeTime: v.hours?.[1]?.format('HH:mm'), freeShipGroupIds: v.freeShipGroupIds ?? [],
        })}>
        <Form.Item name="shopAddress" label="Địa chỉ quán (điểm xuất phát của người giao)" rules={[vnAddressRule('quán')]}><VnAddressInput /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 12px' }}>
          <Form.Item name="hours" label="Giờ mở cửa"><TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="freeShipThreshold" label="Miễn phí ship từ"><MoneyInput /></Form.Item>
          <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
          <Form.Item name="speedKmh" label="Tốc độ di chuyển (ước tính giờ tới)"><InputNumber min={1} max={120} step={5} addonAfter="km/h" style={{ width: '100%' }} /></Form.Item>
        </div>
        <Form.Item name="freeShipGroupIds" label="Nhóm khách được miễn phí giao hàng (nhóm khách CRM)"
          extra={data.groups?.length ? 'Khách thuộc một trong các nhóm này luôn được miễn phí ship' : 'Chưa có nhóm khách nào — tạo ở CRM → Nhóm khách hàng'}>
          <Select mode="multiple" allowClear placeholder="VD: Thân thiết, VIP"
            options={(data.groups ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
      </Form>
    </Card>
  )
}

// ---- khu vực giao ----------------------------------------------------------------

type AreaForm = { name: string; fee: number; active: boolean; wards: DeliveryWardRule[] }

function AreasCard() {
  const { data: areas = [], isLoading } = useQuery({ queryKey: ['delivery-areas'], queryFn: coreApi.deliveryAreas })
  const { data: units = [] } = useQuery({ queryKey: ['vn-units'], queryFn: loadVnUnits, staleTime: Infinity })
  const [edit, setEdit] = useState<Partial<DeliveryArea> | null>(null)
  const [form] = Form.useForm<AreaForm>()
  const province = Form.useWatch('name', form)
  const wardsOf = units.find((p) => unitKey(p.n) === unitKey(province ?? ''))?.w ?? []
  const keys = [['delivery-areas'], ['delivery-settings-public']]
  const save = useAction((v: AreaForm & { id?: number }) => coreApi.saveDeliveryArea(v), keys, 'Đã lưu khu vực')
  const toggle = useAction((a: DeliveryArea) => coreApi.saveDeliveryArea({ ...a, active: !a.active }), keys, 'Đã cập nhật')
  const remove = useAction(coreApi.deleteDeliveryArea, keys, 'Đã xóa khu vực')
  const open = (a: Partial<DeliveryArea>) => {
    setEdit(a)
    form.resetFields()
    form.setFieldsValue({ name: a.name, fee: a.fee ?? 15000, active: a.active ?? true, wards: a.wards ?? [] })
  }
  const used = new Set(areas.filter((a) => a.id !== edit?.id).map((a) => unitKey(a.name)))

  return (
    <Card title="Khu vực giao hàng & phí ship" size="small" style={{ marginBottom: 16 }}
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => open({})}>Thêm tỉnh / thành</Button>}>
      {!isLoading && !areas.some((a) => a.active) && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chưa có khu vực nào đang giao — khách sẽ không đặt được đơn giao hàng" />
      )}
      <Table<DeliveryArea> rowKey="id" size="small" pagination={false} loading={isLoading} dataSource={areas}
        columns={[
          { title: 'Tỉnh / thành phố', render: (_, a) => <b>{a.name}</b> },
          { title: 'Phí ship', width: 130, align: 'right', render: (_, a) => money(a.fee) },
          {
            title: 'Phường / xã riêng', render: (_, a) => a.wards.length ? a.wards.map((w) => (
              <Tag key={w.name} color={w.blocked ? 'red' : 'blue'}>{w.name}: {w.blocked ? 'Không giao' : money(w.fee ?? a.fee)}</Tag>
            )) : <span className="a-muted small">Mọi phường / xã cùng phí</span>,
          },
          { title: 'Đang giao', width: 100, align: 'center', render: (_, a) => <Switch size="small" checked={a.active} onChange={() => toggle.mutate(a)} /> },
          {
            title: '', width: 110, render: (_, a) => <Space size={4}>
              <Button size="small" onClick={() => open(a)}>Sửa</Button>
              <Popconfirm title={`Ngừng giao tới ${a.name} và xóa cấu hình?`} onConfirm={() => remove.mutate(a.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>,
          },
        ]} />

      <Modal open={!!edit} title={edit?.id ? `Sửa khu vực · ${edit.name}` : 'Thêm tỉnh / thành giao hàng'} onCancel={() => setEdit(null)} destroyOnHidden width={680}
        footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, wards: v.wards ?? [], id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <div className="a-grid-2">
            <Form.Item name="name" label="Tỉnh / thành phố" rules={[{ required: true, message: 'Chọn tỉnh / thành' }]}>
              <Select showSearch placeholder="Thành phố Hà Nội" loading={!units.length}
                filterOption={(input, o) => unitKey(String(o?.label ?? '')).includes(unitKey(input))}
                options={units.filter((p) => !used.has(unitKey(p.n))).map((p) => ({ value: p.n, label: p.n }))}
                onChange={() => form.setFieldValue('wards', [])} />
            </Form.Item>
            <Form.Item name="fee" label="Phí ship mọi phường / xã" rules={[{ required: true, message: 'Nhập phí' }]}><MoneyInput /></Form.Item>
          </div>
          <Form.Item name="active" label="Đang giao" valuePropName="checked"><Switch /></Form.Item>
          <div style={{ marginBottom: 8 }}><b>Phường / xã có phí riêng hoặc không giao</b></div>
          <Form.List name="wards">
            {(fields, { add, remove: drop }) => <>
              {fields.map((f) => (
                <Space key={f.key} align="baseline" style={{ display: 'flex', marginBottom: 4 }} wrap>
                  <Form.Item name={[f.name, 'name']} rules={[{ required: true, message: 'Chọn phường / xã' }]} style={{ width: 260, marginBottom: 8 }}>
                    <Select showSearch placeholder="Phường / xã" disabled={!wardsOf.length}
                      filterOption={(input, o) => unitKey(String(o?.label ?? '')).includes(unitKey(input))}
                      options={wardsOf.map(([, n]) => ({ value: n, label: n }))} />
                  </Form.Item>
                  <Form.Item name={[f.name, 'blocked']} valuePropName="checked" style={{ marginBottom: 8 }}><Checkbox>Không giao</Checkbox></Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {() => !form.getFieldValue(['wards', f.name, 'blocked']) && (
                      <Form.Item name={[f.name, 'fee']} rules={[{ required: true, message: 'Nhập phí' }]} style={{ width: 170, marginBottom: 8 }}>
                        <MoneyInput placeholder="Phí riêng" />
                      </Form.Item>
                    )}
                  </Form.Item>
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => drop(f.name)} />
                </Space>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} disabled={!province} onClick={() => add({ blocked: false })}>Thêm phường / xã</Button>
            </>}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  )
}
