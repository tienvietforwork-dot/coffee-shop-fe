import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Card, Col, DatePicker, Row, Statistic, Table } from 'antd'
import { Line, Pie, Column } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { statsApi } from '@/api/stats'
import { ORDER_CHANNEL, money } from '@/lib/format'
import type { OrderChannel } from '@/api/types'
import { PageHeader } from '../components/PageHeader'
import { ServiceGate } from '../components/ServiceGate'

export function StatsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const [summary, revenue, top, channels, hours] = useQueries({
    queries: [
      { queryKey: ['stats-summary', from, to], queryFn: () => statsApi.summary(from, to), retry: false },
      { queryKey: ['stats-revenue', from, to], queryFn: () => statsApi.revenue(from, to), retry: false },
      { queryKey: ['stats-top', from, to], queryFn: () => statsApi.topCoffees(from, to), retry: false },
      { queryKey: ['stats-channels', from, to], queryFn: () => statsApi.channels(from, to), retry: false },
      { queryKey: ['stats-hours', from, to], queryFn: () => statsApi.hours(from, to), retry: false },
    ],
  })
  const s = summary.data
  return (
    <>
      <PageHeader title="Thống kê doanh thu" subtitle="Doanh thu, sản phẩm bán chạy, kênh đặt hàng, khung giờ cao điểm"
        extra={<DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />} />
      <ServiceGate module="Thống kê" loading={summary.isLoading} error={summary.error}>
        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}><Card><Statistic title="Doanh thu" value={money(s?.revenue)} /></Card></Col>
          <Col xs={12} lg={6}><Card><Statistic title="Số đơn" value={s?.orders} /></Card></Col>
          <Col xs={12} lg={6}><Card><Statistic title="Giá trị TB / đơn" value={money(s?.avgOrderValue)} /></Card></Col>
          <Col xs={12} lg={6}><Card><Statistic title="Tỷ lệ hủy" value={(s?.cancelRate ?? 0) * 100} precision={1} suffix="%" /></Card></Col>
        </Row>
        <Card title="Doanh thu theo ngày" style={{ marginTop: 16 }}>
          <Line height={280} data={revenue.data ?? []} xField="date" yField="revenue" point={{ size: 3 }} />
        </Card>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={8}>
            <Card title="Theo kênh đặt hàng">
              <Pie height={260} data={(channels.data ?? []).map((c) => ({ ...c, label: ORDER_CHANNEL[c.channel as OrderChannel]?.text ?? c.channel }))} angleField="revenue" colorField="label" innerRadius={0.6} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card title="Khung giờ cao điểm">
              <Column height={260} data={(hours.data ?? []).map((h) => ({ ...h, hour: `${h.hour}h` }))} xField="hour" yField="orders" />
            </Card>
          </Col>
        </Row>
        <Card title="Cà phê bán chạy" style={{ marginTop: 16 }}>
          <Table size="small" rowKey="coffeeId" pagination={false} dataSource={top.data ?? []}
            columns={[{ title: '#', render: (_, __, i) => i + 1, width: 50 }, { title: 'Cà phê', dataIndex: 'name' }, { title: 'Số ly', dataIndex: 'quantity' }, { title: 'Doanh thu', dataIndex: 'revenue', render: money }]} />
        </Card>
      </ServiceGate>
    </>
  )
}
