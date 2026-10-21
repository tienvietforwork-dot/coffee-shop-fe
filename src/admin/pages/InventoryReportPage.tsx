import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Input, Row, Select, Space, Statistic, Table } from 'antd'
import { Column, Line } from '@ant-design/charts'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { InventoryReportRow } from '@/api/types'
import { money, num } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

/**
 * Báo cáo tổng hợp xuất – nhập – tồn nguyên liệu: tồn đầu kỳ + nhập (mua, chế biến, kiểm kê thừa)
 * − xuất (bán, xuất chế biến, hủy, trả NCC, khác) = tồn cuối kỳ, theo số lượng và giá trị lô. Kèm biểu đồ tiêu hao
 * và tồn chốt cuối ngày (job 23:55).
 */
export function InventoryReportPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
  const { data, isLoading } = useQuery({ queryKey: ['inventory-report', params], queryFn: () => coreApi.inventoryReport(params) })
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = (data?.rows ?? []).filter((r) => !q || r.materialName.toLowerCase().includes(q))
  const [materialId, setMaterialId] = useState<number>()
  const { data: daily = [] } = useQuery({ queryKey: ['inventory-daily', params, materialId], enabled: !!materialId,
    queryFn: () => coreApi.inventoryDaily({ ...params, materialId }) })
  const close = useAction(coreApi.closeInventoryDay, [['inventory-daily']], 'Đã chốt tồn hôm nay')

  const topUse = [...rows].sort((a, b) => b.outValue - a.outValue).slice(0, 10)
    .flatMap((r) => [
      { name: r.materialName, type: 'Bán', value: r.outSale },
      { name: r.materialName, type: 'Chế biến', value: r.outProduction },
      { name: r.materialName, type: 'Hủy', value: r.outDisposal },
      { name: r.materialName, type: 'Khác / trả NCC', value: r.outOther + r.outReturn },
    ].filter((x) => x.value > 0))
  const q2 = (v: number, r: InventoryReportRow) => (v ? `${num(v)}` : <span className="a-muted">·</span>) as React.ReactNode
  const unit = (r: InventoryReportRow) => <span className="a-muted small"> {r.unit}</span>

  return (
    <>
      <PageHeader title="Xuất – nhập – tồn" subtitle="Tồn đầu kỳ + nhập − xuất = tồn cuối kỳ · giá trị theo giá vốn từng lô"
        extra={<Space>
          <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
          <Button icon={<DownloadOutlined />} onClick={() => coreApi.inventoryReportExcel(params)}>Xuất Excel</Button>
        </Space>} />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Tồn đầu kỳ" value={data?.openingValue ?? 0} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Nhập trong kỳ" value={data?.inValue ?? 0} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Xuất trong kỳ" value={data?.outValue ?? 0} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Tồn cuối kỳ" value={data?.closingValue ?? 0} formatter={(v) => <b>{money(Number(v))}</b>} /></Card></Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Tiêu hao lớn nhất (số lượng theo đơn vị nguyên liệu)">
            <Column height={280} data={topUse} xField="name" yField="value" colorField="type" stack />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Tồn chốt cuối ngày" extra={<Button size="small" loading={close.isPending} onClick={() => close.mutate(undefined)}>Chốt tồn hôm nay</Button>}>
            <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn nguyên liệu" style={{ width: '100%', marginBottom: 8 }}
              value={materialId} onChange={setMaterialId} options={(data?.rows ?? []).map((r) => ({ value: r.materialId, label: r.materialName }))} />
            {materialId ? <Line height={230} data={daily} xField="date" yField="quantity" point={{ size: 3 }} />
              : <div className="a-muted" style={{ padding: 40, textAlign: 'center' }}>Chọn nguyên liệu để xem tồn theo ngày</div>}
          </Card>
        </Col>
      </Row>
      <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm nguyên liệu" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, marginBottom: 12 }} />
      <Table<InventoryReportRow> rowKey="materialId" size="small" loading={isLoading} dataSource={rows} scroll={{ x: 1400 }} pagination={{ pageSize: 50 }}
        columns={[
          { title: 'Nguyên liệu', dataIndex: 'materialName', fixed: 'left', width: 180, render: (v, r) => <><b>{v}</b>{r.kind === 'PREPARED' && <div className="a-muted small">chế biến</div>}</> },
          { title: 'Tồn đầu', children: [
            { title: 'SL', render: (_, r) => <>{num(r.openingQuantity)}{unit(r)}</>, align: 'right' },
            { title: 'Giá trị', dataIndex: 'openingValue', render: money, align: 'right' },
          ] },
          { title: 'Nhập', children: [
            { title: 'Mua', render: (_, r) => q2(r.inPurchase, r), align: 'right' },
            { title: 'Chế biến', render: (_, r) => q2(r.inProduce, r), align: 'right' },
            { title: 'KK thừa', render: (_, r) => q2(r.inAdjust, r), align: 'right' },
            { title: 'Giá trị', dataIndex: 'inValue', render: money, align: 'right' },
          ] },
          { title: 'Xuất', children: [
            { title: 'Bán', render: (_, r) => q2(r.outSale, r), align: 'right' },
            { title: 'Chế biến', render: (_, r) => q2(r.outProduction, r), align: 'right' },
            { title: 'Hủy', render: (_, r) => q2(r.outDisposal, r), align: 'right' },
            { title: 'Trả NCC', render: (_, r) => q2(r.outReturn, r), align: 'right' },
            { title: 'Khác', render: (_, r) => q2(r.outOther, r), align: 'right' },
            { title: 'Giá trị', dataIndex: 'outValue', render: money, align: 'right' },
          ] },
          { title: 'Tồn cuối', children: [
            { title: 'SL', render: (_, r) => <span className={r.closingQuantity < r.minStock ? 'a-limit' : ''}>{num(r.closingQuantity)}{unit(r)}</span>, align: 'right' },
            { title: 'Giá trị', dataIndex: 'closingValue', render: (v) => <b>{money(v)}</b>, align: 'right' },
          ] },
        ]} />
    </>
  )
}
