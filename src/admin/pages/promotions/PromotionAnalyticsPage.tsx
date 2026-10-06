import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Col, DatePicker, Row, Statistic, Table, Tag } from 'antd'
import { Column } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { promotionsApi } from '@/api/promotions'
import { money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { PROMO_STATUS } from './PromotionsPage'

export function PromotionAnalyticsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
  const { data, isLoading, error } = useQuery({ queryKey: ['promo-analytics', from, to], queryFn: () => promotionsApi.analytics(from, to), retry: false })
  return (
    <>
      <PageHeader title="Hiệu quả khuyến mãi" subtitle="Lượt sử dụng, doanh thu, tổng tiền giảm, ROI và so sánh các đợt"
        extra={<DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />} />
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        {data && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={12} lg={6}><Card><Statistic title="Voucher phát hành" value={data.vouchers.issued} /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="Tỷ lệ sử dụng" value={data.vouchers.usageRate * 100} precision={1} suffix="%" /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="Tổng tiền giảm (voucher)" value={money(data.vouchers.discountTotal)} /></Card></Col>
              <Col xs={12} lg={6}><Card><Statistic title="TB / đơn (không KM)" value={money(data.baseline.avgOrderValue)} /></Card></Col>
            </Row>
            <Card title="So sánh các đợt giảm giá" style={{ marginTop: 16 }}>
              <Column height={260} data={data.promotions.flatMap((p) => [{ name: p.name, type: 'Doanh thu', value: p.revenue }, { name: p.name, type: 'Tiền giảm', value: p.discountTotal }])}
                xField="name" yField="value" colorField="type" group />
              <Table style={{ marginTop: 16 }} size="small" rowKey="id" pagination={false} dataSource={data.promotions}
                columns={[
                  { title: 'Đợt', dataIndex: 'name' },
                  { title: 'Trạng thái', render: (_, p) => <Tag color={PROMO_STATUS[p.status].c}>{PROMO_STATUS[p.status].t}</Tag> },
                  { title: 'Số đơn', dataIndex: 'orders' },
                  { title: 'Doanh thu', dataIndex: 'revenue', render: money },
                  { title: 'Tiền giảm', dataIndex: 'discountTotal', render: money },
                  { title: 'TB / đơn', dataIndex: 'avgOrderValue', render: money },
                  { title: 'ROI', dataIndex: 'roi', render: (v) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`) },
                ]} />
            </Card>
          </>
        )}
      </ServiceGate>
    </>
  )
}
