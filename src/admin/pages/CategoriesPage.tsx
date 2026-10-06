import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { coreApi, type CategoryPayload } from '@/api/core'
import type { Category } from '@/api/types'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

export function CategoriesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: coreApi.categories })
  const canEdit = usePerm().can(P.MENU_EDIT)
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const save = useAction((v: CategoryPayload & { id?: number }) => (v.id ? coreApi.updateCategory(v.id, v) : coreApi.createCategory(v)), [['categories'], ['menu']])
  const del = useAction(coreApi.deleteCategory, [['categories']], 'Đã xóa')

  return (
    <>
      <PageHeader title="Danh mục cà phê" extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Thêm danh mục</Button>} />
      <Table rowKey="id" loading={isLoading} dataSource={data} pagination={false}
        columns={[
          { title: 'Thứ tự', dataIndex: 'displayOrder', width: 80 },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Mô tả', dataIndex: 'description' },
          {
            title: '', width: 140, render: (_, c) => canEdit && (
              <Space>
                <Button size="small" onClick={() => setEdit(c)}>Sửa</Button>
                <Popconfirm title="Xóa danh mục?" onConfirm={() => del.mutate(c.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa danh mục' : 'Thêm danh mục'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ displayOrder: data.length + 1, ...edit }} onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="displayOrder" label="Thứ tự hiển thị"><InputNumber min={0} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
