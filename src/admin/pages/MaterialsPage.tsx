import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tabs, Tag } from 'antd'
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
  const [edit, setEdit] = useState<Partial<Material> | null>(null)
  const [batchesOf, setBatchesOf] = useState<Material | null>(null)
  const { data: batches = [], isLoading: bLoading } = useQuery({
    queryKey: ['batches', batchesOf?.id], queryFn: () => coreApi.batches(batchesOf!.id), enabled: !!batchesOf,
  })
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), [['materials']])
  const [form] = Form.useForm()
  const kind = Form.useWatch('kind', form) ?? edit?.kind ?? 'RAW'
  const unit = Form.useWatch('unit', form)
  const raws = data.filter((m) => m.kind === 'RAW' && m.id !== edit?.id)
  const prepared = batchesOf?.kind === 'PREPARED'
  const [tab, setTab] = useState<MaterialKind>('RAW')

  return (
    <>
      <PageHeader title="Nguyên liệu & lô" subtitle="Tồn kho = tổng số lượng còn lại của các lô · bán thành phẩm tự chế biến từ nguyên liệu thô"
        extra={isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ unit: tab === 'RAW' ? 'g' : 'ml', status: 'ACTIVE', kind: tab })}>
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
        <PreparedMaterialsTab materials={data} canEdit={isAdmin} canProduce={can(P.STOCK)} onEdit={setEdit} onBatches={setBatchesOf} />
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
          {
            title: '', width: 160, render: (_, m) => (
              <Space>
                <Button size="small" onClick={() => setBatchesOf(m)}>Các lô</Button>
                {isAdmin && <Button size="small" onClick={() => setEdit(m)}>Sửa</Button>}
              </Space>
            ),
          },
        ]}
      />
      )}
      <Modal open={!!edit} title={edit?.id ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden width={kind === 'PREPARED' ? 760 : 520}>
        <Form form={form} layout="vertical" preserve={false}
          initialValues={{ ...edit, components: edit?.components?.map((c) => ({ componentId: c.componentId, quantity: c.quantity })) ?? [{}] }}
          onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="kind">
            <Segmented block options={[{ value: 'RAW', label: 'Nguyên liệu thô (nhập mua)' }, { value: 'PREPARED', label: 'Bán thành phẩm (tự chế biến)' }]} />
          </Form.Item>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input placeholder={kind === 'PREPARED' ? 'VD: Cốt cold brew' : ''} /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
            <Form.Item name="minStock" label="Mức tồn tối thiểu"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          {kind === 'PREPARED' && (
            <>
              <div className="a-grid-3">
                <Form.Item name="yieldQuantity" label={`Định lượng chuẩn${unit ? ` (${unit})` : ''}`} rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="prepMinutes" label="Thời gian chế biến"><DurationInput defaultUnit={60} /></Form.Item>
                <Form.Item name="shelfLifeMinutes" label="Hạn dùng sau khi xong"><DurationInput defaultUnit={1440} /></Form.Item>
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
                        <MinusCircleOutlined onClick={() => remove(f.name)} />
                      </Space>
                    ))}
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Thêm nguyên liệu</Button>
                    <Form.ErrorList errors={errors} />
                  </>
                )}
              </Form.List>
              <h4 style={{ marginTop: 16 }}>Hướng dẫn chế biến</h4>
              <Form.Item name="instructions"><Input.TextArea autoSize={{ minRows: 4 }} placeholder={'1. …\n2. …'} /></Form.Item>
            </>
          )}
          <Form.Item name="status" label="Trạng thái" style={{ marginTop: 16 }}><Select options={[{ value: 'ACTIVE', label: 'Đang dùng' }, { value: 'INACTIVE', label: 'Ngưng dùng' }]} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Drawer open={!!batchesOf} onClose={() => setBatchesOf(null)} width={prepared ? 860 : 720} title={`Các lô · ${batchesOf?.name ?? ''}`}>
        <Table<Batch> rowKey="id" size="small" loading={bLoading} dataSource={batches} pagination={false}
          expandable={prepared ? {
            rowExpandable: (b) => !!b.inputs?.length,
            expandedRowRender: (b) => (
              <span className="a-muted small">Làm từ: {b.inputs!.map((i) => `${num(i.quantity)} ${i.unit} ${i.materialName} (lô #${i.batchId})`).join(' · ')}</span>
            ),
          } : undefined}
          columns={[
            { title: 'Lô', dataIndex: 'id', render: (v) => `#${v}` },
            ...(prepared ? [
              { title: 'Bắt đầu', render: (_: unknown, b: Batch) => dateTime(b.createdAt) },
              { title: 'Xong', render: (_: unknown, b: Batch) => (b.status === 'PREPARING' ? <span className="a-muted">dự kiến {dateTime(b.readyAt)}</span> : dateTime(b.readyAt)) },
            ] : []),
            { title: prepared ? 'Sản lượng' : 'Nhập', render: (_, b) => `${num(b.importQuantity)} ${b.unit}` },
            { title: 'Còn lại', render: (_, b) => <b>{num(b.remainingQuantity)} {b.unit}</b> },
            { title: prepared ? `Giá vốn / ${batchesOf?.unit}` : 'Đơn giá nhập', dataIndex: 'unitCost', render: (v) => (prepared ? (v == null ? '—' : `${num(v)}đ`) : money(v)) },
            {
              title: 'Hạn dùng', dataIndex: 'expiryDate',
              render: (v, b) => prepared
                ? <span style={{ color: b.expiresAt && dayjs(b.expiresAt).diff(dayjs(), 'hour') < 12 ? '#cf1322' : undefined }}>{dateTime(b.expiresAt) }</span>
                : <span style={{ color: v && dayjs(v).diff(dayjs(), 'day') <= 7 ? '#cf1322' : undefined }}>{date(v)}</span>,
            },
            { title: 'Trạng thái', render: (_, b) => <StatusTag label={BATCH_STATUS[b.status]} /> },
          ]} />
      </Drawer>
    </>
  )
}
