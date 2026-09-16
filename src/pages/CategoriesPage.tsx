import { useState } from 'react'
import { Table, Button, Typography, Space, Modal, Form, Input, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryPayload,
} from '@/api/categories'
import type { Category } from '@/types'

const { Title } = Typography

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form] = Form.useForm<CategoryPayload>()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] })

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      message.success('Category created')
      invalidate()
      setModalOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryPayload }) => updateCategory(id, payload),
    onSuccess: () => {
      message.success('Category updated')
      invalidate()
      setModalOpen(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success('Category deleted')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (record: Category) => {
    setEditing(record)
    form.setFieldsValue({ name: record.name, description: record.description })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: values })
    } else {
      createMutation.mutate(values)
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Categories</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New category
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Description', dataIndex: 'description' },
          {
            title: 'Actions',
            key: 'actions',
            width: 140,
            render: (_, record: Category) => (
              <Space>
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                <Popconfirm
                  title="Delete this category?"
                  onConfirm={() => deleteMutation.mutate(record.id)}
                >
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit category' : 'New category'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
