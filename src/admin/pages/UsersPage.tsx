import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { coreApi, type UserPayload } from '@/api/core'
import { authApi } from '@/api/auth'
import type { User } from '@/api/types'
import { dateTime } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/perm'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

/** Tài khoản đăng nhập: gán role (Quản lý / Nhân viên / Khách hàng) và liên kết hồ sơ nhân viên / khách hàng. */
export function UsersPage() {
  const me = useAuthStore((s) => s.user)
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: coreApi.users })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: authApi.roles })
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: coreApi.staff })
  const [filter, setFilter] = useState<string>('ALL')
  const [edit, setEdit] = useState<Partial<User> | null>(null)
  const [form] = Form.useForm()
  const selectedRoles = (Form.useWatch('roles', form) as string[] | undefined) ?? []
  const save = useAction((v: UserPayload & { id?: number }) => (v.id ? coreApi.updateUser(v.id, v) : coreApi.createUser(v)), [['users'], ['roles']])
  const del = useAction(coreApi.deleteUser, [['users'], ['roles']], 'Đã xóa')

  const rows = data.filter((u) => filter === 'ALL' || (u.roles as string[]).includes(filter))
  const linkedStaff = new Set(data.filter((u) => u.staffId && u.id !== edit?.id).map((u) => u.staffId))

  return (
    <>
      <PageHeader title="Tài khoản" subtitle="Mỗi tài khoản có role (Quản lý / Nhân viên / Khách hàng); quyền chi tiết của role chỉnh ở màn Phân quyền"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ roles: ['STAFF'], active: true })}>Tạo tài khoản</Button>} />
      <Segmented style={{ marginBottom: 12 }} value={filter} onChange={(v) => setFilter(v as string)}
        options={[{ value: 'ALL', label: 'Tất cả' }, ...roles.map((r) => ({ value: r.code, label: `${r.name} (${r.userCount})` }))]} />
      <Table rowKey="id" loading={isLoading} dataSource={rows}
        columns={[
          { title: 'Tên đăng nhập', dataIndex: 'username', render: (v, u) => <><b>{v}</b>{u.id === me?.id && <Tag style={{ marginLeft: 6 }}>Bạn</Tag>}</> },
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Role', render: (_, u) => u.roles.map((r) => <Tag key={r} color={ROLE_LABEL[r]?.color}>{ROLE_LABEL[r]?.text ?? r}</Tag>) },
          { title: 'Liên kết', render: (_, u) => u.staffName ? `NV: ${u.staffName}` : u.customerId ? `KH #${u.customerId} ${u.customerName ?? ''}` : '—' },
          { title: 'Hoạt động', dataIndex: 'active', render: (a) => (a ? <Tag color="green">Bật</Tag> : <Tag>Khóa</Tag>) },
          { title: 'Đăng nhập gần nhất', dataIndex: 'lastLoginAt', render: dateTime },
          { title: 'Tạo', render: (_, u) => <span className="a-muted small">{dateTime(u.createdAt)}<br />bởi {u.createdBy}</span> },
          {
            title: '', render: (_, u) => (
              <Space>
                <Button size="small" onClick={() => setEdit(u)}>Sửa</Button>
                {u.id !== me?.id && <Popconfirm title="Xóa tài khoản?" onConfirm={() => del.mutate(u.id)}><Button size="small" danger>Xóa</Button></Popconfirm>}
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa tài khoản' : 'Tạo tài khoản'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={edit ?? {}} preserve={false}
          onFinish={(v) => save.mutate({
            ...v, id: edit?.id,
            staffId: v.roles.includes('CUSTOMER') ? undefined : v.staffId,
            customerId: v.roles.includes('CUSTOMER') ? v.customerId : undefined,
          }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]} extra="Khách hàng dùng số điện thoại">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label={edit?.id ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'} rules={[{ required: !edit?.id, min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <div className="a-grid-2">
            <Form.Item name="fullName" label="Họ tên"><Input /></Form.Item>
            <Form.Item name="phone" label="Điện thoại"><Input /></Form.Item>
          </div>
          <Form.Item name="roles" label="Role" rules={[{ required: true, message: 'Chọn role' }]}>
            <Select mode="multiple" options={roles.map((r) => ({ value: r.code, label: r.name }))} />
          </Form.Item>
          {!selectedRoles.includes('CUSTOMER') && (
            <Form.Item name="staffId" label="Hồ sơ nhân viên" extra="Thao tác của tài khoản sẽ được ghi nhận cho nhân viên này">
              <Select allowClear showSearch optionFilterProp="label"
                options={staff.filter((s) => s.workStatus !== 'RESIGNED').map((s) => ({ value: s.id, label: `${s.fullName} · ${s.position ?? ''}`, disabled: linkedStaff.has(s.id) }))} />
            </Form.Item>
          )}
          {selectedRoles.includes('CUSTOMER') && (
            <Form.Item name="customerId" label="ID hồ sơ khách hàng"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          )}
          <Form.Item name="active" label="Hoạt động" valuePropName="checked"><Switch disabled={edit?.id === me?.id} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
