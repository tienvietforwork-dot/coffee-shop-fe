import { Card, Col, List, Row, Statistic, Tag, Empty } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShoppingCartOutlined, DollarOutlined, FireOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { PageHeader } from '../components/PageHeader'
import { ORDER_STATUS, money, time, date } from '@/lib/format'
import { StatusTag } from '../components/StatusTag'
import dayjs from 'dayjs'

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: coreApi.dashboard, refetchInterval: 60000 })
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: coreApi.alerts })
  const today = dayjs().format('YYYY-MM-DD')
  const { data: orders = [] } = useQuery({ queryKey: ['orders', 'today'], queryFn: () => coreApi.orders({ from: today, to: today }) })

  return (
    <>
      <PageHeader title="Tổng quan hôm nay" subtitle={dayjs().format('dddd, DD/MM/YYYY')} />
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}><Card><Statistic title="Đơn hôm nay" value={data?.todayOrders ?? 0} prefix={<ShoppingCartOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Doanh thu (đơn hoàn tất)" value={data?.todayRevenue ?? 0} formatter={(v) => money(Number(v))} prefix={<DollarOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Link to="/admin/orders"><Statistic title="Đơn đang xử lý" value={data?.activeOrders ?? 0} prefix={<FireOutlined />} valueStyle={{ color: '#c8873a' }} /></Link></Card></Col>
        <Col xs={12} lg={6}><Card><Link to="/admin/materials"><Statistic title="Cảnh báo kho" value={(data?.lowStockCount ?? 0) + (data?.expiringBatchCount ?? 0)} prefix={<WarningOutlined />} valueStyle={{ color: (data?.lowStockCount ?? 0) > 0 ? '#cf1322' : undefined }} /></Link></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Đơn hàng hôm nay" extra={<Link to="/admin/orders">Điều phối</Link>}>
            <List
              locale={{ emptyText: <Empty description="Chưa có đơn" /> }}
              dataSource={orders.slice(0, 8)}
              renderItem={(o) => (
                <List.Item extra={<b>{money(o.totalAmount)}</b>}>
                  <List.Item.Meta
                    title={<>{o.orderCode} <StatusTag label={ORDER_STATUS[o.status]} /></>}
                    description={`${time(o.orderedAt)} · ${o.items.map((i) => `${i.quantity}× ${i.coffeeName}`).join(', ')}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Bán chạy 7 ngày">
            <List
              dataSource={data?.topCoffeesThisWeek ?? []}
              locale={{ emptyText: 'Chưa có dữ liệu' }}
              renderItem={(c, i) => (
                <List.Item extra={<b>{c.quantity} ly</b>}>
                  <span><Tag color={i === 0 ? 'gold' : 'default'}>#{i + 1}</Tag>{c.name}</span>
                </List.Item>
              )}
            />
          </Card>
          <Card title="Cảnh báo kho" style={{ marginTop: 16 }} extra={<Link to="/admin/stock">Nhập kho</Link>}>
            {alerts?.lowStock.map((m) => (
              <div key={m.id} className="a-line"><span><WarningOutlined style={{ color: '#cf1322' }} /> {m.name}</span><span>còn {m.stockQuantity} / {m.minStock} {m.unit}</span></div>
            ))}
            {alerts?.expiringBatches.map((b) => (
              <div key={b.id} className="a-line"><span><ClockCircleOutlined style={{ color: '#d48806' }} /> {b.materialName} (lô #{b.id})</span><span>HSD {date(b.expiryDate)}</span></div>
            ))}
            {!alerts?.lowStock.length && !alerts?.expiringBatches.length && <span className="a-muted">Kho ổn định</span>}
          </Card>
        </Col>
      </Row>
    </>
  )
}
