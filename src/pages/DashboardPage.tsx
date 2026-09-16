import { useMemo } from 'react'
import { Row, Col, Card, Statistic, Typography, Spin, Alert } from 'antd'
import {
  DollarOutlined,
  ShoppingOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Line, Column } from '@ant-design/charts'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getOrders } from '@/api/orders'
import { getLowStockMaterials } from '@/api/materials'
import { getRevenueReport, getTopProducts } from '@/api/reports'

const { Title } = Typography

export function DashboardPage() {
  const today = dayjs().format('YYYY-MM-DD')
  const from = dayjs().subtract(13, 'day').format('YYYY-MM-DD')

  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: () => getOrders() })
  const lowStockQuery = useQuery({ queryKey: ['materials', 'low-stock'], queryFn: getLowStockMaterials })
  const revenueQuery = useQuery({
    queryKey: ['reports', 'revenue', from, today],
    queryFn: () => getRevenueReport({ from, to: today }),
  })
  const topProductsQuery = useQuery({
    queryKey: ['reports', 'top-products', from, today],
    queryFn: () => getTopProducts({ from, to: today, limit: 5 }),
  })

  const todaysOrders = useMemo(
    () => (ordersQuery.data ?? []).filter((o) => dayjs(o.createdAt).isSame(dayjs(), 'day')),
    [ordersQuery.data],
  )
  const todaysRevenue = useMemo(
    () => todaysOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    [todaysOrders],
  )

  return (
    <div>
      <Title level={3}>Dashboard</Title>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card loading={ordersQuery.isLoading}>
            <Statistic
              title="Today's revenue"
              value={todaysRevenue}
              precision={0}
              prefix={<DollarOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={ordersQuery.isLoading}>
            <Statistic
              title="Today's orders"
              value={todaysOrders.length}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card loading={lowStockQuery.isLoading}>
            <Statistic
              title="Low-stock materials"
              value={lowStockQuery.data?.length ?? 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: (lowStockQuery.data?.length ?? 0) > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Revenue trend (last 14 days)">
            {revenueQuery.isLoading ? (
              <Spin />
            ) : revenueQuery.isError ? (
              <Alert type="warning" message="Could not load revenue report" showIcon />
            ) : (
              <Line
                data={revenueQuery.data?.daily ?? []}
                xField="date"
                yField="revenue"
                height={280}
                smooth
                point={{ size: 3 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Top products (last 14 days)">
            {topProductsQuery.isLoading ? (
              <Spin />
            ) : topProductsQuery.isError ? (
              <Alert type="warning" message="Could not load top products report" showIcon />
            ) : (
              <Column
                data={topProductsQuery.data ?? []}
                xField="productName"
                yField="totalQuantity"
                height={280}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
