import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Switch, Table, Tag, TimePicker, Tooltip } from 'antd'
import { DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { DeliveryArea } from '@/api/types'
import { money } from '@/lib/format'
import { VnAddressInput } from '@/components/VnAddressInput'
import { loadVnUnits, unitKey, vnAddressRule } from '@/lib/vnAddress'
import { MoneyInput } from './MoneyInput'
import { useAction } from './useCrud'

/** bỏ dấu, chữ thường, gộp khoảng trắng — giữ nguyên tiền tố phường / xã để lọc được theo loại */
const searchKey = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim()

/** loại đơn vị theo tiền tố tên: "Phường …", "Xã …", "Đặc khu …" */
const wardKind = (name: string) => /^(phuong|xa|dac khu|thi tran)\b/.exec(searchKey(name))?.[1] ?? 'khac'
const KIND_LABEL: Record<string, string> = { phuong: 'Phường', xa: 'Xã', 'dac khu': 'Đặc khu', 'thi tran': 'Thị trấn', khac: 'Khác' }

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
  shopAddress: string; hours?: [Dayjs, Dayjs]; freeShipThreshold?: number; minOrderAmount?: number; freeShipGroupIds?: number[]
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
          shopAddress: v.shopAddress, freeShipThreshold: v.freeShipThreshold, minOrderAmount: v.minOrderAmount,
          openTime: v.hours?.[0]?.format('HH:mm'), closeTime: v.hours?.[1]?.format('HH:mm'), freeShipGroupIds: v.freeShipGroupIds ?? [],
        })}>
        <Form.Item name="shopAddress" label="Địa chỉ quán (điểm xuất phát của người giao)" rules={[vnAddressRule('quán')]}><VnAddressInput /></Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 12px' }}>
          <Form.Item name="hours" label="Giờ mở cửa"><TimePicker.RangePicker format="HH:mm" minuteStep={15} order={false} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="freeShipThreshold" label="Miễn phí ship từ"><MoneyInput /></Form.Item>
          <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>        </div>
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

/** một phường / xã trong bảng: không giao, hoặc giao với phí riêng (custom) và / hoặc thời gian giao riêng (customTime) */
type WardRow = { name: string; blocked: boolean; custom: boolean; fee?: number | null; customTime: boolean; minutes?: number | null }

const mins = (m?: number | null) => (m == null ? '—' : `${m} phút`)

/** ô nhập số phút giao */
function MinutesInput(props: { value?: number; onChange?: (v: number | null) => void; size?: 'small'; status?: 'error'; placeholder?: string; style?: React.CSSProperties }) {
  return <InputNumber min={1} max={600} step={5} precision={0} addonAfter="phút" style={{ width: '100%', ...props.style }} {...props} />
}

function AreasCard() {
  const { data: areas = [], isLoading } = useQuery({ queryKey: ['delivery-areas'], queryFn: coreApi.deliveryAreas })
  const [edit, setEdit] = useState<Partial<DeliveryArea> | null>(null)
  const keys = [['delivery-areas'], ['delivery-settings-public']]
  const toggle = useAction((a: DeliveryArea) => coreApi.saveDeliveryArea({ ...a, active: !a.active }), keys, 'Đã cập nhật')
  const remove = useAction(coreApi.deleteDeliveryArea, keys, 'Đã xóa khu vực')

  return (
    <Card title="Khu vực giao hàng, phí ship & thời gian giao" size="small" style={{ marginBottom: 16 }}
      extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Thêm tỉnh / thành</Button>}>
      {!isLoading && !areas.some((a) => a.active) && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chưa có khu vực nào đang giao — khách sẽ không đặt được đơn giao hàng" />
      )}
      <Table<DeliveryArea> rowKey="id" size="small" pagination={false} loading={isLoading} dataSource={areas}
        columns={[
          { title: 'Tỉnh / thành phố', render: (_, a) => <b>{a.name}</b> },
          { title: 'Phí ship', width: 130, align: 'right', render: (_, a) => money(a.fee) },
          { title: 'Thời gian giao', width: 120, align: 'right', render: (_, a) => mins(a.deliveryMinutes) },
          {
            title: 'Phường / xã riêng', render: (_, a) => {
              const blocked = a.wards.filter((w) => w.blocked)
              const custom = a.wards.filter((w) => !w.blocked && w.fee != null)
              const timed = a.wards.filter((w) => !w.blocked && w.deliveryMinutes != null)
              if (!a.wards.length) return <span className="a-muted small">Mọi phường / xã cùng phí & thời gian</span>
              return <Space size={4} wrap>
                {!!blocked.length && <Tooltip title={blocked.map((w) => w.name).join(', ')}><Tag color="red">{blocked.length} không giao</Tag></Tooltip>}
                {!!custom.length && <Tooltip title={custom.map((w) => `${w.name}: ${money(w.fee)}`).join(' · ')}><Tag color="blue">{custom.length} phí riêng</Tag></Tooltip>}
                {!!timed.length && <Tooltip title={timed.map((w) => `${w.name}: ${mins(w.deliveryMinutes)}`).join(' · ')}><Tag color="purple">{timed.length} thời gian riêng</Tag></Tooltip>}
              </Space>
            },
          },
          { title: 'Đang giao', width: 100, align: 'center', render: (_, a) => <Switch size="small" checked={a.active} onChange={() => toggle.mutate(a)} /> },
          {
            title: '', width: 110, render: (_, a) => <Space size={4}>
              <Button size="small" onClick={() => setEdit(a)}>Sửa</Button>
              <Popconfirm title={`Ngừng giao tới ${a.name} và xóa cấu hình?`} onConfirm={() => remove.mutate(a.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>,
          },
        ]} />
      {edit && <AreaModal area={edit} used={areas.filter((a) => a.id !== edit.id).map((a) => unitKey(a.name))} onClose={() => setEdit(null)} />}
    </Card>
  )
}

/**
 * Sửa một tỉnh: danh sách mọi phường / xã của tỉnh, mặc định đều giao với phí và thời gian giao của tỉnh. Tích
 * "Không giao", "Phí riêng" hoặc "Thời gian riêng" (rồi nhập giá trị) cho từng dòng, hoặc chọn nhiều dòng để làm một lần.
 * Lưu thì tự kiểm tra phí / thời gian riêng còn trống.
 */
function AreaModal({ area, used, onClose }: { area: Partial<DeliveryArea>; used: string[]; onClose: () => void }) {
  const { message } = App.useApp()
  const { data: units = [] } = useQuery({ queryKey: ['vn-units'], queryFn: loadVnUnits, staleTime: Infinity })
  const [province, setProvince] = useState<string | undefined>(area.name)
  const [fee, setFee] = useState<number | null>(area.fee ?? 15000)
  const [minutes, setMinutes] = useState<number | null>(area.deliveryMinutes ?? 30)
  const [active, setActive] = useState(area.active ?? true)
  const [rules, setRules] = useState<Record<string, WardRow>>(() => Object.fromEntries((area.wards ?? []).map((w) =>
    [unitKey(w.name), {
      name: w.name, blocked: w.blocked, custom: !w.blocked && w.fee != null, fee: w.fee,
      customTime: !w.blocked && w.deliveryMinutes != null, minutes: w.deliveryMinutes,
    }])))
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<string>('all')
  const [show, setShow] = useState<'all' | 'blocked' | 'custom' | 'time'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkFee, setBulkFee] = useState<number | null>(null)
  const [bulkMinutes, setBulkMinutes] = useState<number | null>(null)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const save = useAction((v: Omit<DeliveryArea, 'id'> & { id?: number }) => coreApi.saveDeliveryArea(v), [['delivery-areas'], ['delivery-settings-public']], 'Đã lưu khu vực')

  // mọi phường / xã của tỉnh + phường đã lưu mà danh mục không còn (đổi tên…)
  const names = units.find((p) => unitKey(p.n) === unitKey(province ?? ''))?.w.map(([, n]) => n) ?? []
  const all: WardRow[] = [
    ...names.map((n) => rules[unitKey(n)] ?? { name: n, blocked: false, custom: false, customTime: false }),
    ...Object.values(rules).filter((r) => !names.some((n) => unitKey(n) === unitKey(r.name))),
  ]
  // tìm theo cả tên đầy đủ ("Xã …", "Phường …"): unitKey bỏ tiền tố nên gõ "xã" sẽ ra hết
  const q = searchKey(search)
  // bộ lọc loại chỉ hiện khi tỉnh có từ 2 loại trở lên (vd. vừa phường vừa xã)
  const kindCounts = all.reduce<Record<string, number>>((m, r) => { const k = wardKind(r.name); m[k] = (m[k] ?? 0) + 1; return m }, {})
  const kinds = Object.keys(kindCounts).sort((a, b) => Object.keys(KIND_LABEL).indexOf(a) - Object.keys(KIND_LABEL).indexOf(b))
  const kindFilter = kinds.length > 1 && kinds.includes(kind) ? kind : 'all'
  const rows = all.filter((r) => (!q || searchKey(r.name).includes(q))
    && (kindFilter === 'all' || wardKind(r.name) === kindFilter)
    && (show === 'all' || (show === 'blocked' ? r.blocked : show === 'custom' ? r.custom && !r.blocked : r.customTime && !r.blocked)))
  const blockedCount = all.filter((r) => r.blocked).length
  const customCount = all.filter((r) => r.custom && !r.blocked).length
  const timeCount = all.filter((r) => r.customTime && !r.blocked).length

  const patch = (list: string[], p: Partial<WardRow>) => {
    setRules((prev) => {
      const next = { ...prev }
      for (const name of list) {
        const k = unitKey(name)
        const row = { ...(next[k] ?? { name, blocked: false, custom: false, customTime: false }), ...p }
        if (!row.blocked && !row.custom && !row.customTime) delete next[k]
        else next[k] = row
      }
      return next
    })
    setInvalid((prev) => {
      const s = new Set(prev)
      list.forEach((n) => s.delete(unitKey(n)))
      return s
    })
  }

  const submit = () => {
    if (!province) return void message.error('Chọn tỉnh / thành phố')
    if (fee == null || fee < 0) return void message.error('Nhập phí ship mặc định của tỉnh')
    if (minutes == null || minutes <= 0) return void message.error('Nhập thời gian giao mặc định của tỉnh')
    const list = (rs: WardRow[]) => `${rs.slice(0, 3).map((r) => r.name).join(', ')}${rs.length > 3 ? '…' : ''}`
    const missing = all.filter((r) => r.custom && !r.blocked && (r.fee == null || r.fee < 0))
    if (missing.length) {
      setInvalid(new Set(missing.map((r) => unitKey(r.name))))
      setShow('custom')
      return void message.error(`Nhập phí riêng cho ${missing.length} phường / xã: ${list(missing)}`)
    }
    const missingTime = all.filter((r) => r.customTime && !r.blocked && (r.minutes == null || r.minutes <= 0))
    if (missingTime.length) {
      setInvalid(new Set(missingTime.map((r) => unitKey(r.name))))
      setShow('time')
      return void message.error(`Nhập thời gian giao riêng cho ${missingTime.length} phường / xã: ${list(missingTime)}`)
    }
    save.mutate({
      id: area.id, name: province, fee, deliveryMinutes: minutes, active,
      wards: all.filter((r) => r.blocked || r.custom || r.customTime).map((r) => ({
        name: r.name, blocked: r.blocked,
        fee: r.blocked || !r.custom ? null : r.fee,
        deliveryMinutes: r.blocked || !r.customTime ? null : r.minutes,
      })),
    }, { onSuccess: onClose })
  }

  return (
    <Modal open title={area.id ? `Sửa khu vực · ${area.name}` : 'Thêm tỉnh / thành giao hàng'} onCancel={onClose} width={1040}
      footer={<Space>
        {province && <span className="a-muted small">Giao {all.length - blockedCount}/{all.length} phường / xã · {customCount} phí riêng · {timeCount} thời gian riêng</span>}
        <Button type="primary" loading={save.isPending} onClick={submit}>Lưu</Button>
      </Space>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 12 }}>
        <div>
          <div className="small" style={{ marginBottom: 4 }}>Tỉnh / thành phố</div>
          <Select showSearch style={{ width: '100%' }} placeholder="Thành phố Hà Nội" value={province} loading={!units.length}
            filterOption={(input, o) => unitKey(String(o?.label ?? '')).includes(unitKey(input))}
            options={units.filter((p) => !used.includes(unitKey(p.n))).map((p) => ({ value: p.n, label: p.n }))}
            onChange={(v: string) => { setProvince(v); setRules({}); setSelected([]) }} />
        </div>
        <div>
          <div className="small" style={{ marginBottom: 4 }}>Phí ship mặc định</div>
          <MoneyInput value={fee ?? undefined} onChange={(v) => setFee(v ?? null)} />
        </div>
        <div>
          <div className="small" style={{ marginBottom: 4 }}>Thời gian giao mặc định</div>
          <MinutesInput value={minutes ?? undefined} onChange={setMinutes} />
        </div>
        <div>
          <div className="small" style={{ marginBottom: 4 }}>Đang giao</div>
          <Switch checked={active} onChange={setActive} />
        </div>
      </div>

      <Space wrap style={{ marginBottom: 8 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm phường / xã" style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        {kinds.length > 1 && (
          <Select style={{ width: 150 }} value={kindFilter} onChange={setKind} options={[
            { value: 'all', label: `Mọi loại (${all.length})` },
            ...kinds.map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${kindCounts[k]})` })),
          ]} />
        )}
        <Segmented value={show} onChange={(v) => setShow(v as typeof show)} options={[
          { value: 'all', label: `Tất cả (${all.length})` },
          { value: 'blocked', label: `Không giao (${blockedCount})` },
          { value: 'custom', label: `Phí riêng (${customCount})` },
          { value: 'time', label: `Thời gian riêng (${timeCount})` },
        ]} />
      </Space>
      {!!selected.length && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8, padding: '6px 10px', background: 'rgba(22,119,255,0.06)', borderRadius: 6 }}>
          <b>Đã chọn {selected.length}:</b>
          <Button size="small" danger onClick={() => patch(selected, { blocked: true })}>Không giao</Button>
          <Button size="small" onClick={() => patch(selected, { blocked: false, custom: false, fee: null, customTime: false, minutes: null })}>Giao, theo mặc định</Button>
          <MoneyInput size="small" style={{ width: 150 }} placeholder="Phí riêng" value={bulkFee ?? undefined} onChange={(v) => setBulkFee(v ?? null)} />
          <Button size="small" type="primary" disabled={bulkFee == null} onClick={() => patch(selected, { blocked: false, custom: true, fee: bulkFee })}>Đặt phí riêng</Button>
          <MinutesInput size="small" style={{ width: 140 }} placeholder="Phút" value={bulkMinutes ?? undefined} onChange={setBulkMinutes} />
          <Button size="small" type="primary" disabled={bulkMinutes == null} onClick={() => patch(selected, { blocked: false, customTime: true, minutes: bulkMinutes })}>Đặt thời gian riêng</Button>
          <Button size="small" type="link" onClick={() => setSelected([])}>Bỏ chọn</Button>
        </div>
      )}
      <Table<WardRow> rowKey={(r) => unitKey(r.name)} size="small" dataSource={rows} pagination={false} scroll={{ y: 380 }}
        locale={{ emptyText: province ? 'Không có phường / xã phù hợp' : 'Chọn tỉnh / thành phố trước' }}
        rowSelection={{ selectedRowKeys: selected.map(unitKey), onChange: (_, rs) => setSelected(rs.map((r) => r.name)) }}
        columns={[
          { title: 'Phường / xã', dataIndex: 'name', render: (v: string, r) => <span style={{ textDecoration: r.blocked ? 'line-through' : undefined, opacity: r.blocked ? 0.6 : 1 }}>{v}</span> },
          {
            title: 'Không giao', width: 100, align: 'center',
            render: (_, r) => <Checkbox checked={r.blocked} onChange={(e) => patch([r.name], { blocked: e.target.checked })} />,
          },
          {
            title: 'Phí riêng', width: 90, align: 'center',
            render: (_, r) => <Checkbox checked={r.custom} disabled={r.blocked} onChange={(e) => patch([r.name], { custom: e.target.checked })} />,
          },
          {
            title: 'Phí áp dụng', width: 190, render: (_, r) => r.blocked ? <Tag color="red">Không giao</Tag>
              : r.custom ? <MoneyInput size="small" status={invalid.has(unitKey(r.name)) ? 'error' : undefined} placeholder="Nhập phí"
                value={r.fee ?? undefined} onChange={(v) => patch([r.name], { fee: v ?? null })} />
              : <span className="a-muted">{money(fee ?? 0)}</span>,
          },
          {
            title: 'TG riêng', width: 80, align: 'center',
            render: (_, r) => <Checkbox checked={r.customTime} disabled={r.blocked} onChange={(e) => patch([r.name], { customTime: e.target.checked })} />,
          },
          {
            title: 'Thời gian giao', width: 150, render: (_, r) => r.blocked ? null
              : r.customTime ? <MinutesInput size="small" status={invalid.has(unitKey(r.name)) ? 'error' : undefined} placeholder="Phút"
                value={r.minutes ?? undefined} onChange={(v) => patch([r.name], { minutes: v })} />
              : <span className="a-muted">{mins(minutes)}</span>,
          },
        ]} />
    </Modal>
  )
}
