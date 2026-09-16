import { useState } from 'react'
import { Typography, DatePicker, Space, Table, Card, Row, Col, Button } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Line } from '@ant-design/charts'
import dayjs, { type Dayjs } from 'dayjs'
import { getRevenueReport, getTopProducts } from '@/api/reports'

const { Title } = Typography
const { RangePicker } = DatePicker

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])

  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')

  const revenueQuery = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => getRevenueReport({ from, to }),
  })
  const topProductsQuery = useQuery({
    queryKey: ['reports', 'top-products', from, to],
    queryFn: () => getTopProducts({ from, to, limit: 20 }),
  })

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Reports</Title>
        <RangePicker
          value={range}
          onChange={(values) => {
            if (values && values[0] && values[1]) {
              setRange([values[0], values[1]])
            }
          }}
        />
      </Space>

      <Card title="Revenue by date" style={{ marginBottom: 16 }}>
        <Line
          data={revenueQuery.data?.daily ?? []}
          xField="date"
          yField="revenue"
          height={280}
          smooth
          loading={revenueQuery.isLoading}
        />
      </Card>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title="Top-selling products"
            extra={
              <Button
                icon={<DownloadOutlined />}
                onClick={() =>
                  downloadCsv(`top-products-${from}-to-${to}.csv`, (topProductsQuery.data ?? []) as any)
                }
              >
                Export CSV
              </Button>
            }
          >
            <Table
              rowKey="productId"
              loading={topProductsQuery.isLoading}
              dataSource={topProductsQuery.data}
              columns={[
                { title: 'Product', dataIndex: 'productName' },
                { title: 'Quantity sold', dataIndex: 'totalQuantity' },
                {
                  title: 'Revenue',
                  dataIndex: 'totalRevenue',
                  render: (v: number) => v.toLocaleString('vi-VN') + ' ₫',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
