import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { crmApi, type CustomerGroup, type GroupCriteria, type GroupMember } from '@/api/crm'
import { dateTime } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const CRITERIA: Record<GroupCriteria, { label: string; field: string; unit: string }> = {
  SPENDING: { label: 'Theo mức chi tiêu', field: 'minTotalSpent', unit: 'đ' },
  FREQUENCY: { label: 'Theo số đơn', field: 'minOrdersPerMonth', unit: 'đơn' },
  RECENCY: { label: 'Nguy cơ rời bỏ (số ngày chưa mua)', field: 'inactiveDays', unit: 'ngày' },
  FAVORITE_COFFEE: { label: 'Theo sở thích cà phê', field: 'favoriteCoffeeId', unit: 'ID cà phê' },
  MANUAL: { label: 'Thủ công', field: '', unit: '' },
}

export function GroupsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-groups'], queryFn: crmApi.groups, retry: false })
  const [edit, setEdit] = useState<Partial<CustomerGroup> | null>(null)
  const [members, setMembers] = useState<CustomerGroup | null>(null)
  const [preview, setPreview] = useState<CustomerGroup | null>(null)
  const save = useAction(crmApi.saveGroup, [['crm-groups']])
  const del = useAction(crmApi.deleteGroup, [['crm-groups']], 'Đã xóa')
  const recalc = useAction(crmApi.recalculate, [['crm-groups']], 'Đã tính lại nhóm')
  const [form] = Form.useForm()
  const type = Form.useWatch('criteriaType', form) as GroupCriteria | undefined

  const createGroup = () => {
    form.resetFields()
    form.setFieldsValue({ criteriaType: 'SPENDING', value: undefined })
    setEdit({ criteriaType: 'SPENDING' })
  }

  const editGroup = (group: CustomerGroup) => {
    form.resetFields()
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      criteriaType: group.criteriaType,
      value: group.criteriaType && group.criteriaType !== 'MANUAL'
        ? group.criteriaRule?.[CRITERIA[group.criteriaType].field]
        : undefined,
    })
    setEdit(group)
  }

  const closeGroupForm = () => {
    setEdit(null)
    form.resetFields()
  }

  return (
    <>
      <PageHeader title="Nhóm khách hàng" subtitle="Phân nhóm theo RFM: chi tiêu, tần suất, thời gian mua gần nhất, sở thích"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={createGroup}>Tạo nhóm</Button>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Row gutter={[16, 16]}>
          {data.map((g) => (
            <Col key={g.id} xs={24} md={12} xl={8}>
              <Card title={g.name} extra={<Tag>{g.memberCount} khách</Tag>}
                actions={[
                  <span key="m" onClick={() => setMembers(g)}>Thành viên</span>,
                  ...(g.criteriaType !== 'MANUAL' ? [<span key="p" onClick={() => setPreview(g)}>Xem trước</span>] : []),
                  <span key="r" onClick={() => recalc.mutate(g.id)}><SyncOutlined /> Tính lại</span>,
                  <span key="e" onClick={() => editGroup(g)}>Sửa</span>,
                  <Popconfirm key="d" title="Xóa nhóm?" onConfirm={() => del.mutate(g.id)}><span>Xóa</span></Popconfirm>,
                ]}>
                <p className="a-muted">{g.description}</p>
                {g.criteriaType && <Tag color="blue">{CRITERIA[g.criteriaType].label}</Tag>}
                <div className="a-muted small">Tính lại: {dateTime(g.recalculatedAt)}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </ServiceGate>
      <Modal open={!!edit} title={edit?.id ? `Sửa nhóm: ${edit.name}` : 'Tạo nhóm khách hàng'} footer={null} onCancel={closeGroupForm} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={(v) => save.mutate({
            id: edit?.id, name: v.name, description: v.description, criteriaType: v.criteriaType,
            criteriaRule: v.criteriaType && v.criteriaType !== 'MANUAL'
              ? { [CRITERIA[v.criteriaType as GroupCriteria].field]: v.value }
              : {},
          }, { onSuccess: closeGroupForm })}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true, whitespace: true, message: 'Nhập tên nhóm' }, { max: 100, message: 'Tên nhóm tối đa 100 ký tự' }]}><Input maxLength={100} showCount placeholder="VIP, Tiềm năng, Nguy cơ rời bỏ…" /></Form.Item>
          <Form.Item name="description" label="Mô tả" rules={[{ max: 10000, message: 'Mô tả tối đa 10.000 ký tự' }]}><Input.TextArea rows={2} maxLength={10000} showCount /></Form.Item>
          <Form.Item name="criteriaType" label="Tiêu chí" rules={[{ required: true, message: 'Chọn loại tiêu chí' }]}>
            <Select onChange={() => form.setFieldValue('value', undefined)} options={Object.entries(CRITERIA).map(([value, c]) => ({ value, label: c.label }))} />
          </Form.Item>
          {type && type !== 'MANUAL' && (
            <Form.Item name="value" label={type === 'RECENCY' ? 'Chưa mua ít nhất (ngày)' : `Ngưỡng ${CRITERIA[type].unit && `(${CRITERIA[type].unit})`}`} extra={type === 'RECENCY' ? 'Tính cả khách chưa từng có đơn hoàn tất. Ví dụ 90 ngày sẽ không đưa vào nhóm khách vừa mua gần đây.' : undefined} rules={[{ required: true, message: 'Nhập ngưỡng tiêu chí' }, { type: 'number', min: type === 'SPENDING' ? 0 : 1, message: type === 'SPENDING' ? 'Giá trị không được âm' : 'Giá trị phải lớn hơn 0' }]}>
              <InputNumber min={type === 'SPENDING' ? 0 : 1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <GroupMembersDrawer group={members} onClose={() => setMembers(null)} />
      <GroupPreviewDrawer group={preview} onClose={() => setPreview(null)} />
    </>
  )
}

function GroupPreviewDrawer({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['crm-group-preview', group?.id], queryFn: () => crmApi.previewGroup(group!.id), enabled: !!group, retry: false,
  })
  return (
    <Drawer open={!!group} onClose={onClose} width={620} title={`Xem trước thành viên · ${group?.name ?? ''}`}>
      <p className="a-muted">Danh sách khách hiện khớp tiêu chí. Chọn “Tính lại” trên nhóm để cập nhật thành viên chính thức.</p>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" size="small" dataSource={data} pagination={{ pageSize: 10 }}
          columns={[{ title: 'ID', dataIndex: 'id' }, { title: 'Khách hàng', dataIndex: 'fullName', render: (v) => v || 'Chưa có tên' }, { title: 'Điện thoại', dataIndex: 'phone' }]} />
      </ServiceGate>
    </Drawer>
  )
}

function GroupMembersDrawer({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-members', group?.id], queryFn: () => crmApi.groupMembers(group!.id), enabled: !!group, retry: false })
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const customers = useQuery({
    queryKey: ['crm-customer-options', customerSearch], queryFn: () => crmApi.customers(customerSearch || undefined),
    enabled: !!group, refetchOnMount: 'always', refetchOnWindowFocus: true,
  })
  const add = useAction((id: number) => crmApi.addMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã thêm')
  const remove = useAction((id: number) => crmApi.removeMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã xóa khỏi nhóm')
  return (
    <Drawer open={!!group} onClose={onClose} width={620} title={`Thành viên · ${group?.name ?? ''}`}>
      <Space style={{ marginBottom: 12 }}>
        <Select
          showSearch filterOption={false} onSearch={setCustomerSearch} loading={customers.isFetching}
          placeholder="Tìm khách theo tên hoặc số điện thoại" style={{ width: 320 }} allowClear
          value={customerId ?? undefined} onChange={(value) => setCustomerId(value ?? null)}
          options={(customers.data ?? []).map((customer) => ({ value: customer.id, label: `#${customer.id} · ${customer.fullName || 'Chưa có tên'} · ${customer.phone}` }))}
        />
        <Button disabled={!customerId} onClick={() => add.mutate(customerId!)}>Thêm thủ công</Button>
      </Space>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table<GroupMember> rowKey="customerId" size="small" dataSource={data}
          columns={[
            { title: 'ID khách hàng', dataIndex: 'customerId' },
            { title: 'Cách thêm', render: (_, c) => c.isManual ? 'Thủ công' : 'Theo tiêu chí' },
            { title: 'Ngày thêm', dataIndex: 'addedAt', render: dateTime },
            { title: '', render: (_, c) => <Button size="small" danger onClick={() => remove.mutate(c.customerId)}>Xóa</Button> },
          ]} />
      </ServiceGate>
    </Drawer>
  )
}
