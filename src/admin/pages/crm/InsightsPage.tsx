import { useQuery } from '@tanstack/react-query'
import { Card, Col, Row, Statistic, Table } from 'antd'
import { Column, Bar } from '@ant-design/charts'
import { crmApi } from '@/api/crm'
import { date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'

export function InsightsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-insights'], queryFn: crmApi.insights, retry: false })
  return (
    <>
      <PageHeader title="Phân tích khách hàng" subtitle="Xu hướng, thói quen, giá trị khách hàng, nguy cơ rời bỏ" />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        {data && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}><Card><Statistic title="Tổng khách hàng" value={data.totalCustomers} /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="Hoạt động (30 ngày)" value={data.activeCustomers} /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="Khách mới tháng này" value={data.newThisMonth} /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="Nguy cơ rời bỏ" value={data.churnRisk} valueStyle={{ color: '#cf1322' }} /></Card></Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} lg={14}>
                <Card title="Tăng trưởng khách hàng">
                  <Column height={280} data={data.growth.flatMap((g) => [{ month: g.month, type: 'Khách mới', value: g.newCustomers }, { month: g.month, type: 'Khách hoạt động', value: g.activeCustomers }])}
                    xField="month" yField="value" colorField="type" group />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="Cà phê được yêu thích">
                  <Bar height={280} data={data.favoriteCoffees} xField="name" yField="customers" />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Khách chi tiêu cao nhất">
                  <Table size="small" rowKey="id" pagination={false} dataSource={data.topSpenders}
                    columns={[{ title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Số đơn', dataIndex: 'orderCount' }, { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money }]} />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Khách có nguy cơ rời bỏ">
                  <Table size="small" rowKey="id" pagination={false} dataSource={data.atRisk}
                    columns={[{ title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: date }, { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money }]} />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </ServiceGate>
    </>
  )
}
