import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
<<<<<<< HEAD
import { Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Timeline, Tooltip, Typography } from 'antd'
import { PlusOutlined, MergeCellsOutlined, EditOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { crmApi, type CustomerAddress, type CustomerSummary } from '@/api/crm'
=======
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Select,
  Space, Statistic, Switch, Table, Tabs, Tag, Timeline,
} from 'antd'
import { PlusOutlined, MergeCellsOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { crmApi, type Customer, type CustomerAddress, type CustomerPayload } from '@/api/crm'
>>>>>>> main
import { dateTime, date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

<<<<<<< HEAD
const ORDER_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'blue' },
  PREPARING: { label: 'Đang pha chế', color: 'purple' },
  PROCESSING: { label: 'Đang xử lý', color: 'processing' },
  READY: { label: 'Sẵn sàng', color: 'cyan' },
  SHIPPING: { label: 'Đang giao', color: 'geekblue' },
  DELIVERING: { label: 'Đang giao', color: 'geekblue' },
  COMPLETED: { label: 'Hoàn tất', color: 'success' },
  REJECTED: { label: 'Bị từ chối', color: 'default' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  FAILED: { label: 'Thất bại', color: 'default' },
  REFUNDED: { label: 'Đã hoàn tiền', color: 'default' },
}

export function CustomersPage() {
  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>()
  const [orderFilter, setOrderFilter] = useState<number | null>(null)
  const [minDaysSinceOrder, setMinDaysSinceOrder] = useState<number | null>(null)
  const [maxDaysSinceOrder, setMaxDaysSinceOrder] = useState<number | null>(null)
  const [neverPurchasedFilter, setNeverPurchasedFilter] = useState(false)
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-customers', q], queryFn: () => crmApi.customers(q || undefined), retry: false })
  const groupOptions = [...new Set(data.flatMap((customer) => customer.groups))].sort()
  const filteredCustomers = data.filter((customer) => {
    const orders = customer.orderCount ?? 0
    const orderMatches = orderFilter == null || orders === orderFilter
    const daysSinceOrder = customer.lastOrderAt ? dayjs().diff(dayjs(customer.lastOrderAt), 'day') : null
    const hasAgeRange = minDaysSinceOrder != null || maxDaysSinceOrder != null
    const activityMatches = neverPurchasedFilter ? daysSinceOrder === null : !hasAgeRange || (daysSinceOrder !== null && (minDaysSinceOrder == null || daysSinceOrder >= minDaysSinceOrder) && (maxDaysSinceOrder == null || daysSinceOrder <= maxDaysSinceOrder))
    return (!groupFilter || customer.groups.includes(groupFilter)) && orderMatches && activityMatches
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const [edit, setEdit] = useState<Partial<CustomerSummary> | null>(null)
  const [customerForm] = Form.useForm()
  const draftName = Form.useWatch('fullName', customerForm)
  const draftPhone = Form.useWatch('phone', customerForm)
  const draftEmail = Form.useWatch('email', customerForm)
  const draftBirth = Form.useWatch('dateOfBirth', customerForm)
  const draftGender = Form.useWatch('gender', customerForm)
  const [duplicateLookup, setDuplicateLookup] = useState<{ name?: string; phone?: string; email?: string }>({})
  const [compareDuplicateId, setCompareDuplicateId] = useState<number | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setDuplicateLookup({ name: draftName, phone: draftPhone, email: draftEmail }), 350)
    return () => window.clearTimeout(timer)
  }, [draftName, draftPhone, draftEmail])
  const duplicateCheck = useQuery({
    queryKey: ['crm-customer-duplicate-check', duplicateLookup],
    queryFn: async () => {
      const terms = [duplicateLookup.phone, duplicateLookup.email, duplicateLookup.name]
        .map((value) => value?.trim()).filter((value): value is string => !!value && value.length >= 3)
      if (!terms.length) return []
      const results = await Promise.all(terms.map((term) => crmApi.customers(term)))
      const normalize = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi') ?? ''
      const byId = new Map<number, CustomerSummary>()
      results.flat().forEach((customer) => byId.set(customer.id, customer))
      return [...byId.values()].filter((customer) =>
        (normalize(duplicateLookup.phone) && normalize(customer.phone) === normalize(duplicateLookup.phone)) ||
        (normalize(duplicateLookup.email) && normalize(customer.email) === normalize(duplicateLookup.email)) ||
        (normalize(duplicateLookup.name) && normalize(customer.fullName) === normalize(duplicateLookup.name)),
      )
    },
    enabled: !!edit && !edit.id && (!!duplicateLookup.phone || !!duplicateLookup.email || !!duplicateLookup.name),
    retry: false,
  })
  const duplicateLookupIsCurrent = duplicateLookup.name === draftName && duplicateLookup.phone === draftPhone && duplicateLookup.email === draftEmail
  const duplicateProfile = useQuery({
    queryKey: ['crm-customer-duplicate-compare', compareDuplicateId],
    queryFn: () => crmApi.customer360(compareDuplicateId!),
    enabled: !!compareDuplicateId,
    retry: false,
  })
  const [mergeFor, setMergeFor] = useState<number | null>(null)
  const [mergeCandidateId, setMergeCandidateId] = useState<number | null>(null)
  const [mergeForm] = Form.useForm()
  const mergeConfirmed = Form.useWatch('confirm', mergeForm)
  const primaryProfile = data.find((customer) => customer.id === mergeFor)
  const mergeCandidate = useQuery({
    queryKey: ['crm-merge-candidate', mergeCandidateId],
    queryFn: () => crmApi.customer360(mergeCandidateId!),
    enabled: !!mergeFor && !!mergeCandidateId && mergeCandidateId !== mergeFor,
    retry: false,
  })
  const isDuplicateCandidate = (candidate: CustomerSummary | undefined) => {
    if (!primaryProfile || !candidate) return false
    const normalize = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi') ?? ''
    const sameName = normalize(primaryProfile.fullName) !== '' && normalize(primaryProfile.fullName) === normalize(candidate.fullName)
    const samePhone = normalize(primaryProfile.phone) !== '' && normalize(primaryProfile.phone) === normalize(candidate.phone)
    const sameEmail = normalize(primaryProfile.email) !== ''
      && normalize(primaryProfile.email) === normalize(candidate.email)
    return sameName && (samePhone || sameEmail)
  }
  const save = useAction(crmApi.saveCustomer, [['crm-customers']])
  const merge = useAction((v: { keep: number; dup: number }) => crmApi.mergeCustomers(v.keep, v.dup), [['crm-customers']], 'Đã gộp hồ sơ')
=======
const PHONE = /^0\d{9,10}$/
const GENDERS = [{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }]
const CHANNEL: Record<string, string> = { CALL: 'Cuộc gọi', CHAT: 'Trò chuyện', EMAIL: 'Email', IN_STORE: 'Tại quán', NOTE: 'Ghi chú' }
const genderLabel = (g?: string) => GENDERS.find((x) => x.value === g)?.label ?? g ?? '—'

export function CustomersPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const { data, isLoading, error } = useQuery({
    queryKey: ['crm-customers', q, page, size], queryFn: () => crmApi.customers({ q: q || undefined, page, size }), retry: false,
  })
  const [openId, setOpenId] = useState<number | null>(null)
  const [edit, setEdit] = useState<Partial<Customer> | null>(null)
  const [mergeFor, setMergeFor] = useState<number | null>(null)
  const save = useAction(
    (v: CustomerPayload & { id?: number }) => (v.id ? crmApi.updateCustomer(v.id, v) : crmApi.createCustomer(v)),
    [['crm-customers'], ['crm-360']],
  )
  const merge = useAction((v: { keep: number; dup: number }) => crmApi.mergeCustomers(v.keep, v.dup), [['crm-customers'], ['crm-360']], 'Đã gộp hồ sơ')
>>>>>>> main

  return (
    <>
      <PageHeader title="Hồ sơ khách hàng" subtitle="Customer 360: lịch sử mua, chi tiêu, địa chỉ, nhóm, tương tác, phản hồi"
        extra={<>
<<<<<<< HEAD
          <Input.Search placeholder="Tên / SĐT" allowClear onSearch={setQ} style={{ width: 220 }} />
          <Select allowClear placeholder="Lọc theo nhóm" style={{ width: 170 }} value={groupFilter} onChange={setGroupFilter} options={groupOptions.map((name) => ({ value: name, label: name }))} />
          <InputNumber min={0} precision={0} placeholder="Số đơn chính xác" style={{ width: 145 }} value={orderFilter} onChange={setOrderFilter} />
          <InputNumber min={0} precision={0} placeholder="Mua ít nhất (ngày)" style={{ width: 155 }} value={minDaysSinceOrder} onChange={setMinDaysSinceOrder} />
          <InputNumber min={0} precision={0} placeholder="Mua nhiều nhất (ngày)" style={{ width: 165 }} value={maxDaysSinceOrder} onChange={setMaxDaysSinceOrder} />
          <Checkbox checked={neverPurchasedFilter} onChange={(event) => setNeverPurchasedFilter(event.target.checked)}>Chưa từng mua</Checkbox>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { customerForm.resetFields(); setEdit({}) }}>Tạo hồ sơ</Button>
        </>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={filteredCustomers} onRow={(c) => ({ onClick: () => setOpenId(c.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Khách hàng', render: (_, c) => <><b>{c.fullName || 'Chưa có tên'}</b><div className="a-muted">ID #{c.id} · {c.phone}</div></> },
            { title: 'Nhóm', render: (_, c) => c.groups.length === 0 ? '—' : <Space size={[0, 4]} wrap>
              {c.groups.slice(0, 2).map((g) => <Tag key={g}>{g}</Tag>)}
              {c.groups.length > 2 && <Tooltip title={c.groups.slice(2).join(' · ')}><Tag>+{c.groups.length - 2}</Tag></Tooltip>}
            </Space> },
            { title: 'Số đơn', dataIndex: 'orderCount', render: (v) => v ?? '—', sorter: (a, b) => (a.orderCount ?? 0) - (b.orderCount ?? 0) },
            { title: 'Tổng chi tiêu', dataIndex: 'totalSpent', render: (v) => v == null ? '—' : money(v), sorter: (a, b) => (a.totalSpent ?? 0) - (b.totalSpent ?? 0) },
            { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: date },
            { title: 'Điểm', dataIndex: 'loyaltyPoints', render: (v, c) => <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setOpenId(c.id) }}>{v ?? 0}</Button> },
            { title: 'Thao tác', render: (_, c) => <>
              <Button size="small" icon={<EditOutlined />} onClick={(e) => {
                e.stopPropagation()
                customerForm.resetFields()
                customerForm.setFieldsValue({ ...c, dateOfBirth: c.dateOfBirth ? dayjs(c.dateOfBirth) : undefined })
                setEdit(c)
              }}>Sửa</Button>{' '}
              <Button size="small" icon={<MergeCellsOutlined />} onClick={(e) => { e.stopPropagation(); setMergeFor(c.id) }}>Gộp</Button>
            </> },
          ]} />
      </ServiceGate>
      <Customer360Drawer id={openId} onClose={() => setOpenId(null)} />
      <Modal open={!!edit} title={edit?.id ? `Sửa hồ sơ khách hàng #${edit.id}` : 'Tạo hồ sơ khách hàng'} footer={null} onCancel={() => { setEdit(null); customerForm.resetFields() }} destroyOnHidden>
        {/* {!edit?.id && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Số điện thoại đã được dùng thì không thể tạo hồ sơ mới; hãy tìm hồ sơ cũ để cập nhật. Gộp hồ sơ chỉ dành cho dữ liệu trùng đã phát sinh từ nhập dữ liệu cũ hoặc sai thông tin, sau khi xác nhận là cùng một khách." />} */}
        <Form form={customerForm} layout="vertical" initialValues={{ ...edit, dateOfBirth: edit?.dateOfBirth ? dayjs(edit.dateOfBirth) : undefined }} onFinish={(v) => save.mutate({ ...v, dateOfBirth: v.dateOfBirth?.format('YYYY-MM-DD'), id: edit?.id }, { onSuccess: () => { setEdit(null); customerForm.resetFields() } })}>
          {!edit?.id && duplicateLookupIsCurrent && duplicateCheck.data && duplicateCheck.data.length > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Phát hiện hồ sơ có thông tin trùng"
              description={<div>
                <div>Đối chiếu các hồ sơ dưới đây trước khi tạo để tránh lưu trùng khách hàng.</div>
                <Space wrap style={{ marginTop: 8 }}>
                  {duplicateCheck.data.map((candidate) => <Button key={candidate.id} size="small" onClick={() => setCompareDuplicateId(candidate.id)}>
                    Đối chiếu #{candidate.id} · {candidate.fullName || 'Chưa có tên'} · {candidate.phone}
                  </Button>)}
                </Space>
              </div>} />
          )}
          <Form.Item name="fullName" label="Họ tên" rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập họ tên khách hàng' },
            { max: 100, message: 'Họ tên tối đa 100 ký tự' },
          ]}>
            <Input maxLength={100} showCount />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại" rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại' },
            { max: 15, message: 'Số điện thoại tối đa 15 ký tự' },
            { pattern: /^0\d{9,10}$/, message: 'Nhập số điện thoại Việt Nam gồm 10 hoặc 11 số, bắt đầu bằng 0' },
          ]}><Input maxLength={15} /></Form.Item>
          <Form.Item name="email" label="Email" rules={[
            { type: 'email', message: 'Email phải đúng định dạng, ví dụ ten@email.com' },
            { max: 100, message: 'Email tối đa 100 ký tự' },
          ]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="dateOfBirth" label="Ngày sinh" rules={[{
            validator: (_, value) => !value || value.isBefore(dayjs(), 'day')
              ? Promise.resolve()
              : Promise.reject(new Error('Ngày sinh phải trước ngày hôm nay')),
          }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(current) => !current.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="gender" label="Giới tính" rules={[{
            validator: (_, value) => !value || ['MALE', 'FEMALE', 'OTHER'].includes(value)
              ? Promise.resolve()
              : Promise.reject(new Error('Chọn Nam, Nữ hoặc Khác')),
          }]}>
            <Select allowClear options={[{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }]} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả" rules={[{
            validator: (_, value) => !value || value.length <= 10000
              ? Promise.resolve()
              : Promise.reject(new Error('Mô tả tối đa 10.000 ký tự')),
          }]}>
            <Input.TextArea rows={3} maxLength={10000} showCount />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Modal open={!!compareDuplicateId} title={`Đối chiếu hồ sơ · #${compareDuplicateId ?? ''}`} footer={<Button onClick={() => setCompareDuplicateId(null)}>Đóng</Button>} onCancel={() => setCompareDuplicateId(null)} destroyOnHidden>
        {duplicateProfile.isLoading ? <Alert type="info" showIcon message="Đang tải hồ sơ để đối chiếu…" />
          : duplicateProfile.isError || !duplicateProfile.data ? <Alert type="error" showIcon message="Không tải được hồ sơ khách hàng để đối chiếu." />
            : <Row gutter={12}>
                <Col span={12}><Card size="small" title="Hồ sơ đang nhập">
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Họ tên">{draftName || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">{draftPhone || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{draftEmail || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày sinh">{draftBirth ? dayjs(draftBirth).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                    <Descriptions.Item label="Giới tính">{draftGender || '—'}</Descriptions.Item>
                  </Descriptions>
                </Card></Col>
                <Col span={12}><Card size="small" title={`Hồ sơ hiện có · #${compareDuplicateId}`}>
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Họ tên">{duplicateProfile.data.customer.fullName || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">{duplicateProfile.data.customer.phone || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{duplicateProfile.data.customer.email || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày sinh">{duplicateProfile.data.customer.dateOfBirth ? date(duplicateProfile.data.customer.dateOfBirth) : '—'}</Descriptions.Item>
                    <Descriptions.Item label="Giới tính">{duplicateProfile.data.customer.gender || '—'}</Descriptions.Item>
                  </Descriptions>
                </Card></Col>
              </Row>}
      </Modal>
      <Modal open={!!mergeFor} title="Kiểm tra và gộp hồ sơ trùng" footer={null} onCancel={() => { setMergeFor(null); setMergeCandidateId(null); mergeForm.resetFields() }} destroyOnHidden>
        <p>Chỉ gộp khi xác nhận đây là cùng một người. Đơn hàng, điểm, địa chỉ, tương tác và phản hồi của hồ sơ thứ hai sẽ chuyển vào hồ sơ đang giữ; hồ sơ thứ hai sẽ bị xóa mềm.</p>
        <Form form={mergeForm} layout="vertical" onValuesChange={(changed, values) => {
          if (Object.hasOwn(changed, 'dup')) {
            setMergeCandidateId(values.dup ?? null)
            mergeForm.setFieldValue('confirm', false)
          }
        }} onFinish={(v) => merge.mutate({ keep: mergeFor!, dup: v.dup }, { onSuccess: () => { setMergeFor(null); setMergeCandidateId(null); mergeForm.resetFields() } })}>
          <Form.Item name="dup" label="ID hồ sơ cần kiểm tra" rules={[
            { required: true, message: 'Nhập ID hồ sơ cần gộp' },
            { type: 'number', min: 1, message: 'ID phải là số nguyên dương' },
            { validator: (_, value) => value && value === mergeFor ? Promise.reject(new Error('Không thể gộp hồ sơ với chính nó')) : Promise.resolve() },
          ]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item>
          {mergeCandidateId && mergeCandidateId !== mergeFor && (
            mergeCandidate.isLoading
              ? <Alert type="info" showIcon message="Đang tải hồ sơ để đối chiếu…" />
              : mergeCandidate.isError
                ? <Alert type="error" showIcon message="Không tìm thấy hồ sơ hoặc không có quyền xem hồ sơ này." />
                : mergeCandidate.data && <>
                    <Row gutter={12} style={{ marginBottom: 12 }}>
                      <Col span={12}><Card size="small" title={`Giữ lại · #${mergeFor}`}><b>{primaryProfile?.fullName || 'Chưa có tên'}</b><div>{primaryProfile?.phone}</div><div>{primaryProfile?.email || 'Chưa có email'}</div></Card></Col>
                      <Col span={12}><Card size="small" title={`Hồ sơ đối chiếu · #${mergeCandidateId}`}><b>{mergeCandidate.data.customer.fullName || 'Chưa có tên'}</b><div>{mergeCandidate.data.customer.phone}</div><div>{mergeCandidate.data.customer.email || 'Chưa có email'}</div></Card></Col>
                    </Row>
                    {isDuplicateCandidate(mergeCandidate.data.customer)
                      ? <>
                          <Alert type="success" showIcon style={{ marginBottom: 12 }} message="Có thông tin nhận diện trùng. Hãy đối chiếu hồ sơ để chắc chắn đây là cùng một khách." />
                          <Form.Item name="confirm" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Xác nhận đã đối chiếu đây là cùng một khách')) }]}>
                            <Checkbox>Tôi đã đối chiếu và xác nhận hai hồ sơ là cùng một khách hàng</Checkbox>
                          </Form.Item>
                        </>
                      : <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chưa đủ căn cứ: cần họ tên trùng cùng với số điện thoại hoặc email trùng. Hãy giữ riêng hai hồ sơ nếu không xác nhận được cùng một người." />}
                  </>
          )}
          <Button type="primary" danger htmlType="submit" loading={merge.isPending} disabled={!isDuplicateCandidate(mergeCandidate.data?.customer) || !mergeConfirmed}>Gộp hồ sơ đã xác nhận</Button>
=======
          <Input.Search placeholder="Tên / SĐT / email" allowClear onSearch={(v) => { setQ(v); setPage(0) }} style={{ width: 240 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Tạo hồ sơ</Button>
        </>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data?.content ?? []} onRow={(c) => ({ onClick: () => setOpenId(c.id), style: { cursor: 'pointer' } })}
          pagination={{
            current: page + 1, pageSize: size, total: data?.totalElements ?? 0, showSizeChanger: true,
            onChange: (p, s) => { setPage(p - 1); setSize(s) },
          }}
          columns={[
            { title: 'Khách hàng', render: (_, c) => <><b>{c.fullName || 'Chưa có tên'}</b><div className="a-muted">{c.phone}</div></> },
            { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
            { title: 'Nhóm', render: (_, c) => c.groups.map((g) => <Tag key={g} color="blue">{g}</Tag>) },
            { title: 'Điểm', dataIndex: 'loyaltyPoints' },
            { title: 'Đăng ký', dataIndex: 'registeredAt', render: date },
            {
              title: '', render: (_, c) => (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setEdit(c)}>Sửa</Button>
                  <Button size="small" icon={<MergeCellsOutlined />} onClick={() => setMergeFor(c.id)}>Gộp</Button>
                </Space>
              ),
            },
          ]} />
      </ServiceGate>
      <Customer360Drawer id={openId} onClose={() => setOpenId(null)} onEdit={setEdit} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa hồ sơ khách hàng' : 'Tạo hồ sơ khách hàng'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ ...edit, dateOfBirth: edit?.dateOfBirth ? dayjs(edit.dateOfBirth) : undefined }}
          onFinish={(v) => save.mutate(
            { ...v, id: edit?.id, dateOfBirth: v.dateOfBirth ? v.dateOfBirth.format('YYYY-MM-DD') : undefined },
            { onSuccess: () => setEdit(null) },
          )}>
          <div className="a-grid-2">
            <Form.Item name="fullName" label="Họ tên"><Input maxLength={100} /></Form.Item>
            <Form.Item name="phone" label="Điện thoại" rules={[{ required: true, pattern: PHONE, message: 'SĐT 10–11 số, bắt đầu bằng 0' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
            <Form.Item name="gender" label="Giới tính"><Select allowClear options={GENDERS} /></Form.Item>
            <Form.Item name="dateOfBirth" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => !d.isBefore(dayjs(), 'day')} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Ghi chú"><Input.TextArea rows={2} placeholder="Sở thích, dị ứng, lưu ý phục vụ…" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Modal open={!!mergeFor} title="Gộp hồ sơ trùng" footer={null} onCancel={() => setMergeFor(null)} destroyOnHidden>
        <p>Hồ sơ trùng sẽ được gộp (đơn hàng, điểm, địa chỉ, tương tác, phản hồi) vào hồ sơ #{mergeFor}.</p>
        <Form layout="inline" onFinish={(v) => merge.mutate({ keep: mergeFor!, dup: v.dup }, { onSuccess: () => setMergeFor(null) })}>
          <Form.Item name="dup" label="ID hồ sơ trùng" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Button type="primary" danger htmlType="submit" loading={merge.isPending}>Gộp</Button>
>>>>>>> main
        </Form>
      </Modal>
    </>
  )
}

function Customer360Drawer({ id, onClose, onEdit }: { id: number | null; onClose: () => void; onEdit: (c: Partial<Customer>) => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-360', id], queryFn: () => crmApi.customer360(id!), enabled: !!id, retry: false })
<<<<<<< HEAD
  const [addressDialog, setAddressDialog] = useState(false)
  const [addressEdit, setAddressEdit] = useState<Partial<CustomerAddress> | null>(null)
  const [addressForm] = Form.useForm()
  const history = useQuery({ queryKey: ['crm-customer-history', id], queryFn: () => crmApi.customerHistory(id!), enabled: !!id, retry: false })
  const [firstPeriod, setFirstPeriod] = useState<[Dayjs, Dayjs]>([dayjs().subtract(2, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')])
  const [secondPeriod, setSecondPeriod] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const comparison = useQuery({
    queryKey: ['crm-customer-periods', id, ...firstPeriod.map((d) => d.format('YYYY-MM-DD')), ...secondPeriod.map((d) => d.format('YYYY-MM-DD'))],
    queryFn: () => crmApi.compareCustomerPeriods(id!, firstPeriod[0].format('YYYY-MM-DD'), firstPeriod[1].format('YYYY-MM-DD'), secondPeriod[0].format('YYYY-MM-DD'), secondPeriod[1].format('YYYY-MM-DD')),
    enabled: !!id,
    retry: false,
  })
  const saveAddress = useAction((v: { address: Partial<CustomerAddress> }) => crmApi.saveCustomerAddress(id!, v.address), [['crm-360', id]], 'Đã lưu địa chỉ')
  const deleteAddress = useAction((addressId: number) => crmApi.deleteCustomerAddress(id!, addressId), [['crm-360', id]], 'Đã xóa địa chỉ')

  const openAddress = (address?: CustomerAddress) => {
    setAddressEdit(address ?? {})
    addressForm.resetFields()
    addressForm.setFieldsValue(address ?? { isDefault: false })
    setAddressDialog(true)
  }

  const closeAddress = () => {
    setAddressDialog(false)
    setAddressEdit(null)
    addressForm.resetFields()
  }

  const timelineLabel: Record<string, string> = {
    CUSTOMER_REGISTERED: 'Tạo hồ sơ', ORDER: 'Đơn hàng', INTERACTION: 'Tương tác',
    FEEDBACK: 'Phản hồi', FEEDBACK_RESPONSE: 'Đã trả lời phản hồi', VOUCHER: 'Voucher', PROMOTION_USED: 'Dùng khuyến mãi',
  }
=======
  const p = data?.profile
  const m = data?.metrics
>>>>>>> main
  return (
    <Drawer open={!!id} onClose={onClose} width={820} title={p ? `${p.fullName ?? 'Chưa có tên'} · ${p.phone}` : 'Hồ sơ khách hàng'}
      extra={p && <Button icon={<EditOutlined />} onClick={() => onEdit(p)}>Sửa hồ sơ</Button>}>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        {data && p && m && (
          <>
            <Row gutter={12}>
              <Col span={6}><Card size="small"><Statistic title="Tổng chi tiêu" value={money(m.totalSpend)} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Số đơn" value={m.totalOrders} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="TB / đơn" value={money(m.averageOrderValue)} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Đơn 30 ngày" value={m.ordersLast30Days} /></Card></Col>
            </Row>
            <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
<<<<<<< HEAD
              <Descriptions.Item label="Cà phê yêu thích">{data.stats.favoriteCoffee ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Mua gần nhất">{dateTime(data.stats.lastOrderAt)}</Descriptions.Item>
              <Descriptions.Item label="Điểm tích lũy">{data.customer.loyaltyPoints}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">{data.customer.dateOfBirth ? date(data.customer.dateOfBirth) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Giới tính">{{ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }[data.customer.gender ?? ''] ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Đăng ký">{date(data.customer.registeredAt)}</Descriptions.Item>
              <Descriptions.Item label="Nhóm khách hàng" span={2}>{data.customer.groups.length
                ? data.customer.groups.map((group) => <Tag key={group}>{group}</Tag>)
                : 'Chưa thuộc nhóm nào'}</Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>{data.customer.description || '—'}</Descriptions.Item>
            </Descriptions>
            <Tabs items={[
              { key: 't', label: `Dòng thời gian (${data.timeline.length})`, children: <Timeline items={data.timeline.map((e) => ({ children: <><b>{timelineLabel[e.eventType] ?? e.eventType}</b> · {dateTime(e.eventTime)}<div>{e.description}</div></> }))} /> },
              { key: 'o', label: `Lịch sử mua (${data.orders.length})`, children: <Table size="small" rowKey="id" dataSource={data.orders} pagination={{ pageSize: 8 }} columns={[{ title: 'Mã', dataIndex: 'orderCode' }, { title: 'Ngày', dataIndex: 'orderedAt', render: dateTime }, { title: 'Sản phẩm / số lượng', dataIndex: 'items', render: (v) => v || '—' }, { title: 'Tổng', dataIndex: 'totalAmount', render: money }, { title: 'Trạng thái', dataIndex: 'status', render: (status: string) => {
                const mapped = ORDER_STATUS_LABEL[status?.toUpperCase()]
                return <Tag color={mapped?.color ?? 'default'}>{mapped?.label ?? status ?? '—'}</Tag>
              } }]} /> },
              { key: 'c', label: 'So sánh giai đoạn', children: <>
                <Typography.Paragraph type="secondary">So sánh doanh thu và số đơn của hồ sơ này giữa hai khoảng thời gian.</Typography.Paragraph>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space wrap><Typography.Text>Kỳ 1</Typography.Text><DatePicker.RangePicker value={firstPeriod} onChange={(v) => { if (v?.[0] && v[1]) setFirstPeriod([v[0], v[1]]) }} format="DD/MM/YYYY" /></Space>
                  <Space wrap><Typography.Text>Kỳ 2</Typography.Text><DatePicker.RangePicker value={secondPeriod} onChange={(v) => { if (v?.[0] && v[1]) setSecondPeriod([v[0], v[1]]) }} format="DD/MM/YYYY" /></Space>
                </Space>
                <Table style={{ marginTop: 16 }} size="small" rowKey="period" loading={comparison.isLoading} pagination={false} dataSource={[
                  { period: 'Kỳ 1', ...comparison.data?.firstPeriod },
                  { period: 'Kỳ 2', ...comparison.data?.secondPeriod },
                ]} columns={[{ title: 'Giai đoạn', dataIndex: 'period' }, { title: 'Chi tiêu', dataIndex: 'totalSpend', render: (v) => money(v ?? 0) }, { title: 'Số đơn', dataIndex: 'totalOrders', render: (v) => v ?? 0 }, { title: 'Trung bình / đơn', dataIndex: 'averageOrderValue', render: (v) => money(v ?? 0) }, { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: dateTime }]} />
              </> },
              { key: 'i', label: `Tương tác (${data.interactions.length})`, children: <Timeline items={data.interactions.map((i) => ({ children: <><b>{i.channel}</b> · {dateTime(i.createdAt)}<div>{i.content}</div></> }))} /> },
              { key: 'f', label: `Phản hồi (${data.feedbacks.length})`, children: <Timeline items={data.feedbacks.map((f) => ({ color: f.sentiment === 'NEGATIVE' ? 'red' : 'green', children: <><b>{f.topic}</b> · {dateTime(f.createdAt)}<div>{f.content}</div></> }))} /> },
              { key: 'a', label: `Địa chỉ (${data.customer.addresses.length})`, children: <>
                <Button type="primary" size="small" style={{ marginBottom: 12 }} onClick={() => openAddress()}>Thêm địa chỉ</Button>
                <Table size="small" rowKey="id" dataSource={data.customer.addresses} pagination={false} columns={[
                  { title: 'Nhãn', dataIndex: 'label', render: (v) => v || '—' },
                  { title: 'Người nhận', dataIndex: 'recipientName' },
                  { title: 'Điện thoại', dataIndex: 'recipientPhone' },
                  { title: 'Địa chỉ', dataIndex: 'address' },
                  { title: 'Mặc định', dataIndex: 'isDefault', render: (v) => v ? 'Có' : 'Không' },
                  { title: '', render: (_, a) => <Space><Button size="small" onClick={() => openAddress(a)}>Sửa</Button><Popconfirm title="Xóa địa chỉ này?" onConfirm={() => deleteAddress.mutate(a.id)}><Button size="small" danger loading={deleteAddress.isPending}>Xóa</Button></Popconfirm></Space> },
                ]} />
              </> },
              { key: 'p', label: 'Điểm tích lũy', children: <Table size="small" rowKey="id" dataSource={data.pointHistory} pagination={false} columns={[{ title: 'Ngày', dataIndex: 'createdAt', render: dateTime }, { title: 'Điểm', dataIndex: 'pointsChange', render: (v: number) => v > 0 ? `+${v}` : v }, { title: 'Đơn hàng', dataIndex: 'orderCode', render: (v?: string) => v || '—' }, { title: 'Lý do', dataIndex: 'reason', render: (v?: string) => v || '—' }]} /> },
              { key: 'h', label: 'Lịch sử hồ sơ', children: <Timeline pending={history.isLoading} items={(history.data ?? []).map((entry) => {
                const labels: Record<string, string> = { fullName: 'Họ tên', phone: 'Số điện thoại', email: 'Email', dateOfBirth: 'Ngày sinh', gender: 'Giới tính', description: 'Mô tả' }
                const valueLabel = (field: string, value: unknown) => {
                  if (value == null || value === '') return 'Trống'
                  if (field === 'gender') return ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' } as Record<string, string>)[String(value)] ?? String(value)
                  return String(value)
                }
                const changed = Object.keys(entry.after).filter((field) => entry.before[field] !== entry.after[field])
                return { children: <Card size="small" title={`${dateTime(entry.changedAt)} · ${entry.actor}`}>
                  {changed.length ? <Descriptions size="small" column={1}>{changed.map((field) => <Descriptions.Item key={field} label={labels[field] ?? field}>
                    <span style={{ color: '#888' }}>{valueLabel(field, entry.before[field])}</span> <span aria-label="thành">→</span> <b>{valueLabel(field, entry.after[field])}</b>
                  </Descriptions.Item>)}</Descriptions> : 'Không có trường nào thay đổi'}
                </Card> }
              })} /> },
=======
              <Descriptions.Item label="Cà phê yêu thích">{m.favoriteCoffee ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Danh mục yêu thích">{m.favoriteCategory ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Mua gần nhất">{dateTime(m.lastOrderAt)}</Descriptions.Item>
              <Descriptions.Item label="Điểm tích lũy">{p.loyaltyPoints}</Descriptions.Item>
              <Descriptions.Item label="Email">{p.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Đăng ký">{date(p.registeredAt)}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">{date(p.dateOfBirth)}</Descriptions.Item>
              <Descriptions.Item label="Giới tính">{genderLabel(p.gender)}</Descriptions.Item>
              <Descriptions.Item label="Nhóm" span={2}>
                {p.groups.length ? p.groups.map((g) => <Tag key={g} color="blue">{g}</Tag>) : <span className="a-muted">Chưa thuộc nhóm nào</span>}
              </Descriptions.Item>
              {p.description && <Descriptions.Item label="Ghi chú" span={2}>{p.description}</Descriptions.Item>}
            </Descriptions>
            <Tabs items={[
              { key: 'a', label: `Địa chỉ (${p.addresses.length})`, children: <AddressBook customerId={p.id} /> },
              {
                key: 'o', label: `Lịch sử mua (${data.recentOrders.length})`,
                children: <Table size="small" rowKey="orderCode" dataSource={data.recentOrders} pagination={{ pageSize: 8 }}
                  columns={[
                    { title: 'Mã', dataIndex: 'orderCode' }, { title: 'Ngày', dataIndex: 'orderedAt', render: dateTime },
                    { title: 'Món', dataIndex: 'items', ellipsis: true }, { title: 'Tổng', dataIndex: 'totalAmount', render: money },
                    { title: 'Trạng thái', dataIndex: 'status' },
                  ]} />,
              },
              {
                key: 'i', label: `Tương tác (${data.recentInteractions.length})`,
                children: data.recentInteractions.length ? <Timeline items={data.recentInteractions.map((i) => ({
                  children: <><b>{CHANNEL[i.channel] ?? i.channel}</b> · {dateTime(i.occurredAt ?? i.createdAt)}<div>{i.content}</div>{i.outcome && <div className="a-muted">Kết quả: {i.outcome}</div>}</>,
                }))} /> : <Empty />,
              },
              {
                key: 'f', label: `Phản hồi (${data.recentFeedbacks.length})`,
                children: data.recentFeedbacks.length ? <Timeline items={data.recentFeedbacks.map((f) => ({
                  color: f.sentiment === 'NEGATIVE' ? 'red' : f.sentiment === 'POSITIVE' ? 'green' : 'gray',
                  children: <><b>{f.topic ?? 'Phản hồi'}</b> · {dateTime(f.createdAt)}<div>{f.content}</div>{f.resolution && <div className="a-muted">Xử lý: {f.resolution}</div>}</>,
                }))} /> : <Empty />,
              },
              {
                key: 't', label: 'Dòng thời gian',
                children: data.timeline.length ? <Timeline items={data.timeline.map((e) => ({ children: <><b>{e.eventType}</b> · {dateTime(e.eventTime)}<div>{e.description}</div></> }))} /> : <Empty />,
              },
              {
                key: 'p', label: 'Điểm tích lũy',
                children: <Table size="small" rowKey="id" dataSource={data.pointHistory} pagination={false}
                  columns={[
                    { title: 'Ngày', dataIndex: 'createdAt', render: dateTime }, { title: 'Điểm', dataIndex: 'pointsChange' },
                    { title: 'Lý do', dataIndex: 'reason' }, { title: 'Đơn', dataIndex: 'orderCode' },
                  ]} />,
              },
>>>>>>> main
            ]} />
          </>
        )}
      </ServiceGate>
      <Modal open={addressDialog} title={addressEdit?.id ? 'Sửa địa chỉ' : 'Thêm địa chỉ'} onCancel={closeAddress} onOk={() => addressForm.submit()} confirmLoading={saveAddress.isPending} destroyOnHidden>
        <Form form={addressForm} layout="vertical" onFinish={(address) => saveAddress.mutate({ address: { ...addressEdit, ...address } }, { onSuccess: closeAddress })}>
          <Form.Item name="label" label="Nhãn địa chỉ" rules={[{ max: 30 }]}><Input maxLength={30} placeholder="Nhà riêng, Cơ quan…" /></Form.Item>
          <Form.Item name="recipientName" label="Người nhận" rules={[{ required: true, whitespace: true }, { max: 100 }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="recipientPhone" label="Số điện thoại người nhận" rules={[{ required: true }, { pattern: /^0\d{9,10}$/, message: 'Nhập số điện thoại gồm 10 hoặc 11 số, bắt đầu bằng 0' }]}><Input maxLength={15} /></Form.Item>
          <Form.Item name="address" label="Địa chỉ" rules={[{ required: true, whitespace: true }, { max: 255 }]}><Input.TextArea maxLength={255} rows={2} /></Form.Item>
          <Form.Item name="isDefault" label="Địa chỉ mặc định" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Drawer>
  )
}

function AddressBook({ customerId }: { customerId: number }) {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-addresses', customerId], queryFn: () => crmApi.addresses(customerId), retry: false })
  const [edit, setEdit] = useState<Partial<CustomerAddress> | null>(null)
  const keys = [['crm-addresses', customerId], ['crm-360', customerId]]
  const save = useAction(
    (v: Partial<CustomerAddress>) => {
      const body = { label: v.label, recipientName: v.recipientName!, recipientPhone: v.recipientPhone!, address: v.address!, isDefault: v.isDefault }
      return v.id ? crmApi.updateAddress(customerId, v.id, body) : crmApi.createAddress(customerId, body)
    },
    keys,
  )
  const remove = useAction((addressId: number) => crmApi.deleteAddress(customerId, addressId), keys, 'Đã xóa địa chỉ')

  return (
    <ServiceGate module="CRM" loading={isLoading} error={error}>
      <Button icon={<PlusOutlined />} style={{ marginBottom: 8 }} onClick={() => setEdit({ isDefault: data.length === 0 })}>Thêm địa chỉ</Button>
      <List dataSource={data} locale={{ emptyText: 'Chưa có địa chỉ giao hàng' }}
        renderItem={(a) => (
          <List.Item actions={[
            <Button key="e" size="small" icon={<EditOutlined />} onClick={() => setEdit(a)} />,
            <Popconfirm key="d" title="Xóa địa chỉ này?" onConfirm={() => remove.mutate(a.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>,
          ]}>
            <List.Item.Meta avatar={<HomeOutlined />}
              title={<>{a.label || 'Địa chỉ'} {a.isDefault && <Tag color="green">Mặc định</Tag>}</>}
              description={<><div>{a.address}</div><div className="a-muted">{a.recipientName} · {a.recipientPhone}</div></>} />
          </List.Item>
        )} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa địa chỉ' : 'Thêm địa chỉ'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={edit ?? {}} onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="label" label="Nhãn"><Input maxLength={30} placeholder="Nhà, Công ty…" /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="recipientName" label="Người nhận" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item>
            <Form.Item name="recipientPhone" label="SĐT người nhận" rules={[{ required: true, pattern: PHONE, message: 'SĐT 10–11 số, bắt đầu bằng 0' }]}><Input /></Form.Item>
          </div>
          <Form.Item name="address" label="Địa chỉ" rules={[{ required: true }]}><Input.TextArea rows={2} maxLength={255} /></Form.Item>
          <Form.Item name="isDefault" label="Đặt làm mặc định" valuePropName="checked"><Switch /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </ServiceGate>
  )
}
