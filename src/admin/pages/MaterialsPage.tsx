import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Drawer, Empty, Form, Input, InputNumber, Segmented, Select, Space, Table, Tabs, Tag } from 'antd'
import { MinusCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi, type MaterialPayload } from '@/api/core'
import type { Batch, Material, MaterialKind } from '@/api/types'
import { BATCH_STATUS, date, dateTime, duration, money, num } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { DurationInput } from '../components/DurationInput'
import { UsedInCell } from '../components/UsedInCell'
import { P, usePerm } from '@/lib/perm'
import { ProduceModal } from './ProduceModal'

const UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'gói', 'hộp', 'chai']

/** needs attention: below min stock, or its next lot is inside the expiry warning window */
const warn = (m: Material) => m.lowStock || !!m.expiringSoon

export function MaterialsPage() {
  const { can } = usePerm()
  const isAdmin = can(P.MATERIALS_EDIT)
  const canProduce = can(P.STOCK)
  const { data = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const [tab, setTab] = useState<MaterialKind>('RAW')
  // quick filters on the loaded list: name search + only the ones needing attention
  const [search, setSearch] = useState('')
  const [onlyWarn, setOnlyWarn] = useState(false)
  const ofTab = data.filter((m) => m.kind === tab)
  const q = search.trim().toLowerCase()
  const rows = ofTab.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!onlyWarn || warn(m)))
  const [producing, setProducing] = useState<Material | null>(null)

  // "Xem chi tiết": the material's info (editable with MATERIALS_EDIT, saved with Lưu) + its lots; no id = adding a new one
  const [detail, setDetail] = useState<Partial<Material> | null>(null)
  const kind = detail?.kind ?? tab
  const prepared = kind === 'PREPARED'
  const { data: batches = [], isLoading: bLoading } = useQuery({
    queryKey: ['batches', detail?.id], queryFn: () => coreApi.batches(detail!.id!), enabled: !!detail?.id,
  })
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), [['materials']])
  const [form] = Form.useForm()
  const unit = Form.useWatch('unit', form)
  const raws = data.filter((m) => m.kind === 'RAW' && m.id !== detail?.id)
  const noun = prepared ? 'bán thành phẩm' : 'nguyên liệu'
  const warnDays = detail?.expiryWarningDays ?? 7 // raw lots: same window as the backend (shop default 7)
  // fill the form every time the drawer opens (and after Lưu), not only on its first mount
  useEffect(() => {
    if (!detail) return
    form.resetFields()
    form.setFieldsValue({ ...detail, components: detail.components?.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) ?? [{}] })
  }, [detail, form])

  return (
    <>
      <PageHeader title="Nguyên liệu & lô" subtitle="Tồn kho = tổng số lượng còn lại của các lô · bán thành phẩm tự chế biến từ nguyên liệu thô"
        extra={isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDetail({ unit: tab === 'RAW' ? 'g' : 'ml', status: 'ACTIVE', kind: tab })}>
            {tab === 'RAW' ? 'Thêm nguyên liệu' : 'Thêm bán thành phẩm'}
          </Button>
        )} />
      <Tabs activeKey={tab} onChange={(k) => setTab(k as MaterialKind)} items={[
        { key: 'RAW', label: `Nguyên liệu thô (${data.filter((m) => m.kind === 'RAW').length})` },
        { key: 'PREPARED', label: `Bán thành phẩm (${data.filter((m) => m.kind === 'PREPARED').length})` },
      ]} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder={tab === 'RAW' ? 'Tìm nguyên liệu' : 'Tìm bán thành phẩm'}
          value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Segmented value={onlyWarn ? 'warn' : 'all'} onChange={(v) => setOnlyWarn(v === 'warn')} options={[
          { value: 'all', label: 'Tất cả' },
          { value: 'warn', label: `Đang cảnh báo (${ofTab.filter(warn).length})` },
        ]} />
      </Space>
      <Table<Material>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        rowClassName={(m) => (warn(m) ? 'a-row-warn' : '')}
        locale={{ emptyText: <Empty description={ofTab.length ? 'Không có kết quả phù hợp' : tab === 'RAW' ? 'Chưa có nguyên liệu' : 'Chưa có bán thành phẩm — bấm Thêm để khai báo (VD: cốt cold brew, nước đường)'} /> }}
        scroll={{ x: 900 }}
        columns={[
          {
            title: tab === 'RAW' ? 'Nguyên liệu' : 'Bán thành phẩm', dataIndex: 'name', render: (v, m) => <>
              {v} {m.lowStock && <Tag color="red">Sắp hết</Tag>} {m.expiringSoon && <Tag color="red">Sắp hết hạn</Tag>} {m.status === 'INACTIVE' && <Tag>Ngưng dùng</Tag>}
            </>,
          },
          { title: 'Tồn kho', render: (_, m) => <b>{num(m.stockQuantity)} {m.unit}</b>, sorter: (a, b) => a.stockQuantity / Math.max(a.minStock, 1) - b.stockQuantity / Math.max(b.minStock, 1) },
          { title: 'Tồn tối thiểu', render: (_, m) => `${num(m.minStock)} ${m.unit}` },
          {
            title: 'HSD gần nhất', sorter: (a, b) => (a.nextExpiryDate ?? '9999').localeCompare(b.nextExpiryDate ?? '9999'),
            render: (_, m) => (m.nextExpiryDate
              ? <span style={{ color: m.expiringSoon ? '#cf1322' : undefined, fontWeight: m.expiringSoon ? 600 : undefined }}>{date(m.nextExpiryDate)}</span>
              : '—'),
          },
          ...(tab === 'PREPARED' ? [{ title: 'Hạn dùng chuẩn', render: (_: unknown, m: Material) => duration(m.shelfLifeMinutes) }] : []),
          { title: 'Dùng cho', render: (_, m) => <UsedInCell material={m} /> },
          {
            title: '', width: tab === 'PREPARED' && canProduce ? 190 : 120, render: (_, m) => (
              <Space>
                {tab === 'PREPARED' && canProduce && (
                  <Button type="primary" size="small" disabled={m.status === 'INACTIVE'} onClick={() => setProducing(m)}>Chế biến</Button>
                )}
                <Button size="small" onClick={() => setDetail(m)}>Xem chi tiết</Button>
              </Space>
            ),
          },
        ]}
      />
      {producing && <ProduceModal material={producing} materials={data} onClose={() => setProducing(null)} />}
      <Drawer open={!!detail} onClose={() => setDetail(null)} destroyOnHidden width={prepared ? 860 : 720}
        title={detail?.id ? `${detail.name} · chi tiết` : `Thêm ${noun}`}>
        <Form form={form} layout="vertical" preserve={false} disabled={!isAdmin}
          onFinish={(v) => save.mutate({ ...v, kind, id: detail?.id }, { onSuccess: (m) => setDetail(m) })}>
          <div className="a-grid-2">
            <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input placeholder={prepared ? 'VD: Cốt cold brew' : ''} /></Form.Item>
            <Form.Item name="status" label="Trạng thái"><Select options={[{ value: 'ACTIVE', label: 'Đang dùng' }, { value: 'INACTIVE', label: 'Ngưng dùng' }]} /></Form.Item>
            <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
            <Form.Item name="minStock" label="Mức tồn tối thiểu"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="expiryWarningDays" label="Cảnh báo trước khi hết hạn"
              extra={prepared ? 'Để trống = không cảnh báo · 1 = cảnh báo lô hết hạn trong ngày mai' : 'Để trống = mặc định 7 ngày · 0 = không cảnh báo (hàng tiêu thụ nhanh)'}>
              <InputNumber min={0} precision={0} addonAfter="ngày" placeholder={prepared ? '' : '7'} style={{ width: '100%' }} />
            </Form.Item>
            {prepared && (
              <Form.Item name="shelfLifeMinutes" label="Hạn dùng sau khi chế biến"><DurationInput defaultUnit={1440} /></Form.Item>
            )}
          </div>
          {prepared && (
            <>
              <Form.Item name="yieldQuantity" label={`Định lượng chuẩn${unit ? ` (${unit})` : ''}`} rules={[{ required: true }]}>
                <InputNumber min={0.01} style={{ width: '50%' }} />
              </Form.Item>
              <h4>Nguyên liệu cho định lượng chuẩn</h4>
              <Form.List name="components" rules={[{ validator: async (_, v) => { if (!v?.length) throw new Error('Cần ít nhất 1 nguyên liệu') } }]}>
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((f) => (
                      <Space key={f.key} align="baseline" style={{ display: 'flex' }}>
                        <Form.Item name={[f.name, 'componentId']} rules={[{ required: true, message: 'Chọn' }]} style={{ width: 300 }}>
                          <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu thô" options={raws.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                        </Form.Item>
                        <Form.Item name={[f.name, 'quantity']} rules={[{ required: true, message: 'Nhập' }]}>
                          <InputNumber min={0.01} placeholder="Số lượng" style={{ width: 140 }} />
                        </Form.Item>
                        {isAdmin && <MinusCircleOutlined onClick={() => remove(f.name)} />}
                      </Space>
                    ))}
                    {isAdmin && <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Thêm nguyên liệu</Button>}
                    <Form.ErrorList errors={errors} />
                  </>
                )}
              </Form.List>
              <h4 style={{ marginTop: 16 }}>Ghi chú cách làm</h4>
              <Form.Item name="instructions"><Input.TextArea autoSize={{ minRows: 3 }} placeholder={'1. …\n2. …'} /></Form.Item>
            </>
          )}
          {isAdmin && <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>}
        </Form>
        {detail?.id && (
          <>
            <h4 style={{ marginTop: 24 }}>Các lô</h4>
            <Table<Batch> rowKey="id" size="small" loading={bLoading} dataSource={batches} pagination={false}
              expandable={prepared ? {
                rowExpandable: (b) => !!b.inputs?.length,
                expandedRowRender: (b) => (
                  <span className="a-muted small">Làm từ: {b.inputs!.map((i) => `${num(i.quantity)} ${i.unit} ${i.materialName} (lô #${i.batchId})`).join(' · ')}</span>
                ),
              } : undefined}
              columns={[
                { title: 'Lô', dataIndex: 'id', render: (v) => `#${v}` },
                { title: prepared ? 'Chế biến lúc' : 'Ngày nhập', render: (_, b) => (prepared ? dateTime(b.createdAt) : date(b.createdAt)) },
                { title: prepared ? 'Sản lượng' : 'Nhập', render: (_, b) => `${num(b.importQuantity)} ${b.unit}` },
                { title: 'Còn lại', render: (_, b) => <b>{num(b.remainingQuantity)} {b.unit}</b> },
                prepared
                  ? { title: `Giá vốn / ${detail.unit}`, dataIndex: 'unitCost', render: (v) => (v == null ? '—' : `${num(v)}đ`) }
                  : { title: 'Thành tiền', render: (_, b) => (b.unitCost == null ? '—' : money(b.importQuantity * b.unitCost)) },
                {
                  title: 'Hạn dùng', dataIndex: 'expiryDate',
                  render: (v, b) => prepared
                    ? <span style={{ color: b.expiresAt && dayjs(b.expiresAt).diff(dayjs(), 'hour') < 12 ? '#cf1322' : undefined }}>{dateTime(b.expiresAt)}</span>
                    : <span style={{ color: v && warnDays > 0 && dayjs(v).diff(dayjs().startOf('day'), 'day') <= warnDays ? '#cf1322' : undefined }}>{date(v)}</span>,
                },
                { title: 'Trạng thái', render: (_, b) => <StatusTag label={BATCH_STATUS[b.status]} /> },
              ]} />
          </>
        )}
      </Drawer>
    </>
  )
}
