import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { coreApi, type MaterialPayload } from '@/api/core'
import type { Material } from '@/api/types'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { UsedInCell } from '../components/UsedInCell'

const UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'gói', 'hộp', 'chai']

/** Nguyên liệu: just a name + unit; how much goes in a cup is set on each coffee's recipe. */
export function MaterialsPage() {
  const canEdit = usePerm().can(P.MATERIALS_EDIT)
  const { data = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = data.filter((m) => !q || m.name.toLowerCase().includes(q))
  const [edit, setEdit] = useState<Partial<Material> | null>(null)
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), [['materials'], ['recipes']])
  const del = useAction(coreApi.deleteMaterial, [['materials']], 'Đã xóa')

  return (
    <>
      <PageHeader title="Nguyên liệu" subtitle="Định lượng mỗi ly được khai báo trong công thức của từng món"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Thêm nguyên liệu</Button>} />
      <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm nguyên liệu" style={{ maxWidth: 320, marginBottom: 12 }}
        value={search} onChange={(e) => setSearch(e.target.value)} />
      <Table rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          { title: 'Tên', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
          { title: 'Đơn vị tính', dataIndex: 'unit', width: 120 },
          { title: 'Dùng trong', render: (_, m) => <UsedInCell material={m} /> },
          {
            title: '', width: 140, render: (_, m) => canEdit && (
              <Space>
                <Button size="small" onClick={() => setEdit(m)}>Sửa</Button>
                <Popconfirm title="Xóa nguyên liệu?" onConfirm={() => del.mutate(m.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ name: edit?.name, unit: edit?.unit }}
          onFinish={(v: MaterialPayload) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
