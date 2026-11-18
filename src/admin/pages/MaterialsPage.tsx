import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
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
  const refresh = [['materials'], ['recipes'], ['coffees']]
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), refresh)
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
            title: '', width: 130, render: (_, m) => canEdit && (
              <Space>
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
    </>
  )
}

