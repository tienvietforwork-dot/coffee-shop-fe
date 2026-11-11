import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Col, DatePicker, InputNumber, Row, Segmented, Space, Statistic, Table } from 'antd'
import { Column, Bar, Line } from '@ant-design/charts'
import type { Dayjs } from 'dayjs'
import { crmApi, type DateRange } from '@/api/crm'
import { date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'

const month = (v: string) => v.slice(0, 7)

export function InsightsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [inactiveDays, setInactiveDays] = useState(90)
  const [sortBy, setSortBy] = useState<'spend' | 'orders' | 'average'>('spend')
  const [dimension, setDimension] = useState<'coffee' | 'category'>('coffee')
  const r: DateRange = range ? { fromDate: range[0].format('YYYY-MM-DD'), toDate: range[1].format('YYYY-MM-DD') } : {}
  const rk = [r.fromDate, r.toDate]

  const growth = useQuery({ queryKey: ['crm-ins-growth', ...rk], queryFn: () => crmApi.customerGrowth(r), retry: false })
  const sales = useQuery({ queryKey: ['crm-ins-sales', ...rk], queryFn: () => crmApi.salesTrends({ ...r, period: 'month' }), retry: false })
  const top = useQuery({ queryKey: ['crm-ins-top', sortBy, ...rk], queryFn: () => crmApi.topCustomers({ ...r, sortBy, limit: 10 }), retry: false })
  const inactiveCount = useQuery({ queryKey: ['crm-ins-inactive-count', inactiveDays], queryFn: () => crmApi.inactiveCount(inactiveDays), retry: false })
  const inactive = useQuery({ queryKey: ['crm-ins-inactive', inactiveDays], queryFn: () => crmApi.inactiveCustomers({ inactiveDays, limit: 10 }), retry: false })
  const affinity = useQuery({ queryKey: ['crm-ins-affinity', dimension, ...rk], queryFn: () => crmApi.productAffinity({ ...r, dimension, limit: 10 }), retry: false })
  const fbTrend = useQuery({ queryKey: ['crm-ins-fb', ...rk], queryFn: () => crmApi.feedbackTrends({ ...r, period: 'month' }), retry: false })
  const complaints = useQuery({ queryKey: ['crm-ins-complaints', ...rk], queryFn: () => crmApi.repeatedComplaints(r), retry: false })

  const g = growth.data ?? []
  const s = sales.data ?? []
  const sum = <T,>(rows: T[], f: (x: T) => number) => rows.reduce((a, x) => a + Number(f(x) ?? 0), 0)

  return (
    <>
      <PageHeader title="Phân tích khách hàng" subtitle="Xu hướng, thói quen, giá trị khách hàng, nguy cơ rời bỏ"
        extra={<DatePicker.RangePicker format="DD/MM/YYYY" value={range} onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)} placeholder={['Từ ngày', 'Đến ngày']} />} />
      <ServiceGate module="CRM" loading={growth.isLoading} error={growth.error}>
        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}><Card><Statistic title="Hồ sơ mới" value={sum(g, (x) => x.newProfiles)} /></Card></Col>
          <Col xs={12} lg={6}><Card><Statistic title="Khách mua lần đầu" value={sum(g, (x) => x.firstTimeBuyers)} /></Card></Col>
          <Col xs={12} lg={6}><Card><Statistic title="Doanh thu từ khách" value={money(sum(s, (x) => x.revenue))} /></Card></Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title={`Không mua ≥ ${inactiveDays} ngày`} value={inactiveCount.data ?? '—'} valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Tăng trưởng khách hàng">
              <Column height={280} data={g.flatMap((x) => [
                { month: month(x.month), type: 'Hồ sơ mới', value: x.newProfiles },
                { month: month(x.month), type: 'Khách hoạt động', value: x.activeCustomers },
                { month: month(x.month), type: 'Khách quay lại', value: x.returningCustomers },
              ])} xField="month" yField="value" colorField="type" group />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={dimension === 'coffee' ? 'Cà phê được yêu thích' : 'Danh mục được yêu thích'}
              extra={<Segmented size="small" value={dimension} onChange={(v) => setDimension(v as 'coffee' | 'category')} options={[{ value: 'coffee', label: 'Món' }, { value: 'category', label: 'Danh mục' }]} />}>
              <ServiceGate module="CRM" loading={affinity.isLoading} error={affinity.error}>
                <Bar height={280} data={affinity.data ?? []} xField="itemName" yField="customerCount" />
              </ServiceGate>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Doanh thu & đơn theo tháng">
              <ServiceGate module="CRM" loading={sales.isLoading} error={sales.error}>
                <Line height={260} data={s.map((x) => ({ month: month(x.month), value: Number(x.revenue) }))} xField="month" yField="value" />
              </ServiceGate>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Phản hồi theo tháng">
              <ServiceGate module="CRM" loading={fbTrend.isLoading} error={fbTrend.error}>
                <Column height={260} data={(fbTrend.data ?? []).flatMap((x) => [
                  { month: month(x.periodStart), type: 'Khiếu nại', value: x.complaints },
                  { month: month(x.periodStart), type: 'Góp ý', value: x.suggestions },
                  { month: month(x.periodStart), type: 'Khen ngợi', value: x.praises },
                ])} xField="month" yField="value" colorField="type" stack />
              </ServiceGate>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Khách giá trị cao nhất"
              extra={<Segmented size="small" value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)}
                options={[{ value: 'spend', label: 'Chi tiêu' }, { value: 'orders', label: 'Số đơn' }, { value: 'average', label: 'TB/đơn' }]} />}>
              <ServiceGate module="CRM" loading={top.isLoading} error={top.error}>
                <Table size="small" rowKey="customerId" pagination={false} dataSource={top.data ?? []}
                  columns={[
                    { title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Số đơn', dataIndex: 'totalOrders' },
                    { title: 'Chi tiêu', dataIndex: 'totalSpend', render: money }, { title: 'TB/đơn', dataIndex: 'averageOrderValue', render: money },
                  ]} />
              </ServiceGate>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Khách có nguy cơ rời bỏ"
              extra={<Space size={4}>Không mua ≥<InputNumber size="small" min={1} value={inactiveDays} onChange={(v) => v && setInactiveDays(v)} style={{ width: 70 }} />ngày</Space>}>
              <ServiceGate module="CRM" loading={inactive.isLoading} error={inactive.error}>
                <Table size="small" rowKey="customerId" pagination={false} dataSource={inactive.data ?? []}
                  columns={[
                    { title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: (v) => (v ? date(v) : 'Chưa từng mua') },
                    { title: 'Chi tiêu', dataIndex: 'totalSpend', render: money },
                  ]} />
              </ServiceGate>
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="Chủ đề khiếu nại lặp lại">
              <ServiceGate module="CRM" loading={complaints.isLoading} error={complaints.error}>
                <Table size="small" rowKey="topic" pagination={false} dataSource={complaints.data ?? []}
                  columns={[{ title: 'Chủ đề', dataIndex: 'topic' }, { title: 'Số khiếu nại', dataIndex: 'complaintCount' }, { title: 'Số khách', dataIndex: 'customerCount' }]} />
              </ServiceGate>
            </Card>
          </Col>
        </Row>
      </ServiceGate>
    </>
  )
}
