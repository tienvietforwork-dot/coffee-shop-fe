import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { crmApi, type CustomerGroup, type GroupCriteria } from '@/api/crm'
import { dateTime, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const CRITERIA: Record<GroupCriteria, { label: string; field: string; unit: string }> = {
  SPENDING: { label: 'Theo mức chi tiêu', field: 'minTotalSpent', unit: 'đ' },
  FREQUENCY: { label: 'Theo tần suất mua', field: 'minOrdersPerMonth', unit: 'đơn/tháng' },
  RECENCY: { label: 'Theo lần mua gần nhất', field: 'maxDaysSinceLastOrder', unit: 'ngày' },
  FAVORITE_COFFEE: { label: 'Theo sở thích cà phê', field: 'coffeeName', unit: '' },
  MANUAL: { label: 'Thủ công', field: '', unit: '' },
}

export function GroupsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-groups'], queryFn: crmApi.groups, retry: false })
  const [edit, setEdit] = useState<Partial<CustomerGroup> | null>(null)
  const [members, setMembers] = useState<CustomerGroup | null>(null)
  const save = useAction(crmApi.saveGroup, [['crm-groups']])
  const del = useAction(crmApi.deleteGroup, [['crm-groups']], 'Đã xóa')
  const recalc = useAction(crmApi.recalculate, [['crm-groups']], 'Đã tính lại nhóm')
  const [form] = Form.useForm()
  const type = Form.useWatch('criteriaType', form) as GroupCriteria | undefined

  return (
    <>
      <PageHeader title="Nhóm khách hàng" subtitle="Phân nhóm theo RFM: chi tiêu, tần suất, thời gian mua gần nhất, sở thích"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ criteriaType: 'SPENDING' })}>Tạo nhóm</Button>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Row gutter={[16, 16]}>
          {data.map((g) => (
            <Col key={g.id} xs={24} md={12} xl={8}>
              <Card title={g.name} extra={<Tag>{g.memberCount} khách</Tag>}
                actions={[
                  <span key="m" onClick={() => setMembers(g)}>Thành viên</span>,
                  <span key="r" onClick={() => recalc.mutate(g.id)}><SyncOutlined /> Tính lại</span>,
                  <span key="e" onClick={() => setEdit(g)}>Sửa</span>,
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
      <Modal open={!!edit} title={edit?.id ? 'Sửa nhóm' : 'Tạo nhóm khách hàng'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ ...edit, value: edit?.criteriaType && edit.criteriaRule ? edit.criteriaRule[CRITERIA[edit.criteriaType].field] : undefined }}
          onFinish={(v) => save.mutate({
            id: edit?.id, name: v.name, description: v.description, criteriaType: v.criteriaType,
            criteriaRule: v.criteriaType && v.criteriaType !== 'MANUAL' ? { [CRITERIA[v.criteriaType as GroupCriteria].field]: v.value } : {},
          }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true }]}><Input placeholder="VIP, Tiềm năng, Nguy cơ rời bỏ…" /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="criteriaType" label="Tiêu chí"><Select options={Object.entries(CRITERIA).map(([value, c]) => ({ value, label: c.label }))} /></Form.Item>
          {type && type !== 'MANUAL' && (
            <Form.Item name="value" label={`Ngưỡng ${CRITERIA[type].unit && `(${CRITERIA[type].unit})`}`} rules={[{ required: true }]}>
              {type === 'FAVORITE_COFFEE' ? <Input /> : <InputNumber min={0} style={{ width: '100%' }} />}
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <GroupMembersDrawer group={members} onClose={() => setMembers(null)} />
    </>
  )
}

function GroupMembersDrawer({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-members', group?.id], queryFn: () => crmApi.groupMembers(group!.id), enabled: !!group, retry: false })
  const [customerId, setCustomerId] = useState<number | null>(null)
  const add = useAction((id: number) => crmApi.addMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã thêm')
  const remove = useAction((id: number) => crmApi.removeMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã xóa khỏi nhóm')
  return (
    <Drawer open={!!group} onClose={onClose} width={620} title={`Thành viên · ${group?.name ?? ''}`}>
      <Space style={{ marginBottom: 12 }}>
        <InputNumber placeholder="ID khách hàng" min={1} value={customerId} onChange={setCustomerId} />
        <Button disabled={!customerId} onClick={() => add.mutate(customerId!)}>Thêm thủ công</Button>
      </Space>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" size="small" dataSource={data}
          columns={[
            { title: 'Khách hàng', render: (_, c) => <>{c.fullName}<div className="a-muted">{c.phone}</div></> },
            { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money },
            { title: 'Số đơn', dataIndex: 'orderCount' },
            { title: '', render: (_, c) => <Button size="small" danger onClick={() => remove.mutate(c.id)}>Xóa</Button> },
          ]} />
      </ServiceGate>
    </Drawer>
  )
}
