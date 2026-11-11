import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table, Tag, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons'
import { coreApi, type MaterialPayload } from '@/api/core'
import type { Material } from '@/api/types'
import { num } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { UsedInCell } from '../components/UsedInCell'

const UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'gói', 'hộp', 'chai']
/** món dùng nguyên liệu này còn pha được ít hơn số ly này → tô vàng */
const LOW_CUPS = 10

/**
 * Nguyên liệu thô: tên, đơn vị, số lượng hiện có. Định lượng mỗi ly khai báo trong công thức;
 * bắt đầu pha đơn thì tự trừ, món thiếu nguyên liệu tự "Hết món" và tự mở bán khi đủ lại.
 */
export function MaterialsPage() {
  const canEdit = usePerm().can(P.MATERIALS_EDIT)
  const { data = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = data.filter((m) => !q || m.name.toLowerCase().includes(q))
  const [edit, setEdit] = useState<Partial<Material> | null>(null)
  const [adjust, setAdjust] = useState<Material | null>(null)
  const refresh = [['materials'], ['recipes'], ['coffees']]
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), refresh)
  const change = useAction((v: { id: number; delta: number }) => coreApi.adjustMaterial(v.id, v.delta), refresh, 'Đã điều chỉnh số lượng')
  const del = useAction(coreApi.deleteMaterial, [['materials']], 'Đã xóa')

  return (
    <>
      <PageHeader title="Nguyên liệu" subtitle="Bắt đầu pha đơn thì tự trừ theo công thức; món thiếu nguyên liệu tự chuyển Hết món"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Thêm nguyên liệu</Button>} />
      <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm nguyên liệu" style={{ maxWidth: 320, marginBottom: 12 }}
        value={search} onChange={(e) => setSearch(e.target.value)} />
      <Table rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          { title: 'Tên', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
          {
            title: 'Số lượng', width: 190, align: 'right', sorter: (a, b) => a.quantity - b.quantity,
            render: (_, m) => (
              <Space size={6}>
                <b>{num(m.quantity)}</b><span className="a-muted">{m.unit}</span>
                {m.cupsLeft != null && (m.cupsLeft === 0
                  ? <Tag color="red">Hết</Tag>
                  : m.cupsLeft < LOW_CUPS && <Tooltip title="Món dùng nguyên liệu này còn pha được ít ly"><Tag color="gold">~{m.cupsLeft} ly</Tag></Tooltip>)}
              </Space>
            ),
          },
          { title: 'Dùng trong', render: (_, m) => <UsedInCell material={m} /> },
          {
            title: '', width: 230, render: (_, m) => canEdit && (
              <Space>
                <Button size="small" icon={<SwapOutlined />} onClick={() => setAdjust(m)}>Điều chỉnh</Button>
                <Button size="small" onClick={() => setEdit(m)}>Sửa</Button>
                <Popconfirm title="Xóa nguyên liệu?" onConfirm={() => del.mutate(m.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ name: edit?.name, unit: edit?.unit, quantity: edit?.quantity ?? 0 }}
          onFinish={(v: MaterialPayload) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
          <Form.Item name="quantity" label="Số lượng hiện có" rules={[{ required: true }]}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <AdjustModal material={adjust} loading={change.isPending} onClose={() => setAdjust(null)}
        onSubmit={(delta) => adjust && change.mutate({ id: adjust.id, delta }, { onSuccess: () => setAdjust(null) })} />
    </>
  )
}

/** Thêm / bớt nhanh một lượng (không lưu phiếu, chỉ đổi số lượng). */
function AdjustModal({ material, loading, onClose, onSubmit }: {
  material: Material | null; loading: boolean; onClose: () => void; onSubmit: (delta: number) => void
}) {
  const [form] = Form.useForm<{ kind: 'add' | 'sub'; amount: number }>()
  const kind = Form.useWatch('kind', form)
  const amount = Form.useWatch('amount', form) ?? 0
  const after = material ? material.quantity + (kind === 'sub' ? -amount : amount) : 0
  return (
    <Modal open={!!material} title={`Điều chỉnh số lượng · ${material?.name ?? ''}`} footer={null} onCancel={onClose} destroyOnHidden>
      <Form form={form} layout="vertical" initialValues={{ kind: 'add' }}
        onFinish={(v) => onSubmit(v.kind === 'sub' ? -v.amount : v.amount)}>
        <Form.Item name="kind"><Radio.Group optionType="button" buttonStyle="solid"
          options={[{ value: 'add', label: 'Thêm vào' }, { value: 'sub', label: 'Bớt đi' }]} /></Form.Item>
        <Form.Item name="amount" label={`Lượng (${material?.unit ?? ''})`} rules={[{ required: true }]}>
          <InputNumber min={0.01} step={1} style={{ width: '100%' }} autoFocus />
        </Form.Item>
        <p className="a-muted">Hiện có {num(material?.quantity ?? 0)} {material?.unit} → sau điều chỉnh <b style={{ color: after < 0 ? 'var(--ant-color-error, #ff4d4f)' : undefined }}>{num(after)} {material?.unit}</b></p>
        <Button type="primary" htmlType="submit" block loading={loading} disabled={after < 0}>Lưu</Button>
      </Form>
    </Modal>
  )
}
