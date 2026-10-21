import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { PrinterOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Invoice, InvoiceBuyer } from '@/api/types'
import { dateTime, money, num } from '@/lib/format'
import { printInvoice } from '@/lib/purchase'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { InvoiceBuyerFields } from '../components/InvoiceBuyerForm'

const STATUS: Record<Invoice['status'], { text: string; color: string }> = {
  PENDING: { text: 'Chờ phát hành', color: 'gold' }, ISSUED: { text: 'Đã phát hành', color: 'green' },
  FAILED: { text: 'Phát hành lỗi', color: 'red' }, REPLACED: { text: 'Đã bị thay thế', color: 'default' },
}
const KIND: Record<Invoice['kind'], string> = { ORIGINAL: 'Gốc', REPLACEMENT: 'Thay thế', ADJUSTMENT: 'Điều chỉnh' }
const buyerOf = (v: InvoiceBuyer & { kind?: string }): InvoiceBuyer => (v.kind === 'person'
  ? { buyerName: v.buyerName, buyerIdNumber: v.buyerIdNumber, buyerEmail: v.buyerEmail }
  : { buyerTaxCode: v.buyerTaxCode, buyerCompany: v.buyerCompany, buyerAddress: v.buyerAddress, buyerName: v.buyerName, buyerEmail: v.buyerEmail })

/**
 * Hóa đơn điện tử khởi tạo từ máy tính tiền: mỗi đơn hoàn tất có 1 hóa đơn, phát hành tự động; khách cần xuất cho công ty
 * thì nhập MST trước khi phát hành, hoặc lập hóa đơn thay thế sau đó. Hoàn tiền sau khi đã xuất → hóa đơn điều chỉnh giảm.
 * Hóa đơn đã phát hành không hủy, không xóa.
 */
export function InvoicesPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])
  const [status, setStatus] = useState<Invoice['status']>()
  const [keyword, setKeyword] = useState('')
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), status, keyword: keyword || undefined }
  const { data = [], isLoading } = useQuery({ queryKey: ['invoices', params], queryFn: () => coreApi.invoices(params) })
  const [view, setView] = useState<Invoice | null>(null)
  const [buyerFor, setBuyerFor] = useState<{ orderCode?: string; replace?: Invoice } | null>(null)
  const [form] = Form.useForm()
  const keys = [['invoices']]
  const setBuyer = useAction((v: { code: string; b: InvoiceBuyer }) => coreApi.setInvoiceBuyer(v.code, v.b), keys, 'Đã lưu thông tin người mua')
  const replace = useAction((v: { id: number; b: InvoiceBuyer; reason: string }) => coreApi.replaceInvoice(v.id, v.b, v.reason), keys, 'Đã lập hóa đơn thay thế')
  const retry = useAction(coreApi.retryInvoice, keys, 'Đã đưa lại vào hàng đợi')
  const issueNow = useAction(coreApi.issueInvoicesNow, keys, 'Đã phát hành')
  const failed = data.filter((i) => i.status === 'FAILED').length

  return (
    <>
      <PageHeader title="Hóa đơn điện tử" subtitle="Khởi tạo từ máy tính tiền · lập cho từng đơn khi hoàn tất · sai thì thay thế / điều chỉnh, không hủy"
        extra={<Space>
          <Button onClick={() => { setBuyerFor({}); form.resetFields() }}>Xuất hóa đơn công ty theo mã đơn</Button>
          <Button icon={<SendOutlined />} loading={issueNow.isPending} onClick={() => issueNow.mutate(undefined)}>Phát hành ngay</Button>
        </Space>} />
      {failed > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={`${failed} hóa đơn phát hành lỗi — xem lỗi và gửi lại`} />}
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 170 }} value={status} onChange={setStatus}
          options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.text }))} />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã đơn, số HĐ, MST" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} />
      </Space>
      <Table<Invoice> rowKey="id" size="small" loading={isLoading} dataSource={data} scroll={{ x: 1000 }}
        onRow={(i) => ({ onClick: () => setView(i), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Ký hiệu · số', render: (_, i) => <><b>{i.series} · {i.invoiceNo ?? '—'}</b><div className="a-muted small">{KIND[i.kind]}{i.relatedNo && ` cho số ${i.relatedNo}`}</div></> },
          { title: 'Đơn', dataIndex: 'orderCode' },
          { title: 'Người mua', render: (_, i) => i.buyerCompany ?? i.buyerName ?? <span className="a-muted">Không lấy hóa đơn</span> },
          { title: 'MST', dataIndex: 'buyerTaxCode', render: (v) => v ?? '—' },
          { title: 'Tổng tiền', dataIndex: 'totalAmount', render: money, align: 'right' },
          { title: 'Lập / phát hành', render: (_, i) => <>{dateTime(i.createdAt)}<div className="a-muted small">{dateTime(i.issuedAt)}</div></> },
          { title: 'Trạng thái', render: (_, i) => <><Tag color={STATUS[i.status].color}>{STATUS[i.status].text}</Tag>{i.lastError && <div className="small a-limit">{i.lastError}</div>}</> },
        ]} />

      <Drawer open={!!view} width={760} onClose={() => setView(null)} title={view && `Hóa đơn ${view.series} · ${view.invoiceNo ?? 'chờ cấp số'}`}
        extra={view && <Tag color={STATUS[view.status].color}>{STATUS[view.status].text}</Tag>}>
        {view && <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button icon={<PrinterOutlined />} onClick={() => printInvoice(view)}>In hóa đơn</Button>
            {(view.status === 'PENDING' || view.status === 'FAILED') && view.kind !== 'ADJUSTMENT' && (
              <Button onClick={() => { setBuyerFor({ orderCode: view.orderCode }); form.resetFields() }}>Nhập thông tin người mua</Button>
            )}
            {view.status === 'FAILED' && <Button type="primary" onClick={() => retry.mutate(view.id, { onSuccess: setView })}>Gửi lại</Button>}
            {view.status === 'ISSUED' && view.kind !== 'ADJUSTMENT' && (
              <Button onClick={() => { setBuyerFor({ replace: view }); form.resetFields() }}>Lập hóa đơn thay thế</Button>
            )}
          </Space>
          <Descriptions size="small" column={2} bordered items={[
            { label: 'Mã CQT', children: view.taxAuthorityCode ?? '—', span: 2 },
            { label: 'Mã tra cứu', children: view.lookupCode ?? '—' },
            { label: 'Đơn hàng', children: view.orderCode },
            { label: 'Người mua', children: view.buyerCompany ?? view.buyerName ?? 'Người mua không lấy hóa đơn', span: 2 },
            ...(view.buyerTaxCode ? [{ label: 'MST', children: view.buyerTaxCode }, { label: 'Địa chỉ', children: view.buyerAddress }] : []),
            ...(view.reason ? [{ label: 'Lý do', children: view.reason, span: 2 }] : []),
          ]} />
          <Table rowKey="lineNo" size="small" pagination={false} style={{ marginTop: 12 }} dataSource={view.lines}
            columns={[
              { title: '#', dataIndex: 'lineNo', width: 40 },
              { title: 'Hàng hóa, dịch vụ', dataIndex: 'name' },
              { title: 'ĐVT', dataIndex: 'unit' },
              { title: 'SL', dataIndex: 'quantity', render: num, align: 'right' },
              { title: 'Đơn giá', dataIndex: 'unitPrice', render: num, align: 'right' },
              { title: 'Thành tiền', dataIndex: 'amount', render: money, align: 'right' },
            ]} />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            {view.vatRate != null && <>Chưa thuế {money(view.amountBeforeTax)} · VAT {view.vatRate}% {money(view.vatAmount)} · </>}<b>Tổng {money(view.totalAmount)}</b>
          </div>
        </>}
      </Drawer>

      <Modal open={!!buyerFor} title={buyerFor?.replace ? `Hóa đơn thay thế cho số ${buyerFor.replace.invoiceNo}` : 'Thông tin xuất hóa đơn'}
        onCancel={() => setBuyerFor(null)} destroyOnHidden
        footer={<Button type="primary" loading={setBuyer.isPending || replace.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => {
          const done = { onSuccess: () => { setBuyerFor(null); setView(null) } }
          if (buyerFor?.replace) replace.mutate({ id: buyerFor.replace.id, b: buyerOf(v), reason: v.reason }, done)
          else setBuyer.mutate({ code: v.orderCode ?? buyerFor!.orderCode!, b: buyerOf(v) }, done)
        }}>
          {buyerFor && !buyerFor.orderCode && !buyerFor.replace && (
            <Form.Item name="orderCode" label="Mã đơn" rules={[{ required: true }]}><Input placeholder="CH261021ABCD" /></Form.Item>
          )}
          <InvoiceBuyerFields />
          {buyerFor?.replace && <Form.Item name="reason" label="Lý do thay thế" rules={[{ required: true }]}><Input placeholder="Sai tên đơn vị, sai MST…" /></Form.Item>}
          <p className="a-muted">Hóa đơn chưa phát hành: cập nhật thẳng. Đã phát hành: hệ thống lập hóa đơn thay thế, hóa đơn cũ chuyển "đã bị thay thế".</p>
        </Form>
      </Modal>
    </>
  )
}
