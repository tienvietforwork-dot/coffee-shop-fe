import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { Incident, Order, OrderStatus } from '@/api/types'
import {
  INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, ORDER_CHANNEL, ORDER_STATUS, ORDER_TYPE, dateTime, money, options,
} from '@/lib/format'
import { customerText, itemCodes } from '@/lib/orderInfo'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { OrderDetailDrawer } from '../components/OrderDetailDrawer'

/**
 * Sự cố đơn hàng: tab "Danh sách sự cố" để xử lý / đền bù voucher,
 * tab "Ghi nhận sự cố" hiện danh sách hóa đơn để chọn đơn và ghi nhận sự cố.
 */
export function IncidentsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'report' ? 'report' : 'list'
  const [orderId, setOrderId] = useState<number | null>(null)
  return (
    <>
      <PageHeader title="Sự cố đơn hàng" subtitle="Chọn hóa đơn để ghi nhận sự cố · xử lý và đền bù voucher cần quyền Xử lý sự cố" />
      <Tabs activeKey={tab} onChange={(k) => setParams(k === 'report' ? { tab: 'report' } : {}, { replace: true })}
        items={[
          { key: 'list', label: 'Danh sách sự cố', children: <IncidentList onOpenOrder={setOrderId} /> },
          { key: 'report', label: 'Ghi nhận sự cố', children: <ReportFromOrders onOpenOrder={setOrderId} /> },
        ]} />
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
    </>
  )
}

function IncidentList({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  const { can } = usePerm()
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['incidents'], queryFn: coreApi.incidents })
  const [resolving, setResolving] = useState<Incident | null>(null)
  const [compensate, setCompensate] = useState(false)
  const [voucherId, setVoucherId] = useState<number>()
  // đã xử lý nhưng chưa đền bù: chỉ phát thêm voucher
  const compensateOnly = resolving?.status === 'RESOLVED'
  const withVoucher = compensate || compensateOnly
  const voucherOptions = useQuery({ queryKey: ['incident-voucher-options'], queryFn: coreApi.incidentVoucherOptions, enabled: !!resolving && withVoucher })
  const picked = voucherOptions.data?.find((o) => o.id === voucherId)
  const resolve = useAction((v: { id: number } & Parameters<typeof coreApi.resolveIncident>[1]) => coreApi.resolveIncident(v.id, v),
    [['incidents'], ['incident-voucher-options']], compensateOnly ? 'Đã phát voucher đền bù' : 'Đã xử lý sự cố')
  const open = (i: Incident, withCompensation: boolean) => { setCompensate(withCompensation); setVoucherId(undefined); setResolving(i) }

  return (
    <>
      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Không tải được danh sách sự cố" description={errorMessage(error)}
          action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>} />
      )}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Đơn', dataIndex: 'orderCode', render: (v, i) => <a onClick={() => onOpenOrder(i.orderId)}>{v}</a> },
          { title: 'Loại', render: (_, i) => INCIDENT_TYPE[i.type] },
          { title: 'Mức độ', render: (_, i) => i.severity && <StatusTag label={INCIDENT_SEVERITY[i.severity]} /> },
          { title: 'Lý do', dataIndex: 'reason', ellipsis: true },
          { title: 'Ghi nhận', render: (_, i) => <>{dateTime(i.reportedAt)}<div className="a-muted small">bởi {i.reportedBy}</div></> },
          { title: 'Xử lý', render: (_, i) => i.status === 'RESOLVED' ? <>{i.resolution}<div className="a-muted small">{i.handledByName ?? ''} · {dateTime(i.resolvedAt)}</div></> : '—' },
          { title: 'Đền bù', render: (_, i) => i.vouchers.map((v) => <Tag key={v.code}>{v.code}</Tag>) },
          { title: 'Trạng thái', render: (_, i) => <StatusTag label={INCIDENT_STATUS[i.status]} /> },
          {
            title: '', render: (_, i) => can(P.INCIDENTS_RESOLVE) && (
              i.status !== 'RESOLVED'
                ? <Button size="small" type="primary" onClick={() => open(i, false)}>Xử lý</Button>
                : !i.vouchers.length && <Button size="small" onClick={() => open(i, true)}>Đền bù</Button>
            ),
          },
        ]}
        expandable={{ expandedRowRender: (i) => <pre className="a-pre">{i.description || 'Không có mô tả'}</pre> }}
      />
      <Modal open={!!resolving} title={`${compensateOnly ? 'Đền bù sự cố' : 'Xử lý sự cố'} đơn ${resolving?.orderCode}`} footer={null}
        onCancel={() => setResolving(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={{ voucherCount: 1 }}
          onFinish={(v) => resolve.mutate({
            id: resolving!.id, resolution: compensateOnly ? resolving!.resolution ?? '' : v.resolution,
            ...(withVoucher ? { voucherId: v.voucherId, voucherCount: v.voucherCount, voucherValidDays: v.voucherValidDays ?? undefined } : {}),
          }, { onSuccess: () => setResolving(null) })}>
          {compensateOnly
            ? <p><span className="a-muted">Phương án đã xử lý:</span> {resolving?.resolution}</p>
            : <>
              <Form.Item name="resolution" label="Phương án xử lý" rules={[{ required: true, message: 'Nhập phương án xử lý' }]}>
                <Input.TextArea rows={3} placeholder="Làm lại món, xin lỗi khách…" />
              </Form.Item>
              <Checkbox checked={compensate} onChange={(e) => setCompensate(e.target.checked)}>Đền bù bằng voucher</Checkbox>
            </>}
          {withVoucher && (
            <div style={{ marginTop: 12 }}>
              <Form.Item name="voucherId" label="Loại voucher" rules={[{ required: true, message: 'Chọn loại voucher' }]}>
                <Select
                  loading={voucherOptions.isLoading}
                  placeholder="Chọn loại voucher đang phát"
                  onChange={(id: number) => setVoucherId(id)}
                  notFoundContent={voucherOptions.isError ? errorMessage(voucherOptions.error) : 'Không có loại voucher đang phát'}
                  options={(voucherOptions.data ?? []).map((o) => ({
                    value: o.id,
                    disabled: o.remaining <= 0,
                    label: `${o.name} · giảm ${money(o.discountValue)}${o.minOrderValue > 0 ? ` · đơn từ ${money(o.minOrderValue)}` : ''} · còn ${o.remaining} lượt`,
                  }))}
                />
              </Form.Item>
              <div className="a-grid-2">
                <Form.Item name="voucherCount" label="Số voucher">
                  <InputNumber min={1} max={Math.max(1, Math.min(5, picked?.remaining ?? 5))} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="voucherValidDays" label="Hạn (ngày)">
                  <InputNumber min={1} style={{ width: '100%' }}
                    placeholder={picked ? (picked.validDays ? `Mặc định ${picked.validDays} ngày` : 'Không hết hạn') : 'Theo loại voucher'} />
                </Form.Item>
              </div>
            </div>
          )}
          <Button type="primary" htmlType="submit" block loading={resolve.isPending} style={{ marginTop: 12 }}>
            {compensateOnly ? 'Phát voucher' : 'Hoàn tất xử lý'}
          </Button>
        </Form>
      </Modal>
    </>
  )
}

// Bỏ dấu để tìm "nguyen" vẫn ra "Nguyễn"
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

/** Danh sách hóa đơn trong khoảng ngày; chọn một hóa đơn để ghi nhận sự cố. */
function ReportFromOrders({ onOpenOrder }: { onOpenOrder: (id: number) => void }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])
  const [status, setStatus] = useState<OrderStatus>()
  const [keyword, setKeyword] = useState('')
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), status }
  // khóa bắt đầu bằng 'orders' để realtime / thao tác đơn ở nơi khác cũng làm mới danh sách này
  const { data = [], isLoading, error, refetch } = useQuery({ queryKey: ['orders', 'incident-pick', params], queryFn: () => coreApi.orders(params) })
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: coreApi.incidents })
  const [reporting, setReporting] = useState<Order | null>(null)
  const report = useAction((v: { orderId: number } & Parameters<typeof coreApi.reportIncident>[1]) => coreApi.reportIncident(v.orderId, v),
    [['incidents'], ['order-incidents']], 'Đã ghi nhận sự cố')

  const byOrder = new Map<number, Incident[]>()
  incidents.forEach((i) => byOrder.set(i.orderId, [...(byOrder.get(i.orderId) ?? []), i]))
  const q = fold(keyword.trim())
  const rows = q
    ? data.filter((o) => fold([o.orderCode, o.customerName, o.customerPhone, o.shipment?.recipientName, o.shipment?.recipientPhone, o.tableNo].filter(Boolean).join(' ')).includes(q))
    : data

  return (
    <>
      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Không tải được danh sách hóa đơn" description={errorMessage(error)}
          action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>} />
      )}
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
        <Select allowClear placeholder="Trạng thái đơn" style={{ width: 170 }} value={status} onChange={setStatus} options={options(ORDER_STATUS)} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã đơn, tên / SĐT khách, bàn" value={keyword}
          onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} />
      </Space>
      <Table<Order> rowKey="id" size="small" loading={isLoading} dataSource={rows} scroll={{ x: 1000 }}
        columns={[
          { title: 'Hóa đơn', dataIndex: 'orderCode', render: (v, o) => <><a style={{ whiteSpace: 'nowrap' }} onClick={() => onOpenOrder(o.id)}>{v}</a><div className="a-muted small">{dateTime(o.orderedAt)}</div></> },
          { title: 'Kênh', render: (_, o) => <><StatusTag label={ORDER_CHANNEL[o.channel]} /><div className="a-muted small">{ORDER_TYPE[o.orderType]}{o.tableNo && ` · Bàn ${o.tableNo}`}</div></> },
          { title: 'Khách hàng', render: (_, o) => customerText(o) },
          { title: 'Món', ellipsis: true, render: (_, o) => itemCodes(o) },
          { title: 'Tổng tiền', dataIndex: 'totalAmount', render: money, align: 'right' },
          { title: 'Trạng thái', render: (_, o) => <StatusTag label={ORDER_STATUS[o.status]} /> },
          {
            title: 'Sự cố', render: (_, o) => {
              const list = byOrder.get(o.id) ?? []
              const open = list.filter((i) => i.status !== 'RESOLVED').length
              return list.length ? <Tag color={open ? 'red' : 'green'}>{open ? `${open} chưa xử lý` : `${list.length} đã xử lý`}</Tag> : '—'
            },
          },
          { title: '', width: 130, render: (_, o) => <Button size="small" danger onClick={() => setReporting(o)}>Ghi nhận sự cố</Button> },
        ]} />

      <Modal open={!!reporting} title={`Ghi nhận sự cố · hóa đơn ${reporting?.orderCode}`} footer={null} onCancel={() => setReporting(null)} destroyOnHidden>
        {reporting && (
          <p className="a-muted">
            {customerText(reporting)} · {money(reporting.totalAmount)} · {dateTime(reporting.orderedAt)}
            <br />{itemCodes(reporting)}
          </p>
        )}
        <Form layout="vertical" initialValues={{ type: 'QUALITY', severity: 'MEDIUM' }}
          onFinish={(v) => report.mutate({ orderId: reporting!.id, ...v }, { onSuccess: () => setReporting(null) })}>
          <Form.Item name="type" label="Loại sự cố"><Select options={options(INCIDENT_TYPE)} /></Form.Item>
          <Form.Item name="severity" label="Mức độ"><Select options={options(INCIDENT_SEVERITY)} /></Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: 'Nhập lý do' }]}><Input maxLength={255} /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" danger htmlType="submit" loading={report.isPending} block>Ghi nhận</Button>
        </Form>
      </Modal>
    </>
  )
}
