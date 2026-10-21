import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Input, Segmented, Select, Space, Table, Tag, Typography } from 'antd'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { AuditLog } from '@/api/types'
import { dateTime } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { PageHeader } from '../components/PageHeader'

/** API path segment → screen name, for the "Chức năng" column */
const MODULE: Record<string, string> = {
  orders: 'Đơn hàng', payments: 'Thanh toán', shipments: 'Giao hàng', incidents: 'Sự cố', coffees: 'Cà phê', recipes: 'Công thức',
  categories: 'Danh mục', materials: 'Nguyên liệu', inventory: 'Kho', tables: 'Bàn & QR', staff: 'Nhân viên', users: 'Tài khoản',
  roles: 'Phân quyền', auth: 'Đăng nhập', suppliers: 'Nhà cung cấp', 'purchase-orders': 'Phiếu đặt hàng', 'goods-receipts': 'Phiếu nhập',
  'supplier-returns': 'Trả hàng nhập', 'supplier-payments': 'Phiếu chi NCC', stocktakes: 'Kiểm kê', 'cash-shifts': 'Ca thu ngân',
  'work-shifts': 'Ca mẫu', 'shift-assignments': 'Phân ca', attendance: 'Chấm công', 'coffee-costs': 'Giá vốn', reports: 'Báo cáo',
  'delivery-zones': 'Khu vực giao hàng', invoices: 'Hóa đơn điện tử', 'payment-transactions': 'Đối soát thanh toán', notifications: 'Tin nhắn',
}
const ACTION: Record<string, string> = { CREATE: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xóa' }
const moduleName = (m: string) => (m.startsWith('public/') ? `Khách · ${m.slice(7)}` : MODULE[m] ?? m)

/** Nhật ký thao tác: ai đã thêm / sửa / xóa / thao tác gì, lúc nào, kết quả. Chỉ xem, không sửa; tự xóa sau 180 ngày. */
export function AuditLogsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(1, 'day'), dayjs()])
  const [username, setUsername] = useState<string>()
  const [module, setModule] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [keyword, setKeyword] = useState('')
  const kw = useDebounced(keyword, 400)
  const [page, setPage] = useState(1)
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), username, module, failed, keyword: kw || undefined }
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs', params, page], queryFn: () => coreApi.auditLogs({ ...params, page: page - 1, size: 50 }) })
  const { data: filters } = useQuery({ queryKey: ['audit-filters'], queryFn: coreApi.auditFilters })

  return (
    <>
      <PageHeader title="Nhật ký thao tác" subtitle="Mọi thao tác thêm / sửa / xóa trên hệ thống · ai làm, lúc nào, kết quả"
        extra={<Button icon={<DownloadOutlined />} onClick={() => coreApi.auditExcel(params)}>Xuất Excel</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={(v) => { if (v) { setRange([v[0]!, v[1]!]); setPage(1) } }} format="DD/MM/YYYY" allowClear={false} />
        <Select allowClear showSearch placeholder="Người thao tác" style={{ width: 170 }} value={username} onChange={(v) => { setUsername(v); setPage(1) }}
          options={(filters?.usernames ?? []).map((u) => ({ value: u, label: u }))} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chức năng" style={{ width: 190 }} value={module} onChange={(v) => { setModule(v); setPage(1) }}
          options={(filters?.modules ?? []).map((m) => ({ value: m, label: moduleName(m) }))} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã phiếu, nội dung…" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }} style={{ width: 200 }} />
        <Segmented value={failed ? 'fail' : 'all'} onChange={(v) => { setFailed(v === 'fail'); setPage(1) }} options={[{ value: 'all', label: 'Tất cả' }, { value: 'fail', label: 'Chỉ lỗi' }]} />
      </Space>
      <Table<AuditLog> rowKey="id" size="small" loading={isLoading} dataSource={data?.items ?? []} scroll={{ x: 1000 }}
        pagination={{ current: page, pageSize: 50, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        expandable={{ expandedRowRender: (a) => <Typography.Paragraph code style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.method} {a.path}{a.detail && `\n${a.detail}`}</Typography.Paragraph>, rowExpandable: () => true }}
        columns={[
          { title: 'Thời gian', dataIndex: 'createdAt', render: dateTime, width: 150 },
          { title: 'Người thao tác', dataIndex: 'username', render: (v) => v ?? <span className="a-muted">Khách</span> },
          { title: 'Chức năng', dataIndex: 'module', render: moduleName },
          { title: 'Thao tác', dataIndex: 'action', render: (v: string) => <Tag>{ACTION[v] ?? v}</Tag> },
          { title: 'Bản ghi', dataIndex: 'entityId', render: (v) => v ?? '—' },
          { title: 'Kết quả', dataIndex: 'statusCode', render: (v: number) => (v < 400 ? <Tag color="green">Thành công</Tag> : <Tag color="red">Lỗi {v}</Tag>) },
          { title: 'IP', dataIndex: 'ip', responsive: ['lg'] },
        ]} />
    </>
  )
}
