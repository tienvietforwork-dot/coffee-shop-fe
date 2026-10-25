import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Row, Col, Statistic, Table, Tabs, Typography, Alert } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { merchandisingAnalyticsApi, type AnalyticsRow } from '@/api/merchandisingAnalytics'
import { errorMessage } from '@/api/client'
import { PageHeader } from '../components/PageHeader'
import { ServiceGate } from '../components/ServiceGate'

const money = (v: unknown) => `${Number(v ?? 0).toLocaleString('vi-VN')}đ`
const n = (v: unknown) => Number(v ?? 0)
function dataTable(rows: AnalyticsRow[], fields: { title: string; dataIndex: string; money?: boolean }[], id: string) {
    return <Table<AnalyticsRow> rowKey={r => String(r[id])} dataSource={rows} size="small" pagination={{ pageSize: 8 }} scroll={{ x: 700 }} columns={fields.map(f => ({ title: f.title, dataIndex: f.dataIndex, render: (v: unknown) => f.money ? money(v) : String(v ?? 0) }))} />
}
export function MerchandisingAnalyticsPage() {
    const { message } = App.useApp()
    const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
    const [exporting, setExporting] = useState(false)
    const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD')
    const { data, error, isLoading } = useQuery({ queryKey: ['merch-analytics', from, to], queryFn: () => merchandisingAnalyticsApi.report(from, to), retry: false })
    async function exportCsv() { try { setExporting(true); await merchandisingAnalyticsApi.exportCsv(from, to); message.success('Đã xuất CSV') } catch (e) { message.error(errorMessage(e)) } finally { setExporting(false) } }
    const common = [{ title: 'Quy tắc', dataIndex: 'rule_name' }, { title: 'Hiển thị', dataIndex: 'impressions' }, { title: 'Click', dataIndex: 'clicks' }]
    const rate = (r: AnalyticsRow, key: string) => n(r.impressions) ? `${(n(r[key]) / n(r.impressions) * 100).toFixed(1)}%` : '—'
    return <><PageHeader title="Merchandising Analytics" subtitle="Đánh giá trưng bày, combo và các sự kiện tương tác (dữ liệu thực, không suy diễn doanh thu)" extra={<><DatePicker.RangePicker value={range} allowClear={false} format="DD/MM/YYYY" onChange={v => { if (v?.[0] && v[1]) setRange([v[0], v[1]]) }} /> <Button type="primary" loading={exporting} disabled={!data} onClick={exportCsv}>Xuất CSV</Button></>} /><ServiceGate module="Thống kê" loading={isLoading} error={error}>{data && <><Row gutter={[12, 12]}><Col xs={24} md={8}><Card><Statistic title="Đơn hoàn tất" value={n(data.orders.orders)} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Doanh thu đơn hoàn tất" value={money(data.orders.revenue)} /></Card></Col><Col xs={24} md={8}><Card><Statistic title="Giá trị đơn trung bình" value={money(data.orders.aov)} /></Card></Col></Row><Alert style={{ margin: '14px 0' }} type="info" showIcon message="Phạm vi đo lường" description={data.note} /><Tabs items={[
        { key: 'products', label: '1–4. Sản phẩm & bán hàng', children: <Card title="Sản phẩm bán được · chưa có lượt xem/click/add-to-cart theo placement">{dataTable(data.products, [{ title: 'Sản phẩm', dataIndex: 'coffee_name' }, { title: 'Số lượng', dataIndex: 'units_sold' }, { title: 'Đơn hoàn tất', dataIndex: 'completed_orders' }, { title: 'Doanh thu dòng sản phẩm', dataIndex: 'line_revenue', money: true }], 'coffee_id')}</Card> },
        { key: 'bundle', label: '5. Combo', children: <Card title="Combo đã mua trong đơn hoàn tất">{dataTable(data.bundles, [{ title: 'Combo', dataIndex: 'bundle_name' }, { title: 'Số lượng bán', dataIndex: 'units_sold' }, { title: 'Doanh thu', dataIndex: 'revenue', money: true }], 'bundle_id')}</Card> },
        { key: 'cross', label: '6. Cross-sell', children: <Card title="Hiển thị và click (chưa có conversion mua hàng)"><Table rowKey="rule_id" dataSource={data.crossSell} size="small" columns={[...common, { title: 'CTR', render: (_, r) => rate(r, 'clicks') }]} pagination={{ pageSize: 8 }} /></Card> },
        { key: 'upsell', label: '7. Upsell', children: <Card title="Chọn nâng cấp, không đồng nghĩa thanh toán"><Table rowKey="rule_id" dataSource={data.upsell} size="small" columns={[{ title: 'Quy tắc', dataIndex: 'rule_name' }, { title: 'Hiển thị', dataIndex: 'impressions' }, { title: 'Chấp nhận', dataIndex: 'accepts' }, { title: 'Accept rate', render: (_, r) => rate(r, 'accepts') }]} pagination={{ pageSize: 8 }} /></Card> },
        { key: 'recommend', label: '9. Recommendation', children: <Card title="So sánh mức tương tác giữa các quy tắc đề xuất"><Table rowKey="rule_id" dataSource={data.recommendations} size="small" columns={[...common, { title: 'Thêm giỏ (đã ghi nhận)', dataIndex: 'add_to_cart' }, { title: 'CTR', render: (_, r) => rate(r, 'clicks') }]} pagination={{ pageSize: 8 }} /></Card> },
        { key: 'limits', label: '8–10. AOV, đối chiếu & xuất', children: <Card><Typography.Paragraph>Giá trị đơn trung bình toàn cửa hàng được hiển thị ở đầu trang. Để so sánh AOV trước/sau triển khai hay doanh thu gia tăng theo chiến lược, cần gắn ID chiến lược/impression vào giỏ và đơn hàng hoàn tất. Hiện chưa thể xác nhận các phép quy kết này.</Typography.Paragraph><Typography.Paragraph>Chọn khoảng ngày và bấm <b>Xuất CSV</b> để tải số liệu nguồn hiện có phục vụ đối chiếu.</Typography.Paragraph></Card> }
    ]} /></>}</ServiceGate></>
}
