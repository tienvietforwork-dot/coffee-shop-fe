import { useState } from 'react'
import {
  Table,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
  Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '@/api/users'
import type { User } from '@/types'

const { Title } = Typography

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'SHIPPER', label: 'Shipper' },
]

export function UsersPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form] = Form.useForm<CreateUserPayload>()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      message.success('User created')
      invalidate()
      setModalOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) => updateUser(id, payload),
    onSuccess: () => {
      message.success('User updated')
      invalidate()
      setModalOpen(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      message.success('User deleted')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ active: true, role: 'STAFF' })
    setModalOpen(true)
  }
  const openEdit = (record: User) => {
    setEditing(record)
    form.setFieldsValue({ ...record, password: undefined } as any)
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
        <Title level={3} style={{ margin: 0 }}>Users</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New user
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Username', dataIndex: 'username' },
          { title: 'Full name', dataIndex: 'fullName' },
          { title: 'Email', dataIndex: 'email', render: (v) => v ?? '—' },
          { title: 'Phone', dataIndex: 'phone', render: (v) => v ?? '—' },
          { title: 'Role', dataIndex: 'role', render: (role: string) => <Tag>{role}</Tag> },
          {
            title: 'Active',
            dataIndex: 'active',
            render: (active: boolean) => (
              <Tag color={active ? 'green' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
            ),
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 140,
            render: (_, record: User) => (
              <Space>
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                <Popconfirm title="Delete this user?" onConfirm={() => deleteMutation.mutate(record.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit user' : 'New user'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="fullName" label="Full name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'New password (leave blank to keep unchanged)' : 'Password'}
            rules={editing ? [] : [{ required: true }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
