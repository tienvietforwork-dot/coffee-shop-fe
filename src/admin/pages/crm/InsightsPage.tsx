import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tabs, Typography, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { Column, Bar } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { crmApi, crmFeedbackLabel } from '@/api/crm'
import { date, dateTime, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'

export function InsightsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(11, 'month').startOf('month'), dayjs()])
  const fromDate = range[0].format('YYYY-MM-DD')
  const toDate = range[1].format('YYYY-MM-DD')
  const { data, isLoading, error } = useQuery({ queryKey: ['crm-insights', fromDate, toDate], queryFn: () => crmApi.insights(fromDate, toDate), retry: false })
  const { data: groups = [] } = useQuery({ queryKey: ['crm-groups'], queryFn: crmApi.groups, retry: false })
  const [groupIds, setGroupIds] = useState<number[]>([])
  const comparison = useQuery({
    queryKey: ['crm-group-comparison', groupIds, fromDate, toDate],
    queryFn: () => crmApi.compareGroups(groupIds, fromDate, toDate),
    enabled: groupIds.length >= 2,
    retry: false,
  })

  const growthData = data?.growth.flatMap((g) => [
    { month: g.month, type: 'Hồ sơ mới', value: g.newCustomers },
    { month: g.month, type: 'Khách mua', value: g.activeCustomers },
    { month: g.month, type: 'Mua lần đầu', value: g.firstTimeBuyers },
    { month: g.month, type: 'Mua quay lại', value: g.returningCustomers },
  ]) ?? []
  const feedbackTrendData = data?.feedbackTrends.flatMap((r) => [
    { period: dayjs(r.periodStart).format('YYYY-MM'), type: 'Khiếu nại', value: r.complaints },
    { period: dayjs(r.periodStart).format('YYYY-MM'), type: 'Góp ý', value: r.suggestions },
    { period: dayjs(r.periodStart).format('YYYY-MM'), type: 'Khen ngợi', value: r.praises },
  ]) ?? []

  const comparisonCard = (
    <Card title="So sánh nhóm khách hàng trong kỳ đã chọn">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select mode="multiple" allowClear value={groupIds} onChange={(ids: number[]) => {
          if (ids.length > 20) { message.warning('Chỉ so sánh tối đa 20 nhóm'); return }
          setGroupIds(ids)
        }}
          placeholder="Chọn từ 2 đến 20 nhóm để so sánh" style={{ width: '100%' }} maxTagCount="responsive"
          options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        {groupIds.length < 2
          ? <Typography.Text type="secondary">Chọn ít nhất hai nhóm để xem thống kê mua hàng, tương tác và phản hồi.</Typography.Text>
          : <Table size="small" rowKey="groupId" loading={comparison.isLoading} dataSource={comparison.data ?? []} pagination={false}
              columns={[{ title: 'Nhóm', dataIndex: 'groupName' }, { title: 'Số thành viên', dataIndex: 'memberCount' }, { title: 'Chi tiêu', dataIndex: 'totalSpend', render: money }, { title: 'Số đơn', dataIndex: 'totalOrders' }, { title: 'TB / đơn', dataIndex: 'averageOrderValue', render: money }, { title: 'Danh mục yêu thích', dataIndex: 'favoriteCategory', render: (v) => v || '—' }, { title: 'Cà phê yêu thích', dataIndex: 'favoriteCoffee', render: (v) => v || '—' }, { title: 'Tương tác', dataIndex: 'interactionCount' }, { title: 'Phản hồi', dataIndex: 'feedbackCount' }]} />}
      </Space>
    </Card>
  )

  return (
    <>
      <PageHeader title="Phân tích khách hàng" subtitle="Tăng trưởng, hành vi mua, giá trị, sở thích và nguy cơ rời bỏ"
        extra={<Space wrap><DatePicker.RangePicker value={range} onChange={(v) => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} format="DD/MM/YYYY" /><Button icon={<DownloadOutlined />} disabled={!data} onClick={() => { if (data) crmApi.exportInsightsCsv(data, comparison.data ?? []); else message.error('Chưa có dữ liệu để xuất') }}>Xuất toàn bộ báo cáo CSV</Button></Space>} />
      <ServiceGate module="CRM" loading={isLoading} error={error}>
        {data && <Tabs items={[
          {
            key: 'overview', label: 'Tổng quan', children: <>
              <Row gutter={[16, 16]}>
                <Col xs={12} lg={6}><Card><Statistic title="Tổng hồ sơ khách hàng" value={data.totalCustomers} /></Card></Col>
                <Col xs={12} lg={6}><Card><Statistic title="Khách mua trong kỳ" value={data.activeInPeriod} /></Card></Col>
                <Col xs={12} lg={6}><Card><Statistic title="Hồ sơ mới trong kỳ" value={data.newInPeriod} /></Card></Col>
                <Col xs={12} lg={6}><Card><Statistic title="Chưa mua trong ít nhất 90 ngày" value={data.churnRisk} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              </Row>
              <Card title="Giá trị và mức độ gắn bó của khách hàng · toàn thời gian" style={{ marginTop: 16 }}>
                <Table size="small" rowKey="id" pagination={{ pageSize: 10 }} dataSource={data.customerValue}
                  columns={[
                    { title: 'Khách', render: (_, c) => c.fullName || c.phone },
                    { title: 'Tổng chi tiêu', dataIndex: 'totalSpent', render: money },
                    { title: 'Số đơn', dataIndex: 'orderCount' },
                    { title: 'TB / đơn', dataIndex: 'averageOrderValue', render: money },
                    { title: 'Điểm', dataIndex: 'loyaltyPoints' },
                    { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: (v) => v ? dateTime(v) : 'Chưa mua' },
                    { title: 'Ngày chưa mua', dataIndex: 'daysSinceLastOrder', render: (v) => v ?? '—' },
                  ]} />
              </Card>
            </>,
          },
          {
            key: 'behavior', label: 'Hành vi mua', children: <Row gutter={[16, 16]}>
              <Col xs={24} xl={8}><Card title="Khách chi tiêu cao"><Table size="small" rowKey="id" pagination={false} dataSource={data.topSpenders}
                columns={[{ title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Đơn', dataIndex: 'orderCount' }, { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money }]} /></Card></Col>
              <Col xs={24} xl={8}><Card title="Khách mua thường xuyên"><Table size="small" rowKey="id" pagination={false} dataSource={data.frequentBuyers}
                columns={[{ title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Đơn', dataIndex: 'orderCount' }, { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money }]} /></Card></Col>
              <Col xs={24} xl={8}><Card title="Không mua trong 90 ngày hoặc chưa từng mua · tối đa 50 khách"><Table size="small" rowKey="id" pagination={false} dataSource={data.atRisk}
                columns={[{ title: 'Khách', render: (_, c) => c.fullName || c.phone }, { title: 'Mua gần nhất', dataIndex: 'lastOrderAt', render: (v) => v ? date(v) : 'Chưa mua' }, { title: 'Chi tiêu', dataIndex: 'totalSpent', render: money }]} /></Card></Col>
            </Row>,
          },
          {
            key: 'feedback', label: 'Phản hồi & khiếu nại', children: <Row gutter={[16, 16]}>
              <Col xs={24}><Card title="Xu hướng phản hồi theo tháng"><Column height={280} data={feedbackTrendData} xField="period" yField="value" colorField="type" group /></Card></Col>
              <Col xs={24} lg={12}><Card title="Tổng hợp phản hồi trong kỳ"><Table size="small" rowKey={(r) => `${r.issueType}-${r.category}-${r.sentiment}-${r.status}`} pagination={{ pageSize: 8 }} dataSource={data.feedbackSummary}
                columns={[{ title: 'Loại vấn đề', dataIndex: 'issueType', render: (v) => crmFeedbackLabel('issueType', v) }, { title: 'Phân loại', dataIndex: 'category', render: (v) => crmFeedbackLabel('category', v) }, { title: 'Cảm xúc', dataIndex: 'sentiment', render: (v) => crmFeedbackLabel('sentiment', v) }, { title: 'Trạng thái', dataIndex: 'status', render: (v) => crmFeedbackLabel('status', v) }, { title: 'Số phản hồi', dataIndex: 'feedbackCount' }, { title: 'Số khách', dataIndex: 'customerCount' }]} /></Card></Col>
              <Col xs={24} lg={12}><Card title="Chủ đề khiếu nại lặp lại trong kỳ"><Table size="small" rowKey="topic" pagination={{ pageSize: 8 }} dataSource={data.repeatedComplaints}
                columns={[{ title: 'Chủ đề', dataIndex: 'topic', render: (v) => v || 'Chưa phân loại' }, { title: 'Số khiếu nại', dataIndex: 'complaintCount' }, { title: 'Số khách', dataIndex: 'customerCount' }]} /></Card></Col>
            </Row>,
          },
          { key: 'groups', label: 'So sánh nhóm', children: comparisonCard },
          {
            key: 'charts', label: 'Biểu đồ', children: <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}><Card title="Tăng trưởng và hành vi mua theo tháng"><Column height={300} data={growthData} xField="month" yField="value" colorField="type" group /></Card></Col>
              {/* <Col xs={24} lg={10}><Card title="Xu hướng doanh thu theo tháng">
                <Column height={300} data={data.salesTrends.map((s) => ({ month: s.month, revenue: s.revenue }))} xField="month" yField="revenue" />
                <Table size="small" rowKey="month" dataSource={data.salesTrends} pagination={false} columns={[{ title: 'Tháng', dataIndex: 'month', render: date }, { title: 'Doanh thu', dataIndex: 'revenue', render: money }, { title: 'Đơn', dataIndex: 'totalOrders' }, { title: 'Khách', dataIndex: 'activeCustomers' }]} />
              </Card></Col> */}
              <Col xs={24} lg={12}><Card title="Cà phê được yêu thích"><Bar height={260} data={data.favoriteCoffees} xField="name" yField="customers" /></Card></Col>
              <Col xs={24} lg={12}><Card title="Danh mục được yêu thích"><Bar height={260} data={data.favoriteCategories} xField="name" yField="customers" /></Card></Col>
            </Row>,
          },
        ]} />}
      </ServiceGate>
    </>
  )
}
