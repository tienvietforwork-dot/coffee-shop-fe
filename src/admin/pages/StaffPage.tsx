import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi, type StaffPayload } from '@/api/core'
import type { Staff } from '@/api/types'
import { WORK_STATUS, date, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'

/** Hồ sơ nhân sự. Quyền truy cập hệ thống do tài khoản + role quyết định (màn Tài khoản / Phân quyền). */
export function StaffPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: coreApi.staff })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: coreApi.users, retry: false })
  const [edit, setEdit] = useState<Partial<Staff> | null>(null)
  const save = useAction((v: StaffPayload & { id?: number }) => (v.id ? coreApi.updateStaff(v.id, v) : coreApi.createStaff(v)), [['staff']])
  const off = useAction(coreApi.deleteStaff, [['staff']], 'Đã cho nghỉ việc')
  const loginOf = (id: number) => users.find((u) => u.staffId === id)?.username

  return (
    <>
      <PageHeader title="Nhân viên" subtitle="Hồ sơ nhân sự; tài khoản đăng nhập tạo ở màn Tài khoản"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ workStatus: 'ACTIVE' })}>Thêm nhân viên</Button>} />
      <Table rowKey="id" loading={isLoading} dataSource={data}
        columns={[
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Chức vụ', dataIndex: 'position' },
          { title: 'Điện thoại', dataIndex: 'phone' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Ngày vào làm', dataIndex: 'hireDate', render: date },
          { title: 'Tài khoản', render: (_, s) => (loginOf(s.id) ? <Tag>{loginOf(s.id)}</Tag> : <span className="a-muted">—</span>) },
          { title: 'Trạng thái', render: (_, s) => <StatusTag label={WORK_STATUS[s.workStatus]} /> },
          {
            title: '', render: (_, s) => (
              <Space>
                <Button size="small" onClick={() => setEdit(s)}>Sửa</Button>
                {s.workStatus !== 'RESIGNED' && <Popconfirm title="Cho nhân viên nghỉ việc?" onConfirm={() => off.mutate(s.id)}><Button size="small" danger>Nghỉ việc</Button></Popconfirm>}
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa nhân viên' : 'Thêm nhân viên'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ ...edit, hireDate: edit?.hireDate ? dayjs(edit.hireDate) : undefined }}
          onFinish={(v) => save.mutate({ ...v, hireDate: v.hireDate?.format('YYYY-MM-DD'), id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="phone" label="Điện thoại" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
            <Form.Item name="position" label="Chức vụ"><Input placeholder="Barista, Thu ngân…" /></Form.Item>
            <Form.Item name="hireDate" label="Ngày vào làm"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          </div>
          <Form.Item name="workStatus" label="Trạng thái"><Select options={options(WORK_STATUS)} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
