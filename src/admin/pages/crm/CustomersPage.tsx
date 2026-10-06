import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Statistic, Table, Tabs, Tag, Timeline } from 'antd'
import { PlusOutlined, MergeCellsOutlined } from '@ant-design/icons'
import { crmApi, type CustomerSummary } from '@/api/crm'
import { dateTime, date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'

export function CustomersPage() {
  const [q, setQ] = useState('')
  const { data = [], isLoading, error } = useQuery({ queryKey: ['crm-customers', q], queryFn: () => crmApi.customers(q || undefined), retry: false })
  const [openId, setOpenId] = useState<number | null>(null)
  const [edit, setEdit] = useState<Partial<CustomerSummary> | null>(null)
  const [mergeFor, setMergeFor] = useState<number | null>(null)
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
            { title: 'Khách hàng', render: (_, c) => <><b>{c.fullName || 'Chưa có tên'}</b><div className="a-muted">{c.phone}</div></> },
            { title: 'Nhóm', render: (_, c) => c.groups.map((g) => <Tag key={g}>{g}</Tag>) },
            { title: 'Số đơn', dataIndex: 'orderCount', sorter: (a, b) => a.orderCount - b.orderCount },
            { title: 'Tổng chi tiêu', dataIndex: 'totalSpent', render: money, sorter: (a, b) => a.totalSpent - b.totalSpent },
            { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: date },
            { title: 'Điểm', dataIndex: 'loyaltyPoints' },
            { title: '', render: (_, c) => <Button size="small" icon={<MergeCellsOutlined />} onClick={(e) => { e.stopPropagation(); setMergeFor(c.id) }}>Gộp</Button> },
          ]} />
      </ServiceGate>
      <Customer360Drawer id={openId} onClose={() => setOpenId(null)} />
      <Modal open={!!edit} title="Hồ sơ khách hàng" footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={edit ?? {}} onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="fullName" label="Họ tên"><Input /></Form.Item>
          <Form.Item name="phone" label="Điện thoại" rules={[{ required: true, pattern: /^0\d{9,10}$/ }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Modal open={!!mergeFor} title="Gộp hồ sơ trùng" footer={null} onCancel={() => setMergeFor(null)} destroyOnHidden>
        <p>Hồ sơ trùng sẽ được gộp (đơn hàng, điểm, tương tác) vào hồ sơ #{mergeFor}.</p>
        <Form layout="inline" onFinish={(v) => merge.mutate({ keep: mergeFor!, dup: v.dup }, { onSuccess: () => setMergeFor(null) })}>
          <Form.Item name="dup" label="ID hồ sơ trùng" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Button type="primary" danger htmlType="submit" loading={merge.isPending}>Gộp</Button>
        </Form>
      </Modal>
    </>
  )
}

function Customer360Drawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-360', id], queryFn: () => crmApi.customer360(id!), enabled: !!id, retry: false })
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
              <Descriptions.Item label="Đăng ký">{date(data.customer.registeredAt)}</Descriptions.Item>
            </Descriptions>
            <Tabs items={[
              { key: 'o', label: `Lịch sử mua (${data.orders.length})`, children: <Table size="small" rowKey="id" dataSource={data.orders} pagination={{ pageSize: 8 }} columns={[{ title: 'Mã', dataIndex: 'orderCode' }, { title: 'Ngày', dataIndex: 'orderedAt', render: dateTime }, { title: 'Kênh', dataIndex: 'channel' }, { title: 'Tổng', dataIndex: 'totalAmount', render: money }, { title: 'Trạng thái', dataIndex: 'status' }]} /> },
              { key: 'i', label: `Tương tác (${data.interactions.length})`, children: <Timeline items={data.interactions.map((i) => ({ children: <><b>{i.channel}</b> · {dateTime(i.createdAt)}<div>{i.content}</div></> }))} /> },
              { key: 'f', label: `Phản hồi (${data.feedbacks.length})`, children: <Timeline items={data.feedbacks.map((f) => ({ color: f.sentiment === 'NEGATIVE' ? 'red' : 'green', children: <><b>{f.topic}</b> · {dateTime(f.createdAt)}<div>{f.content}</div></> }))} /> },
              { key: 'p', label: 'Điểm tích lũy', children: <Table size="small" rowKey="id" dataSource={data.pointHistory} pagination={false} columns={[{ title: 'Ngày', dataIndex: 'createdAt', render: dateTime }, { title: 'Điểm', dataIndex: 'pointsChange' }, { title: 'Lý do', dataIndex: 'reason' }]} /> },
            ]} />
          </>
        )}
      </ServiceGate>
    </Drawer>
  )
}
