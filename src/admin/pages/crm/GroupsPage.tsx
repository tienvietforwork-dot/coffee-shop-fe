import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SyncOutlined, EyeOutlined } from '@ant-design/icons'
import { crmApi, type CriteriaRule, type CustomerGroup, type GroupType } from '@/api/crm'
import { coreApi } from '@/api/core'
import { dateTime, date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

const TYPE: Record<GroupType, { t: string; c: string }> = { AUTOMATIC: { t: 'Tự động', c: 'blue' }, MANUAL: { t: 'Thủ công', c: 'default' } }

function useMenuNames() {
  const coffees = useQuery({ queryKey: ['coffees'], queryFn: coreApi.coffees, staleTime: 300_000 })
  const categories = useQuery({ queryKey: ['categories'], queryFn: coreApi.categories, staleTime: 300_000 })
  return { coffees: coffees.data ?? [], categories: categories.data ?? [] }
}

function criteriaText(r: CriteriaRule | null | undefined, names: ReturnType<typeof useMenuNames>): string[] {
  if (!r) return []
  const out: string[] = []
  if (r.minSpend != null) out.push(`Chi tiêu ≥ ${money(r.minSpend)}`)
  if (r.maxSpend != null) out.push(`Chi tiêu ≤ ${money(r.maxSpend)}`)
  if (r.minOrders != null) out.push(`≥ ${r.minOrders} đơn`)
  if (r.inactiveDays != null) out.push(`≥ ${r.inactiveDays} ngày chưa mua`)
  if (r.favoriteCoffeeId != null) out.push(`Thích: ${names.coffees.find((c) => c.id === r.favoriteCoffeeId)?.name ?? `cà phê #${r.favoriteCoffeeId}`}`)
  if (r.favoriteCategoryId != null) out.push(`Danh mục: ${names.categories.find((c) => c.id === r.favoriteCategoryId)?.name ?? `#${r.favoriteCategoryId}`}`)
  return out
}

export function GroupsPage() {
  const { message } = App.useApp()
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-groups'], queryFn: crmApi.groups, retry: false })
  const names = useMenuNames()
  const [edit, setEdit] = useState<Partial<CustomerGroup> | null>(null)
  const [members, setMembers] = useState<CustomerGroup | null>(null)
  const [preview, setPreview] = useState<CustomerGroup | null>(null)
  const save = useAction(
    (v: { id?: number; name: string; description?: string; groupType: GroupType; criteriaRule?: CriteriaRule }) => {
      const body = { name: v.name, description: v.description, groupType: v.groupType, criteriaRule: v.groupType === 'AUTOMATIC' ? v.criteriaRule : undefined }
      return v.id ? crmApi.updateGroup(v.id, body) : crmApi.createGroup(body)
    },
    [['crm-groups']],
  )
  const del = useAction(crmApi.deleteGroup, [['crm-groups']], 'Đã xóa')
  const evaluate = useAction(crmApi.evaluateGroup, [['crm-groups'], ['crm-members'], ['crm-customers']], '')
  const [form] = Form.useForm()
  const type = Form.useWatch('groupType', form) as GroupType | undefined

  return (
    <>
      <PageHeader title="Nhóm khách hàng" subtitle="Phân nhóm thủ công hoặc tự động theo chi tiêu, số đơn, thời gian chưa mua, sở thích"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ groupType: 'AUTOMATIC' })}>Tạo nhóm</Button>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Row gutter={[16, 16]}>
          {data.map((g) => (
            <Col key={g.id} xs={24} md={12} xl={8}>
              <Card title={g.name} extra={<Tag color={TYPE[g.groupType]?.c}>{TYPE[g.groupType]?.t ?? g.groupType}</Tag>}
                actions={[
                  <span key="m" onClick={() => setMembers(g)}>Thành viên</span>,
                  ...(g.groupType === 'AUTOMATIC' ? [
                    <span key="p" onClick={() => setPreview(g)}><EyeOutlined /> Xem trước</span>,
                    <span key="r" onClick={() => evaluate.mutate(g.id, { onSuccess: (r) => message.success(`Đã tính lại: ${r.matchedCustomers} khách khớp tiêu chí`) })}><SyncOutlined /> Tính lại</span>,
                  ] : []),
                  <span key="e" onClick={() => setEdit(g)}>Sửa</span>,
                  <Popconfirm key="d" title="Xóa nhóm?" onConfirm={() => del.mutate(g.id)}><span>Xóa</span></Popconfirm>,
                ]}>
                {g.description && <p className="a-muted">{g.description}</p>}
                {criteriaText(g.criteriaRule, names).map((t) => <Tag key={t} color="blue">{t}</Tag>)}
                {g.groupType === 'AUTOMATIC' && <div className="a-muted small">Tính lại: {dateTime(g.recalculatedAt)}</div>}
              </Card>
            </Col>
          ))}
        </Row>
      </ServiceGate>
      <Modal open={!!edit} title={edit?.id ? 'Sửa nhóm' : 'Tạo nhóm khách hàng'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ ...edit, criteriaRule: edit?.criteriaRule ?? {} }}
          onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true }]}><Input maxLength={100} placeholder="VIP, Tiềm năng, Nguy cơ rời bỏ…" /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="groupType" label="Loại nhóm" rules={[{ required: true }]}>
            <Segmented options={[{ value: 'AUTOMATIC', label: 'Tự động theo tiêu chí' }, { value: 'MANUAL', label: 'Thủ công' }]} />
          </Form.Item>
          {type === 'AUTOMATIC' && (
            <>
              <p className="a-muted small">Khách phải khớp tất cả tiêu chí đã nhập (bỏ trống = không xét).</p>
              <div className="a-grid-2">
                <Form.Item name={['criteriaRule', 'minSpend']} label="Chi tiêu tối thiểu (đ)"><InputNumber min={0} step={50000} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name={['criteriaRule', 'maxSpend']} label="Chi tiêu tối đa (đ)"><InputNumber min={0} step={50000} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name={['criteriaRule', 'minOrders']} label="Số đơn tối thiểu"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name={['criteriaRule', 'inactiveDays']} label="Số ngày chưa mua (≥)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name={['criteriaRule', 'favoriteCoffeeId']} label="Cà phê yêu thích">
                  <Select allowClear showSearch optionFilterProp="label" options={names.coffees.map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
                <Form.Item name={['criteriaRule', 'favoriteCategoryId']} label="Danh mục yêu thích">
                  <Select allowClear showSearch optionFilterProp="label" options={names.categories.map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
              </div>
            </>
          )}
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <GroupMembersDrawer group={members} onClose={() => setMembers(null)} />
      <GroupPreviewModal group={preview} onClose={() => setPreview(null)} />
    </>
  )
}

function GroupPreviewModal({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-preview', group?.id], queryFn: () => crmApi.previewGroup(group!.id), enabled: !!group, retry: false })
  return (
    <Modal open={!!group} title={`Xem trước · ${group?.name ?? ''}`} footer={null} onCancel={onClose} width={640} destroyOnHidden>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <p className="a-muted">{data.length} khách khớp tiêu chí hiện tại (chưa cập nhật vào nhóm — bấm "Tính lại" để áp dụng).</p>
        <Table rowKey="id" size="small" dataSource={data} pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Khách hàng', render: (_, c) => <>{c.fullName || 'Chưa có tên'}<div className="a-muted">{c.phone}</div></> },
            { title: 'Điểm', dataIndex: 'loyaltyPoints' },
            { title: 'Đăng ký', dataIndex: 'registeredAt', render: date },
          ]} />
      </ServiceGate>
    </Modal>
  )
}

function GroupMembersDrawer({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-members', group?.id], queryFn: () => crmApi.groupMembers(group!.id), enabled: !!group, retry: false })
  // Member rows carry only customerId; resolve names from the customer list (first 100 profiles).
  const lookup = useQuery({ queryKey: ['crm-customers', 'lookup'], queryFn: () => crmApi.customers({ size: 100 }), enabled: !!group, retry: false })
  const byId = useMemo(() => new Map((lookup.data?.content ?? []).map((c) => [c.id, c])), [lookup.data])
  const [search, setSearch] = useState('')
  const found = useQuery({ queryKey: ['crm-customers', 'search', search], queryFn: () => crmApi.customers({ q: search, size: 20 }), enabled: !!group && search.length >= 2, retry: false })
  const [customerId, setCustomerId] = useState<number | null>(null)
  const keys = [['crm-members', group?.id], ['crm-customers']]
  const add = useAction((id: number) => crmApi.addMember(group!.id, id), keys, 'Đã thêm')
  const remove = useAction((id: number) => crmApi.removeMember(group!.id, id), keys, 'Đã loại khỏi nhóm')
  const active = data.filter((m) => !m.isExcluded)

  return (
    <Drawer open={!!group} onClose={onClose} width={640} title={`Thành viên · ${group?.name ?? ''} (${active.length})`}>
      <Space style={{ marginBottom: 12 }}>
        <Select showSearch placeholder="Tìm khách theo tên / SĐT" style={{ width: 300 }} filterOption={false} value={customerId} onChange={setCustomerId}
          onSearch={setSearch} loading={found.isFetching} notFoundContent={search.length < 2 ? 'Nhập ít nhất 2 ký tự' : undefined}
          options={(found.data?.content ?? []).map((c) => ({ value: c.id, label: `${c.fullName || 'Chưa có tên'} · ${c.phone}` }))} />
        <Button disabled={!customerId} loading={add.isPending} onClick={() => add.mutate(customerId!, { onSuccess: () => setCustomerId(null) })}>Thêm thủ công</Button>
      </Space>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" size="small" dataSource={active}
          columns={[
            {
              title: 'Khách hàng', render: (_, m) => {
                const c = byId.get(m.customerId)
                return c ? <>{c.fullName || 'Chưa có tên'}<div className="a-muted">{c.phone}</div></> : <>Khách #{m.customerId}</>
              },
            },
            { title: 'Cách thêm', render: (_, m) => (m.isManual ? <Tag>Thủ công</Tag> : <Tag color="blue">Tự động</Tag>) },
            { title: 'Ngày vào nhóm', dataIndex: 'addedAt', render: dateTime },
            { title: '', render: (_, m) => <Popconfirm title="Loại khách khỏi nhóm?" onConfirm={() => remove.mutate(m.customerId)}><Button size="small" danger>Loại</Button></Popconfirm> },
          ]} />
      </ServiceGate>
    </Drawer>
  )
}
