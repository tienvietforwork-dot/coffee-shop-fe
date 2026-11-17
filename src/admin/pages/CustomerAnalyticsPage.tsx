import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, Col, DatePicker, Row, Statistic, Table, Tabs, Typography } from 'antd'
import { Column, Line } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { customerAnalyticsApi, type Spender } from '@/api/customerAnalytics'
import { errorMessage } from '@/api/client'
import { money } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { ServiceGate } from '../components/ServiceGate'

export function CustomerAnalyticsPage() {
  const { message } = App.useApp()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(179, 'day'), dayjs()])
  const [exporting, setExporting] = useState(false)
  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-analytics', from, to],
    queryFn: () => customerAnalyticsApi.report(from, to),
    retry: false,
  })
  async function exportReport() {
    try {
      setExporting(true)
      await customerAnalyticsApi.exportCsv(from, to)
      message.success('Đã xuất báo cáo CSV')
    } catch (e) {
      message.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }
  return <>
    <PageHeader title="Phân tích hành vi & tăng trưởng khách hàng" subtitle="Use case 94–98 · Phân tích theo đơn hoàn tất và nhóm khách hàng"
      extra={<><DatePicker.RangePicker value={range} allowClear={false} format="DD/MM/YYYY"
        onChange={v => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} />{' '}
        <Button type="primary" loading={exporting} disabled={!data} onClick={exportReport}>Xuất báo cáo CSV</Button></>} />
    <ServiceGate module="Thống kê" loading={isLoading} error={error}>
      {data && <>
        <Row gutter={[16,16]}>
          <Col xs={12} md={8}><Card><Statistic title="Đơn hàng hoàn tất (có khách)" value={data.orders} /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="Doanh thu từ khách định danh" value={money(data.revenue)} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="Giá trị trung bình / đơn" value={money(data.orders ? data.revenue/data.orders : 0)} /></Card></Col>
        </Row>
        <Tabs style={{marginTop:16}} items={[
          {key:'trends',label:'94. Xu hướng mua',children:<Card title="Đơn hàng & khách mua theo tháng">
            {data.trends.length ? <><Line height={270} data={data.trends.flatMap(r=>[
              {month:r.month, metric:'Số đơn', value:r.orders},
              {month:r.month, metric:'Khách mua', value:r.buyers},
            ])} xField="month" yField="value" colorField="metric" />
            <Table size="small" rowKey="month" dataSource={data.trends} pagination={false} columns={[
              {title:'Tháng',dataIndex:'month'}, {title:'Đơn',dataIndex:'orders'}, {title:'Khách mua',dataIndex:'buyers'},
              {title:'Doanh thu',dataIndex:'revenue',render:money},
              {title:'Giá trị TB/đơn',dataIndex:'avg_order_value',render:money},
            ]}/></> : <Typography.Text type="secondary">Chưa có đơn hoàn tất trong khoảng đã chọn.</Typography.Text>}
          </Card>},
          {key:'spending',label:'95. Chi tiêu khách',children:<Card title="Tối đa 500 khách có chi tiêu cao nhất">
            <Table<Spender> size="small" rowKey="customer_id" dataSource={data.spending} scroll={{x:750}} pagination={{pageSize:12}}
              columns={[{title:'Khách hàng',dataIndex:'customer_name'}, {title:'Điện thoại',dataIndex:'phone'},
                {title:'Đơn',dataIndex:'orders'}, {title:'Tổng chi',dataIndex:'total_spent',render:money},
                {title:'TB/đơn',dataIndex:'avg_order_value',render:money},
                {title:'Mua gần nhất',dataIndex:'last_order_at',render:(v:string)=>v?dayjs(v).format('DD/MM/YYYY'):''}]}/>
          </Card>},
          {key:'groups',label:'96. So sánh nhóm',children:<Card title="Hiệu quả theo nhóm CRM">
            {data.groups.length > 0 && <Column height={280} data={data.groups.map(g=>({name:g.group_name,value:Number(g.revenue)}))} xField="name" yField="value"/>}
            <Table size="small" rowKey="group_id" dataSource={data.groups} pagination={{pageSize:10}} scroll={{x:800}}
              columns={[{title:'Nhóm',dataIndex:'group_name'}, {title:'Thành viên',dataIndex:'members'},
                {title:'Khách mua',dataIndex:'buying_customers'}, {title:'Số đơn',dataIndex:'orders'},
                {title:'Doanh thu',dataIndex:'revenue',render:money}, {title:'TB/đơn',dataIndex:'avg_order_value',render:money}]}/>
            <Typography.Text type="secondary">Một khách có thể thuộc nhiều nhóm; doanh thu nhóm có thể trùng nhau.</Typography.Text>
          </Card>},
          {key:'growth',label:'97. Tăng trưởng',children:<Card title="Khách đăng ký mới theo tháng">
            {data.growth.length>0 && <Column height={280} data={data.growth.flatMap(g=>[
              {month:g.month,metric:'Đăng ký mới',value:g.new_customers},
              {month:g.month,metric:'Đã mua',value:g.converted_customers},
            ])} xField="month" yField="value" colorField="metric" group />}
            <Table size="small" rowKey="month" pagination={false} dataSource={data.growth} columns={[
              {title:'Tháng',dataIndex:'month'}, {title:'Khách mới',dataIndex:'new_customers'},
              {title:'Khách mới đã mua',dataIndex:'converted_customers'}]}/>
          </Card>},
        ]}/>
        <Typography.Paragraph type="secondary" style={{marginTop:10}}>{data.note}</Typography.Paragraph>
      </>}
    </ServiceGate>
  </>
}
