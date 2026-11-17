import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
<<<<<<< HEAD
import { Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { crmApi, type CustomerClassificationConfig, type CustomerGroup, type GroupCriteria, type GroupMember } from '@/api/crm'
import { dateTime, money } from '@/lib/format'
=======
import { App, Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SyncOutlined, EyeOutlined } from '@ant-design/icons'
import { crmApi, type CriteriaRule, type CustomerGroup, type GroupType } from '@/api/crm'
import { coreApi } from '@/api/core'
import { dateTime, date, money } from '@/lib/format'
>>>>>>> main
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

<<<<<<< HEAD
type ClassificationCode = NonNullable<CustomerGroup['classificationCode']>

const ORDER: ClassificationCode[] = ['CHURN_RISK', 'REGULAR', 'POTENTIAL', 'VIP']
const TITLES: Record<ClassificationCode, string> = {
  CHURN_RISK: 'Khách hàng nguy cơ rời bỏ',
  REGULAR: 'Khách hàng thường',
  POTENTIAL: 'Khách hàng tiềm năng',
  VIP: 'Khách hàng VIP',
}
const CRITERIA: Record<GroupCriteria, { label: string; field: string; unit: string }> = {
  SPENDING: { label: 'Theo tổng chi tiêu', field: 'minTotalSpent', unit: 'đ' },
  FREQUENCY: { label: 'Theo số đơn hàng', field: 'minOrdersPerMonth', unit: 'đơn/tháng' },
  RECENCY: { label: 'Theo thời gian chưa mua', field: 'inactiveDays', unit: 'ngày' },
  FAVORITE_COFFEE: { label: 'Theo cà phê yêu thích', field: 'favoriteCoffeeId', unit: 'ID cà phê' },
  MANUAL: { label: 'Thêm thành viên thủ công', field: '', unit: '' },
}

function codeOf(group: CustomerGroup): ClassificationCode | undefined {
  if (group.classificationCode) return group.classificationCode
  // Compatibility with data created before classificationCode was added.
  const name = group.name.toLocaleLowerCase('vi')
  if (name.includes('nguy cơ rời bỏ')) return 'CHURN_RISK'
  if (name === 'khách hàng thường') return 'REGULAR'
  if (name === 'khách hàng tiềm năng') return 'POTENTIAL'
  if (name === 'khách hàng vip') return 'VIP'
  return undefined
=======
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
>>>>>>> main
}

export function GroupsPage() {
  const { message } = App.useApp()
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-groups'], queryFn: crmApi.groups, retry: false })
<<<<<<< HEAD
  const configQuery = useQuery({ queryKey: ['crm-classification-config'], queryFn: crmApi.classificationConfig, retry: false })
  const configSave = useAction(crmApi.saveClassificationConfig, [['crm-classification-config'], ['crm-groups'], ['crm-customers']], 'Đã lưu tiêu chí và tính lại phân loại')
  const recalc = useAction(crmApi.recalculate, [['crm-groups'], ['crm-customers']], 'Đã tính lại nhóm')
  const [members, setMembers] = useState<CustomerGroup | null>(null)
  const [preview, setPreview] = useState<CustomerGroup | null>(null)
  const [groupEdit, setGroupEdit] = useState<Partial<CustomerGroup> | null>(null)
  const [groupForm] = Form.useForm()
  const groupType = Form.useWatch('groupType', groupForm) as 'AUTOMATIC' | 'MANUAL' | undefined
  const fixedCode = groupEdit?.classificationCode ?? (groupEdit?.id && groupEdit.name ? codeOf(groupEdit as CustomerGroup) : undefined)
  const groupSave = useAction(crmApi.saveGroup, [['crm-groups']], 'Đã lưu nhóm')
  const groupDelete = useAction(crmApi.deleteGroup, [['crm-groups']], 'Đã xóa nhóm')

  const groups = data
    .map((group) => ({ group, code: codeOf(group) }))
    .filter((item): item is { group: CustomerGroup; code: ClassificationCode } => !!item.code)
    .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code))

  const description = (code: ClassificationCode, config?: CustomerClassificationConfig) => {
    if (!config) return code === 'CHURN_RISK' ? 'Ưu tiên xếp nhóm này theo ngày mua gần nhất.' : 'Đang tải tiêu chí phân loại…'
    if (code === 'CHURN_RISK') return `Đã mua trước đây nhưng ${config.inactiveDays} ngày qua không có đơn thành công.`
    if (code === 'REGULAR') return `Tổng chi tiêu dưới ${money(config.potentialSpendMin)}.`
    if (code === 'POTENTIAL') return `Tổng chi tiêu từ ${money(config.potentialSpendMin)} đến dưới ${money(config.vipSpendMin)}.`
    return `Tổng chi tiêu từ ${money(config.vipSpendMin)} trở lên.`
  }

  const openGroupForm = (group?: CustomerGroup) => {
    groupForm.resetFields()
    if (group) {
      const criterion = group.criteriaType
      groupForm.setFieldsValue({
        name: group.name,
        description: group.description,
        groupType: criterion === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC',
        ...group.criteriaRule,
      })
      setGroupEdit(group)
    } else {
      groupForm.setFieldsValue({ groupType: 'AUTOMATIC' })
      setGroupEdit({ criteriaType: 'SPENDING' })
    }
  }

  const closeGroupForm = () => {
    setGroupEdit(null)
    groupForm.resetFields()
  }

  return (
    <>
      <PageHeader title="Nhóm khách hàng" subtitle="Tạo nhóm theo tiêu chí, xem trước thành viên và tính lại khi cần"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openGroupForm()}>Tạo nhóm khách hàng</Button>} />
=======
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
>>>>>>> main
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <p className="a-muted" style={{ marginBottom: 16 }}>
          Tiêu chí được chỉnh ngay trên từng nhóm. Hệ thống ưu tiên nhóm nguy cơ rời bỏ; khách chưa từng có đơn thành công được xếp vào nhóm Thường.
        </p>
        <Row gutter={[16, 16]}>
<<<<<<< HEAD
          {data.map((group) => {
            const code = codeOf(group)
            return (
              <Col key={group.id} xs={24} md={12} xl={8}>
                <Card title={code ? TITLES[code] : group.name} extra={<Tag>{group.memberCount} khách</Tag>}
                  actions={[
                    <span key="m" onClick={() => setMembers(group)}>Thành viên</span>,
                    ...(group.criteriaType && group.criteriaType !== 'MANUAL' ? [<span key="p" onClick={() => setPreview(group)}>Xem trước</span>] : []),
                    <span key="r" onClick={() => recalc.mutate(group.id)}><SyncOutlined /> Tính lại</span>,
                    code
                      ? <span key="e" onClick={() => openGroupForm(group)}>Sửa tiêu chí</span>
                      : <span key="e" onClick={() => openGroupForm(group)}>Sửa tiêu chí</span>,
                    ...(!code ? [<Popconfirm key="d" title="Xóa nhóm này?" onConfirm={() => groupDelete.mutate(group.id)}><span>Xóa</span></Popconfirm>] : []),
                  ]}>
                  <p className="a-muted">{code ? description(code, configQuery.data) : group.description || (group.criteriaType ? CRITERIA[group.criteriaType].label : '')}</p>
                  <Tag color={code ? 'blue' : 'default'}>{code ? 'Phân loại hệ thống' : group.criteriaType ? CRITERIA[group.criteriaType].label : 'Nhóm tùy chỉnh'}</Tag>
                  <div className="a-muted small">Tính lại: {dateTime(group.recalculatedAt)}</div>
                </Card>
              </Col>
            )
          })}
=======
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
>>>>>>> main
        </Row>
        {!configQuery.isLoading && groups.length < 4 && <p className="a-muted">Chưa tìm thấy đủ bốn nhóm hệ thống. Hãy chạy migration CRM phân loại nhóm để khởi tạo nhóm còn thiếu.</p>}
      </ServiceGate>
<<<<<<< HEAD

      <Modal open={!!groupEdit} width={860} title={groupEdit?.id ? `Sửa tiêu chí nhóm: ${groupEdit.name}` : 'Tạo nhóm khách hàng'} footer={null} onCancel={closeGroupForm} destroyOnHidden>
        <Form form={groupForm} onFinish={(values) => {
          const rule = {
            minTotalSpent: values.minTotalSpent,
            maxTotalSpent: values.maxTotalSpent,
            minOrdersPerMonth: values.minOrdersPerMonth,
            inactiveDays: values.inactiveDays,
            favoriteCategoryId: values.favoriteCategoryId,
            favoriteCoffeeId: values.favoriteCoffeeId,
          }
          const hasCriteria = Object.values(rule).some((value) => value !== undefined && value !== null && value !== '')
          if (values.groupType === 'AUTOMATIC' && !hasCriteria) {
            groupForm.setFields([{ name: 'minTotalSpent', errors: ['Nhóm tự động cần có ít nhất một tiêu chí'] }])
            return
          }
          if (values.groupType === 'AUTOMATIC' && rule.minTotalSpent != null && rule.maxTotalSpent != null && rule.minTotalSpent > rule.maxTotalSpent) {
            groupForm.setFields([{ name: 'maxTotalSpent', errors: ['Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu'] }])
            return
          }
          if (fixedCode) {
            if (!configQuery.data) return
            const nextConfig = { ...configQuery.data }
            if (fixedCode === 'REGULAR') nextConfig.potentialSpendMin = values.maxTotalSpent
            if (fixedCode === 'POTENTIAL') {
              nextConfig.potentialSpendMin = values.minTotalSpent
              nextConfig.vipSpendMin = values.maxTotalSpent
            }
            if (fixedCode === 'VIP') nextConfig.vipSpendMin = values.minTotalSpent
            if (fixedCode === 'CHURN_RISK') nextConfig.inactiveDays = values.inactiveDays
            configSave.mutate(nextConfig, { onSuccess: closeGroupForm })
            return
          }
          groupSave.mutate({
            id: groupEdit?.id,
            name: values.name,
            description: values.description,
            criteriaType: values.groupType === 'MANUAL' ? 'MANUAL' : 'SPENDING',
            criteriaRule: values.groupType === 'AUTOMATIC' ? rule : {},
          }, { onSuccess: closeGroupForm })
        }} layout="horizontal" labelCol={{ span: 9 }} wrapperCol={{ span: 15 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="Tên nhóm" rules={[{ required: true, whitespace: true, message: 'Nhập tên nhóm' }, { max: 100, message: 'Tên nhóm tối đa 100 ký tự' }]}><Input disabled={!!fixedCode} maxLength={100} showCount placeholder="Ví dụ: Khách thích Latte" /></Form.Item></Col>
            <Col span={12}><Form.Item name="groupType" label="Cách tạo nhóm" rules={[{ required: !fixedCode, message: 'Chọn cách tạo nhóm' }]}>
              <Select disabled={!!fixedCode} onChange={(value) => { if (value === 'MANUAL') groupForm.setFieldsValue({ minTotalSpent: undefined, maxTotalSpent: undefined, minOrdersPerMonth: undefined, inactiveDays: undefined, favoriteCategoryId: undefined, favoriteCoffeeId: undefined }) }} options={[{ value: 'AUTOMATIC', label: 'Tự động theo tiêu chí' }, { value: 'MANUAL', label: 'Thêm khách thủ công' }]} />
            </Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="Mô tả" labelCol={{ span: 4 }} wrapperCol={{ span: 20 }} rules={[{ max: 1000, message: 'Mô tả tối đa 1.000 ký tự' }]}><Input.TextArea disabled={!!fixedCode} rows={2} maxLength={1000} showCount /></Form.Item></Col>
          </Row>
          {groupType === 'AUTOMATIC' && <>
            <p className="a-muted">{fixedCode ? 'Chỉnh tiêu chí của nhóm này. Lưu sẽ tính lại phân loại khách hàng.' : 'Có thể kết hợp nhiều tiêu chí. Khách hàng phải thỏa mãn tất cả tiêu chí đã nhập.'}</p>
            <Row gutter={16}>
            <Col span={12}><Form.Item name="minTotalSpent" label="Chi tiêu tối thiểu (đ)" rules={[{ required: !!fixedCode && fixedCode !== 'REGULAR' && fixedCode !== 'CHURN_RISK', message: 'Nhập mức tối thiểu' }, { type: 'number', min: 0, message: 'Chi tiêu không được âm' }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="maxTotalSpent" label="Chi tiêu tối đa (đ)" dependencies={['minTotalSpent']} rules={[
              { required: !!fixedCode && fixedCode !== 'VIP' && fixedCode !== 'CHURN_RISK', message: 'Nhập mức tối đa' },
              { type: 'number', min: 0, message: 'Chi tiêu không được âm' },
              ({ getFieldValue }) => ({ validator(_, value) {
                const min = getFieldValue('minTotalSpent')
                if (value != null && min != null && value < min) return Promise.reject(new Error('Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu'))
                if (fixedCode === 'REGULAR' && value != null && configQuery.data && value >= configQuery.data.vipSpendMin) return Promise.reject(new Error('Mức nhóm Thường phải thấp hơn mức VIP'))
                if (fixedCode === 'POTENTIAL' && value != null && configQuery.data && value <= configQuery.data.potentialSpendMin) return Promise.reject(new Error('Mức VIP phải lớn hơn mức Tiềm năng'))
                return Promise.resolve()
              } }),
            ]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="inactiveDays" label="Không mua trong ít nhất (ngày)" rules={[{ type: 'number', min: 1, max: 3650, message: 'Nhập từ 1 đến 3650 ngày' }]}><InputNumber min={1} max={3650} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="minOrdersPerMonth" label="Số đơn thành công tối thiểu" rules={[{ type: 'number', min: 1, message: 'Số đơn phải lớn hơn 0' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="favoriteCategoryId" label="ID danh mục yêu thích" rules={[{ type: 'number', min: 1, message: 'ID phải lớn hơn 0' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="favoriteCoffeeId" label="ID cà phê yêu thích" rules={[{ type: 'number', min: 1, message: 'ID phải lớn hơn 0' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </>}
          <Button type="primary" htmlType="submit" block loading={groupSave.isPending || configSave.isPending}>{fixedCode ? 'Lưu tiêu chí' : 'Lưu nhóm'}</Button>
        </Form>
      </Modal>
      <GroupMembersDrawer group={members} onClose={() => setMembers(null)} />
      <GroupPreviewDrawer group={preview} onClose={() => setPreview(null)} />
=======
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
>>>>>>> main
    </>
  )
}

<<<<<<< HEAD
function GroupPreviewDrawer({ group, onClose }: { group: CustomerGroup | null; onClose: () => void }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['crm-group-preview', group?.id], queryFn: () => crmApi.previewGroup(group!.id), enabled: !!group, retry: false,
  })
  return (
    <Drawer open={!!group} onClose={onClose} width={620} title={`Xem trước thành viên · ${group?.name ?? ''}`}>
      <p className="a-muted">Danh sách khách hiện khớp tiêu chí. Chọn “Tính lại” để cập nhật thành viên chính thức.</p>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" size="small" dataSource={data} pagination={{ pageSize: 10 }}
          columns={[{ title: 'ID', dataIndex: 'id' }, { title: 'Khách hàng', dataIndex: 'fullName', render: (v) => v || 'Chưa có tên' }, { title: 'Điện thoại', dataIndex: 'phone' }]} />
      </ServiceGate>
    </Drawer>
=======
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
>>>>>>> main
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
<<<<<<< HEAD
  const [customerSearch, setCustomerSearch] = useState('')
  const canEditMembers = !!group && !codeOf(group)
  const customers = useQuery({
    queryKey: ['crm-customer-options', customerSearch], queryFn: () => crmApi.customers(customerSearch || undefined),
    enabled: canEditMembers, refetchOnMount: 'always', refetchOnWindowFocus: true,
  })
  const add = useAction((id: number) => crmApi.addMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã thêm khách vào nhóm')
  const remove = useAction((id: number) => crmApi.removeMember(group!.id, id), [['crm-members', group?.id], ['crm-groups']], 'Đã xóa khách khỏi nhóm')
  const exportMembers = useAction(() => crmApi.exportGroupMembers(group!.id), [], '')
  return (
    <Drawer open={!!group} onClose={onClose} width={620} title={`Thành viên · ${group?.name ?? ''}`}>
      <Button style={{ marginBottom: 12 }} loading={exportMembers.isPending} onClick={() => exportMembers.mutate()}>Xuất CSV danh sách nhóm</Button>
      {canEditMembers ? (
        <Space style={{ marginBottom: 12 }}>
          <Select showSearch filterOption={false} onSearch={setCustomerSearch} loading={customers.isFetching}
            placeholder="Tìm khách theo tên hoặc số điện thoại" style={{ width: 320 }} allowClear
            value={customerId ?? undefined} onChange={(value) => setCustomerId(value ?? null)}
            options={(customers.data ?? []).map((customer) => ({ value: customer.id, label: `#${customer.id} · ${customer.fullName || 'Chưa có tên'} · ${customer.phone}` }))} />
          <Button disabled={!customerId} loading={add.isPending} onClick={() => customerId && add.mutate(customerId)}>Thêm thành viên</Button>
        </Space>
      ) : <p className="a-muted">Thành viên do hệ thống tự phân loại theo tiêu chí của nhóm.</p>}
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table<GroupMember> rowKey="customerId" size="small" dataSource={data} pagination={{ pageSize: 10 }}
          columns={[
            { title: 'ID khách hàng', dataIndex: 'customerId' },
            { title: 'Tên khách hàng', dataIndex: 'customerName', render: (name?: string) => name || 'Chưa có tên' },
            { title: 'Số điện thoại', dataIndex: 'customerPhone', render: (phone?: string) => phone || '—' },
            { title: 'Cách thêm', render: (_, c) => c.isManual ? 'Thủ công' : 'Theo tiêu chí' },
            { title: 'Ngày thêm', dataIndex: 'addedAt', render: dateTime },
            { title: '', render: (_, member) => canEditMembers ? <Button size="small" danger loading={remove.isPending} onClick={() => remove.mutate(member.customerId)}>Xóa</Button> : null },
=======
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
>>>>>>> main
          ]} />
      </ServiceGate>
    </Drawer>
  )
}
