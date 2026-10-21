import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Drawer, Form, Input, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag } from 'antd'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi, type SupplierPaymentPayload } from '@/api/core'
import type { SupplierDebt, SupplierPayment } from '@/api/types'
import { PAYMENT_METHOD, SUPPLIER_PAYMENT_STATUS, SUPPLIER_PAY_METHODS, date, dateTime, money } from '@/lib/format'
import { printSupplierPayment } from '@/lib/purchase'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { MoneyInput } from '../components/MoneyInput'
import { ImageUpload, type ImageValue } from '../components/ImageUpload'
import { useAction } from '../components/useCrud'

type PayValues = Omit<SupplierPaymentPayload, 'paidAt' | 'documentImageId'> & { paidAt?: Dayjs; image?: ImageValue }

/**
 * Công nợ phải trả nhà cung cấp: phiếu nhập tăng nợ, trả hàng (trừ nợ) và phiếu chi giảm nợ. Từ đây xem sổ chi tiết theo
 * kỳ (= biên bản đối chiếu công nợ, xuất Excel) và lập phiếu chi (tiền mặt / chuyển khoản), in theo mẫu 02-TT.
 */
export function SupplierDebtsPage() {
  const [tab, setTab] = useState<'debts' | 'payments'>('debts')
  const { data: debts = [], isLoading } = useQuery({ queryKey: ['supplier-debts'], queryFn: coreApi.supplierDebts })
  const [onlyOpen, setOnlyOpen] = useState(true)
  const rows = debts.filter((d) => !onlyOpen || d.balance !== 0)
  const totals = {
    balance: debts.reduce((s, d) => s + Math.max(0, d.balance), 0),
    overdue: debts.reduce((s, d) => s + d.overdueAmount, 0),
  }

  // sổ chi tiết of one supplier for a period
  const [ledgerOf, setLedgerOf] = useState<SupplierDebt | null>(null)
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const periodParams = { from: period[0].format('YYYY-MM-DD'), to: period[1].format('YYYY-MM-DD') }
  const { data: ledger, isFetching } = useQuery({ queryKey: ['supplier-ledger', ledgerOf?.supplierId, periodParams], enabled: !!ledgerOf,
    queryFn: () => coreApi.supplierLedger(ledgerOf!.supplierId, periodParams) })

  // phiếu chi
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const payParams = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
  const { data: payments = [], isLoading: loadingPayments } = useQuery({ queryKey: ['supplier-payments', payParams], enabled: tab === 'payments',
    queryFn: () => coreApi.supplierPayments(payParams) })
  const [paying, setPaying] = useState<SupplierDebt | null>(null)
  const [form] = Form.useForm<PayValues>()
  const keys = [['supplier-debts'], ['supplier-payments'], ['supplier-ledger'], ['goods-receipts']]
  const pay = useAction(coreApi.paySupplier, keys, 'Đã lập phiếu chi')
  const [cancelling, setCancelling] = useState<SupplierPayment | null>(null)
  const cancel = useAction((v: { id: number; reason: string }) => coreApi.cancelSupplierPayment(v.id, v.reason), keys, 'Đã hủy phiếu chi')
  const { data: openReceipts = [] } = useQuery({ queryKey: ['goods-receipts', 'open', paying?.supplierId], enabled: !!paying,
    queryFn: () => coreApi.goodsReceipts({ supplierId: paying!.supplierId, status: 'COMPLETED' }) })
  const method = Form.useWatch('method', form)

  const openPay = (d: SupplierDebt) => {
    setPaying(d)
    form.resetFields()
    form.setFieldsValue({ supplierId: d.supplierId, amount: Math.max(0, d.balance), method: 'BANK_TRANSFER', paidAt: dayjs() })
  }

  return (
    <>
      <PageHeader title="Công nợ nhà cung cấp" subtitle="Nợ phải trả = phiếu nhập − trả hàng (trừ nợ) − phiếu chi · thanh toán phiếu cũ nhất trước" />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Tổng còn phải trả" value={totals.balance} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Quá hạn" value={totals.overdue} formatter={(v) => <span className={totals.overdue ? 'a-limit' : ''}>{money(Number(v))}</span>} /></Card></Col>
      </Row>
      <Segmented value={tab} onChange={(v) => setTab(v as typeof tab)} style={{ marginBottom: 12 }}
        options={[{ value: 'debts', label: 'Công nợ theo nhà cung cấp' }, { value: 'payments', label: 'Phiếu chi' }]} />

      {tab === 'debts' && <>
        <Segmented value={onlyOpen ? 'open' : 'all'} onChange={(v) => setOnlyOpen(v === 'open')} style={{ marginLeft: 12 }}
          options={[{ value: 'open', label: 'Còn nợ / trả trước' }, { value: 'all', label: 'Tất cả' }]} />
        <Table<SupplierDebt> rowKey="supplierId" loading={isLoading} dataSource={rows} scroll={{ x: 1000 }} style={{ marginTop: 12 }}
          columns={[
            { title: 'Nhà cung cấp', render: (_, d) => <><b>{d.supplierName}</b><div className="a-muted small">{d.paymentTermDays ? `Nợ ${d.paymentTermDays} ngày` : 'Trả ngay'}{d.phone && ` · ${d.phone}`}</div></> },
            { title: 'Đã nhập', dataIndex: 'purchasedAmount', render: money, align: 'right' },
            { title: 'Trả hàng', dataIndex: 'returnedAmount', render: money, align: 'right' },
            { title: 'Đã chi', dataIndex: 'paidAmount', render: money, align: 'right' },
            {
              title: 'Còn phải trả', dataIndex: 'balance', align: 'right', sorter: (a, b) => a.balance - b.balance,
              render: (v: number) => (v < 0 ? <Tag color="blue">Trả trước {money(-v)}</Tag> : <b>{money(v)}</b>),
            },
            {
              title: 'Hạn', render: (_, d) => <>
                {d.overdueAmount > 0 && <div className="a-limit">Quá hạn {money(d.overdueAmount)}</div>}
                {d.nextDueDate && <div className="small">Đến hạn {date(d.nextDueDate)}</div>}
                {!d.overdueAmount && !d.nextDueDate && '—'}
              </>,
            },
            {
              title: '', render: (_, d) => (
                <Space>
                  <Button size="small" onClick={() => setLedgerOf(d)}>Sổ chi tiết</Button>
                  <Button size="small" type="primary" onClick={() => openPay(d)}>Lập phiếu chi</Button>
                </Space>
              ),
            },
          ]} />
      </>}

      {tab === 'payments' && <>
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
        <Table<SupplierPayment> rowKey="id" loading={loadingPayments} dataSource={payments} scroll={{ x: 900 }} style={{ marginTop: 12 }}
          columns={[
            { title: 'Số phiếu', dataIndex: 'code', render: (v) => <b>{v}</b> },
            { title: 'Ngày chi', dataIndex: 'paidAt', render: dateTime },
            { title: 'Nhà cung cấp', dataIndex: 'supplierName' },
            { title: 'Nội dung', render: (_, p) => (p.goodsReceiptCode ? `Phiếu nhập ${p.goodsReceiptCode}` : p.purchaseOrderCode ? `Trả trước ${p.purchaseOrderCode}` : 'Trả nợ') },
            { title: 'Hình thức', render: (_, p) => <>{PAYMENT_METHOD[p.method]}{p.reference && <div className="a-muted small">{p.reference}</div>}</> },
            { title: 'Số tiền', dataIndex: 'amount', render: money, align: 'right' },
            { title: 'Trạng thái', render: (_, p) => <StatusTag label={SUPPLIER_PAYMENT_STATUS[p.status]} /> },
            {
              title: '', render: (_, p) => (
                <Space>
                  <Button size="small" icon={<PrinterOutlined />} onClick={() => printSupplierPayment(p)}>In</Button>
                  {p.status === 'COMPLETED' && <Button size="small" danger onClick={() => setCancelling(p)}>Hủy</Button>}
                </Space>
              ),
            },
          ]} />
      </>}

      <Drawer open={!!ledgerOf} width={980} onClose={() => setLedgerOf(null)} title={ledgerOf && `Sổ chi tiết công nợ · ${ledgerOf.supplierName}`}
        extra={<Space>
          <DatePicker.RangePicker value={period} onChange={(v) => v && setPeriod([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
          <Button icon={<DownloadOutlined />} onClick={() => ledgerOf && coreApi.supplierLedgerExcel(ledgerOf.supplierId, periodParams)}>Xuất Excel</Button>
        </Space>}>
        {ledger && <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}><Statistic title="Số dư đầu kỳ" value={ledger.openingBalance} formatter={(v) => money(Number(v))} /></Col>
            <Col span={6}><Statistic title="Phát sinh tăng (nhập)" value={ledger.increase} formatter={(v) => money(Number(v))} /></Col>
            <Col span={6}><Statistic title="Phát sinh giảm (trả, chi)" value={ledger.decrease} formatter={(v) => money(Number(v))} /></Col>
            <Col span={6}><Statistic title="Số dư cuối kỳ" value={ledger.closingBalance} formatter={(v) => <b>{money(Number(v))}</b>} /></Col>
          </Row>
          <Table rowKey={(r) => `${r.type}-${r.documentId}`} size="small" loading={isFetching} pagination={false} dataSource={ledger.rows}
            columns={[
              { title: 'Ngày', dataIndex: 'date', render: dateTime },
              { title: 'Chứng từ', dataIndex: 'code', render: (v, r) => <><b>{v}</b> <Tag>{r.type === 'RECEIPT' ? 'Nhập' : r.type === 'RETURN' ? 'Trả hàng' : 'Chi'}</Tag></> },
              { title: 'Diễn giải', dataIndex: 'description' },
              { title: 'Hạn TT', dataIndex: 'dueDate', render: (v) => (v ? date(v) : '') },
              { title: 'Tăng', dataIndex: 'increase', render: (v: number) => (v ? money(v) : ''), align: 'right' },
              { title: 'Giảm', dataIndex: 'decrease', render: (v: number) => (v ? money(v) : ''), align: 'right' },
              { title: 'Số dư', dataIndex: 'balance', render: money, align: 'right' },
            ]} />
        </>}
      </Drawer>

      <Modal open={!!paying} title={paying && `Phiếu chi · ${paying.supplierName}`} onCancel={() => setPaying(null)} destroyOnHidden
        footer={<Button type="primary" loading={pay.isPending} onClick={() => form.submit()}>Lập phiếu chi</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => pay.mutate({
          ...v, paidAt: v.paidAt?.format('YYYY-MM-DDTHH:mm:ss'), documentImageId: v.image?.id,
        }, { onSuccess: (p) => { setPaying(null); printSupplierPayment(p) } })}>
          <Form.Item name="supplierId" hidden><Input /></Form.Item>
          <p className="a-muted">Còn phải trả {money(paying?.balance)}{paying?.overdueAmount ? ` · quá hạn ${money(paying.overdueAmount)}` : ''}</p>
          <div className="a-grid-2">
            <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}><MoneyInput min={1} /></Form.Item>
            <Form.Item name="method" label="Hình thức"><Select options={SUPPLIER_PAY_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))} /></Form.Item>
            <Form.Item name="reference" label="Mã giao dịch" rules={[{ required: method === 'BANK_TRANSFER', message: 'Nhập mã giao dịch chuyển khoản' }]}><Input /></Form.Item>
            <Form.Item name="paidAt" label="Ngày chi"><DatePicker showTime format="HH:mm DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} /></Form.Item>
            <Form.Item name="payeeName" label="Người nhận tiền"><Input /></Form.Item>
            <Form.Item name="goodsReceiptId" label="Trả cho phiếu nhập" tooltip="Để trống: trả các phiếu cũ nhất trước">
              <Select allowClear options={openReceipts.filter((r) => r.remainingAmount > 0).map((r) => ({
                value: r.id, label: `${r.code} · còn ${money(r.remainingAmount)}${r.overdue ? ' · quá hạn' : ''}`,
              }))} />
            </Form.Item>
          </div>
          <Form.Item name="image" label="Ảnh chứng từ chuyển khoản / biên nhận"><ImageUpload /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal open={!!cancelling} title={`Hủy phiếu chi ${cancelling?.code}`} onCancel={() => setCancelling(null)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { reason: string }) => cancel.mutate({ id: cancelling!.id, reason: v.reason }, { onSuccess: () => setCancelling(null) })}>
          <p className="a-muted">Phiếu chi bị hủy không còn trừ vào công nợ.</p>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={cancel.isPending}>Hủy phiếu chi</Button>
        </Form>
      </Modal>
    </>
  )
}
