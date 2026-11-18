import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import { PauseOutlined, PlusOutlined, CaretRightOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Subscription, SubscriptionPayload, SubscriptionStatus } from '@/api/types'
import dayjs from 'dayjs'
import { dateTime, money } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { SubscriptionForm } from '@/components/SubscriptionForm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

export const SUB_STATUS: Record<SubscriptionStatus, { text: string; color: string }> = {
  ACTIVE: { text: 'Đang giao', color: 'green' }, PAUSED: { text: 'Tạm dừng', color: 'gold' }, CANCELLED: { text: 'Đã hủy', color: 'default' },
}

/**
 * Gói giao cà phê định kỳ: nhân viên đăng ký thay khách, tạm dừng / mở lại / hủy. Hệ thống tự tạo đơn giao trước giờ
 * giao (thanh toán khi nhận); lần tạo đơn lỗi (hết món, ngoài khu vực…) hiện ở cột "Lần gần nhất".
 */
export function SubscriptionsPage() {
  const canEdit = usePerm().can(P.SUBSCRIPTIONS)
  const { data = [], isLoading } = useQuery({ queryKey: ['subscriptions'], queryFn: coreApi.subscriptions })
  const { data: coffees = [] } = useQuery({ queryKey: ['coffees'], queryFn: coreApi.coffees })
  const [filter, setFilter] = useState<'ACTIVE' | 'PAUSED' | 'ALL'>('ACTIVE')
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Subscription | 'new' | null>(null)
  const keys = [['subscriptions'], ['orders']]
  const save = useAction((v: SubscriptionPayload & { id?: number }) => coreApi.saveSubscription(v), keys, 'Đã lưu gói')
  const status = useAction((v: { id: number; status: SubscriptionStatus }) => coreApi.setSubscriptionStatus(v.id, v.status), keys, 'Đã cập nhật')
  const q = search.trim().toLowerCase()
  const rows = data.filter((s) => (filter === 'ALL' || s.status === filter)
    && (!q || [s.code, s.customerName, s.customerPhone, s.address].some((x) => x?.toLowerCase().includes(q))))
  const sellable = coffees.filter((c) => c.status === 'AVAILABLE' || c.status === 'SOLD_OUT')

  return (
    <>
      <PageHeader title="Gói giao định kỳ" subtitle="Giao cà phê theo ngày / theo tuần vào giờ cố định — đơn tự tạo trước giờ giao"
        extra={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit('new')}>Đăng ký gói</Button>} />
      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[
          { value: 'ACTIVE', label: `Đang giao (${data.filter((s) => s.status === 'ACTIVE').length})` },
          { value: 'PAUSED', label: `Tạm dừng (${data.filter((s) => s.status === 'PAUSED').length})` },
          { value: 'ALL', label: 'Tất cả' },
        ]} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã gói, khách, SĐT, địa chỉ" style={{ width: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </Space>
      <Table<Subscription> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 1100 }}
        columns={[
          { title: 'Gói', render: (_, s) => <><b>{s.code}</b><div><Tag color={SUB_STATUS[s.status].color}>{SUB_STATUS[s.status].text}</Tag></div></> },
          { title: 'Khách', render: (_, s) => <>{s.customerName ?? s.recipientName}<div className="a-muted small">{s.customerPhone}</div></> },
          { title: 'Món', render: (_, s) => <>{s.items.map((i) => <div key={i.coffeeId} style={{ color: i.available ? undefined : '#cf1322' }}>{i.quantity}× {i.coffeeName}{!i.available && ' (hết)'}</div>)}<div className="a-muted small">~{money(s.itemsTotal)} / lần</div></> },
          { title: 'Lịch', render: (_, s) => <>{s.schedule}<div className="a-muted small">từ {dayjs(s.startDate).format('DD/MM/YYYY')}{s.endDate ? ` đến ${dayjs(s.endDate).format('DD/MM/YYYY')}` : ''}</div></> },
          { title: 'Giao tới', dataIndex: 'address', ellipsis: true, render: (v: string, s) => <Tooltip title={v}>{s.recipientName} · {s.recipientPhone}<div className="a-muted small">{v}</div></Tooltip> },
          { title: 'Lần tới', render: (_, s) => (s.nextDelivery ? <Tag color="purple">{dateTime(s.nextDelivery)}</Tag> : '—') },
          {
            title: 'Lần gần nhất', render: (_, s) => <>
              {s.lastOrderCode ? <b>{s.lastOrderCode}</b> : <span className="a-muted">Chưa có đơn</span>}
              <div className="a-muted small">{s.orderCount} đơn</div>
              {s.lastError && <Tooltip title={s.lastError}><Tag color="red" icon={<WarningOutlined />}>Lỗi tạo đơn</Tag></Tooltip>}
            </>,
          },
          {
            title: '', width: 200, render: (_, s) => canEdit && s.status !== 'CANCELLED' && (
              <Space size={4}>
                <Button size="small" onClick={() => setEdit(s)}>Sửa</Button>
                {s.status === 'ACTIVE'
                  ? <Button size="small" icon={<PauseOutlined />} onClick={() => status.mutate({ id: s.id, status: 'PAUSED' })}>Dừng</Button>
                  : <Button size="small" icon={<CaretRightOutlined />} onClick={() => status.mutate({ id: s.id, status: 'ACTIVE' })}>Mở lại</Button>}
                <Popconfirm title="Hủy gói này? Không mở lại được." onConfirm={() => status.mutate({ id: s.id, status: 'CANCELLED' })}>
                  <Button size="small" danger>Hủy</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]} />
      <Modal open={!!edit} title={edit && edit !== 'new' ? `Sửa gói ${edit.code}` : 'Đăng ký gói giao định kỳ'} footer={null}
        onCancel={() => setEdit(null)} destroyOnHidden width={720}>
        <SubscriptionForm withCustomer initial={edit === 'new' ? null : edit} coffees={sellable} saving={save.isPending}
          onSubmit={(p) => save.mutate({ ...p, id: edit && edit !== 'new' ? edit.id : undefined }, { onSuccess: () => setEdit(null) })} />
      </Modal>
    </>
  )
}
