import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, List, Modal, Popconfirm, Row, Select,
  Space, Statistic, Switch, Table, Tabs, Tag, Timeline,
} from 'antd'
import { PlusOutlined, MergeCellsOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { crmApi, type Customer, type CustomerAddress, type CustomerPayload } from '@/api/crm'
import { dateTime, date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

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

  return (
    <>
      <PageHeader title="Hồ sơ khách hàng" subtitle="Customer 360: lịch sử mua, chi tiêu, địa chỉ, nhóm, tương tác, phản hồi"
        extra={<>
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
        </Form>
      </Modal>
    </>
  )
}

function Customer360Drawer({ id, onClose, onEdit }: { id: number | null; onClose: () => void; onEdit: (c: Partial<Customer>) => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-360', id], queryFn: () => crmApi.customer360(id!), enabled: !!id, retry: false })
  const p = data?.profile
  const m = data?.metrics
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
            ]} />
          </>
        )}
      </ServiceGate>
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
