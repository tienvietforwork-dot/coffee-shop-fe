import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag } from 'antd'
import { MinusCircleOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi, type MaterialPayload } from '@/api/core'
import type { Batch, Material, MaterialKind } from '@/api/types'
import { BATCH_STATUS, date, dateTime, money, num } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { DurationInput } from '../components/DurationInput'
import { UsedInCell } from '../components/UsedInCell'
import { P, usePerm } from '@/lib/perm'
import { PreparedMaterialsTab } from './PreparedMaterialsTab'

const UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'gói', 'hộp', 'chai']

export function MaterialsPage() {
  const { can } = usePerm()
  const isAdmin = can(P.MATERIALS_EDIT)
  const { data = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: coreApi.alerts })
  const [tab, setTab] = useState<MaterialKind>('RAW')
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

  return (
    <>
      <PageHeader title="Nguyên liệu & lô" subtitle="Tồn kho = tổng số lượng còn lại của các lô · bán thành phẩm tự chế biến từ nguyên liệu thô"
        extra={isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDetail({ unit: tab === 'RAW' ? 'g' : 'ml', status: 'ACTIVE', kind: tab })}>
            {tab === 'RAW' ? 'Thêm nguyên liệu' : 'Thêm bán thành phẩm'}
          </Button>
        )} />
      {!!alerts?.expiringBatches.length && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`${alerts.expiringBatches.length} lô sắp hết hạn trong 7 ngày: ${alerts.expiringBatches.map((b) => `${b.materialName} (${date(b.expiryDate)})`).join(', ')}`} />
      )}
      <Tabs activeKey={tab} onChange={(k) => setTab(k as MaterialKind)} items={[
        { key: 'RAW', label: `Nguyên liệu thô (${data.filter((m) => m.kind === 'RAW').length})` },
        { key: 'PREPARED', label: `Bán thành phẩm (${data.filter((m) => m.kind === 'PREPARED').length})` },
      ]} />
      {tab === 'PREPARED' ? (
        <PreparedMaterialsTab materials={data} canProduce={can(P.STOCK)} onDetail={setDetail} />
      ) : (
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data.filter((m) => m.kind === 'RAW')}
        rowClassName={(m) => (m.lowStock ? 'a-row-warn' : '')}
        columns={[
          {
            title: 'Nguyên liệu', dataIndex: 'name', render: (v, m) => <>
              {v} {m.lowStock && <Tag color="red" icon={<WarningOutlined />}>Sắp hết</Tag>} {m.status === 'INACTIVE' && <Tag>Ngưng dùng</Tag>}
            </>,
          },
          { title: 'Tồn kho', render: (_, m) => <b>{num(m.stockQuantity)} {m.unit}</b>, sorter: (a, b) => a.stockQuantity / Math.max(a.minStock, 1) - b.stockQuantity / Math.max(b.minStock, 1) },
          { title: 'Tồn tối thiểu', render: (_, m) => `${num(m.minStock)} ${m.unit}` },
          { title: 'Dùng cho', render: (_, m) => <UsedInCell material={m} /> },
          { title: '', width: 120, render: (_, m) => <Button size="small" onClick={() => setDetail(m)}>Xem chi tiết</Button> },
        ]}
      />
      )}
      <Drawer open={!!detail} onClose={() => setDetail(null)} destroyOnHidden width={prepared ? 860 : 720}
        title={detail?.id ? `${detail.name} · chi tiết` : `Thêm ${noun}`}>
        <Form form={form} layout="vertical" preserve={false} disabled={!isAdmin}
          initialValues={{ ...detail, components: detail?.components?.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) ?? [{}] }}
          onFinish={(v) => save.mutate({ ...v, kind, id: detail?.id }, { onSuccess: (m) => setDetail(m) })}>
          <div className="a-grid-2">
            <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input placeholder={prepared ? 'VD: Cốt cold brew' : ''} /></Form.Item>
            <Form.Item name="status" label="Trạng thái"><Select options={[{ value: 'ACTIVE', label: 'Đang dùng' }, { value: 'INACTIVE', label: 'Ngưng dùng' }]} /></Form.Item>
            <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
            <Form.Item name="minStock" label="Mức tồn tối thiểu"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          {prepared && (
            <>
              <div className="a-grid-2">
                <Form.Item name="yieldQuantity" label={`Định lượng chuẩn${unit ? ` (${unit})` : ''}`} rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="shelfLifeMinutes" label="Hạn dùng sau khi chế biến"><DurationInput defaultUnit={1440} /></Form.Item>
              </div>
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
                { title: prepared ? `Giá vốn / ${detail.unit}` : 'Đơn giá nhập', dataIndex: 'unitCost', render: (v) => (prepared ? (v == null ? '—' : `${num(v)}đ`) : money(v)) },
                {
                  title: 'Hạn dùng', dataIndex: 'expiryDate',
                  render: (v, b) => prepared
                    ? <span style={{ color: b.expiresAt && dayjs(b.expiresAt).diff(dayjs(), 'hour') < 12 ? '#cf1322' : undefined }}>{dateTime(b.expiresAt)}</span>
                    : <span style={{ color: v && dayjs(v).diff(dayjs(), 'day') <= 7 ? '#cf1322' : undefined }}>{date(v)}</span>,
                },
                { title: 'Trạng thái', render: (_, b) => <StatusTag label={BATCH_STATUS[b.status]} /> },
              ]} />
          </>
        )}
      </Drawer>
    </>
  )
}
