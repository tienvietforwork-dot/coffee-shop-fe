import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Timeline, Tooltip, Typography } from 'antd'
import { PlusOutlined, MergeCellsOutlined, EditOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { crmApi, type CustomerAddress, type CustomerSummary } from '@/api/crm'
import { dateTime, date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

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
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-customers', q], queryFn: () => crmApi.customers(q || undefined), retry: false })
  const [openId, setOpenId] = useState<number | null>(null)
  const [edit, setEdit] = useState<Partial<CustomerSummary> | null>(null)
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

  return (
    <>
      <PageHeader title="Hồ sơ khách hàng" subtitle="Customer 360: lịch sử mua, chi tiêu, tương tác, phản hồi"
        extra={<>
          <Input.Search placeholder="Tên / SĐT" allowClear onSearch={setQ} style={{ width: 220 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>Tạo hồ sơ</Button>
        </>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data} onRow={(c) => ({ onClick: () => setOpenId(c.id), style: { cursor: 'pointer' } })}
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
              <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEdit(c) }}>Sửa</Button>{' '}
              <Button size="small" icon={<MergeCellsOutlined />} onClick={(e) => { e.stopPropagation(); setMergeFor(c.id) }}>Gộp</Button>
            </> },
          ]} />
      </ServiceGate>
      <Customer360Drawer id={openId} onClose={() => setOpenId(null)} />
      <Modal open={!!edit} title={edit?.id ? `Sửa hồ sơ khách hàng #${edit.id}` : 'Tạo hồ sơ khách hàng'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        {/* {!edit?.id && <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Số điện thoại đã được dùng thì không thể tạo hồ sơ mới; hãy tìm hồ sơ cũ để cập nhật. Gộp hồ sơ chỉ dành cho dữ liệu trùng đã phát sinh từ nhập dữ liệu cũ hoặc sai thông tin, sau khi xác nhận là cùng một khách." />} */}
        <Form layout="vertical" initialValues={{ ...edit, dateOfBirth: edit?.dateOfBirth ? dayjs(edit.dateOfBirth) : undefined }} onFinish={(v) => save.mutate({ ...v, dateOfBirth: v.dateOfBirth?.format('YYYY-MM-DD'), id: edit?.id }, { onSuccess: () => setEdit(null) })}>
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
        </Form>
      </Modal>
    </>
  )
}

function Customer360Drawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-360', id], queryFn: () => crmApi.customer360(id!), enabled: !!id, retry: false })
  const [addressDialog, setAddressDialog] = useState(false)
  const [addressEdit, setAddressEdit] = useState<Partial<CustomerAddress> | null>(null)
  const [addressForm] = Form.useForm()
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
  return (
    <Drawer open={!!id} onClose={onClose} width={760} title={data ? `${data.customer.fullName ?? ''} · ${data.customer.phone}` : 'Hồ sơ khách hàng'}>
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        {data && (
          <>
            <Row gutter={12}>
              <Col span={6}><Card size="small"><Statistic title="Tổng chi tiêu" value={money(data.stats.totalSpent)} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Số đơn" value={data.stats.orderCount} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="TB / đơn" value={money(data.stats.avgOrderValue)} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="Đơn / tháng" value={data.stats.ordersPerMonth} precision={1} /></Card></Col>
            </Row>
            <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
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
