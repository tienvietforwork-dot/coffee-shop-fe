import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Descriptions, Drawer, Form, Image, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus } from '@/api/types'
import { RECEIPT_STATUS, RETURN_STATUS, date, dateTime, imageSrc, money, num, options } from '@/lib/format'
import { inPackages, moneyLines, printGoodsReceipt } from '@/lib/purchase'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { ReceiptModal } from '../components/purchase'
import { SupplierReturnModal } from '../components/SupplierReturnModal'

/**
 * Phiếu nhập kho (mẫu 01-VT): every delivery received, against a purchase order or loose. A receipt is not edited;
 * while none of its lots has been used it can be cancelled (stock and công nợ go back). Goods found faulty later
 * go back with a phiếu trả hàng nhập.
 */
export function GoodsReceiptsPage() {
  const { can } = usePerm()
  const [supplierId, setSupplierId] = useState<number>()
  const [status, setStatus] = useState<GoodsReceiptStatus>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const [search, setSearch] = useState('')
  const params = { supplierId, status, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
  const { data = [], isLoading } = useQuery({ queryKey: ['goods-receipts', params], queryFn: () => coreApi.goodsReceipts(params) })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: coreApi.suppliers })
  const q = search.trim().toLowerCase()
  const rows = data.filter((r) => !q || [r.code, r.invoiceNo, r.purchaseOrderCode, r.delivererName].some((x) => x?.toLowerCase().includes(q))
    || r.lines.some((l) => l.materialName.toLowerCase().includes(q)))

  const [viewId, setViewId] = useState<number>()
  const { data: view } = useQuery({ queryKey: ['goods-receipt', viewId], queryFn: () => coreApi.goodsReceipt(viewId!), enabled: !!viewId })
  const { data: returns = [] } = useQuery({ queryKey: ['supplier-returns', 'receipt', viewId], enabled: !!viewId && can(P.SUPPLIER_RETURNS),
    queryFn: () => coreApi.supplierReturns({ goodsReceiptId: viewId }) })
  const [loose, setLoose] = useState(false)
  const [returning, setReturning] = useState<GoodsReceipt | null>(null)
  const [cancelling, setCancelling] = useState<GoodsReceipt | null>(null)
  const cancel = useAction((v: { id: number; reason: string }) => coreApi.cancelReceipt(v.id, v.reason),
    [['goods-receipts'], ['goods-receipt', viewId], ['purchase-orders'], ['materials'], ['batches'], ['supplier-debts'], ['transactions'], ['alerts']],
    'Đã hủy phiếu nhập')

  return (
    <>
      <PageHeader title="Phiếu nhập kho" subtitle="Mẫu 01-VT · mỗi lần nhận hàng 1 phiếu · SL theo chứng từ và SL thực nhập · hàng không đạt ghi 'không nhận'"
        extra={can(P.STOCK) && <Button type="primary" icon={<PlusOutlined />} onClick={() => setLoose(true)}>Nhập lẻ (không theo phiếu đặt)</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã phiếu, số HĐ, nguyên liệu" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Nhà cung cấp" style={{ width: 220 }} value={supplierId} onChange={setSupplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 150 }} value={status} onChange={setStatus} options={options(RECEIPT_STATUS)} />
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
      </Space>
      <Table<GoodsReceipt> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 1000 }}
        onRow={(r) => ({ onClick: () => setViewId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Số phiếu', dataIndex: 'code', render: (v, r) => <><b>{v}</b>{r.purchaseOrderCode && <div className="a-muted small">theo {r.purchaseOrderCode}</div>}</> },
          { title: 'Ngày nhập', dataIndex: 'createdAt', render: dateTime },
          { title: 'Nhà cung cấp', dataIndex: 'supplierName' },
          { title: 'Hóa đơn', render: (_, r) => (r.invoiceNo ? `${r.invoiceSeries ?? ''} ${r.invoiceNo}` : <span className="a-muted">—</span>) },
          {
            title: 'Kiểm nhận', render: (_, r) => {
              const rejected = r.lines.filter((l) => l.rejectedQuantity > 0).length
              const short = r.lines.filter((l) => l.shortQuantity > 0).length
              return rejected || short
                ? <>{rejected > 0 && <Tag color="red">{rejected} dòng không nhận</Tag>}{short > 0 && <Tag color="orange">{short} dòng giao thiếu</Tag>}</>
                : <Tag color="green">Đủ</Tag>
            },
          },
          { title: 'Cần trả', dataIndex: 'totalAmount', render: money, align: 'right' },
          {
            title: 'Còn nợ', render: (_, r) => (r.status === 'CANCELLED' ? '—'
              : <span className={r.overdue ? 'a-limit' : ''}>{money(r.remainingAmount)}{r.remainingAmount > 0 && <div className="a-muted small">hạn {date(r.dueDate)}</div>}</span>),
            align: 'right',
          },
          { title: 'Trạng thái', render: (_, r) => <StatusTag label={RECEIPT_STATUS[r.status]} /> },
        ]} />

      <Drawer open={!!viewId} width={920} onClose={() => setViewId(undefined)} title={view ? `${view.code} · ${view.supplierName}` : 'Phiếu nhập'}
        extra={view && <StatusTag label={RECEIPT_STATUS[view.status]} />}>
        {view && <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button icon={<PrinterOutlined />} onClick={() => printGoodsReceipt(view)}>In phiếu nhập (01-VT)</Button>
            {view.status === 'COMPLETED' && can(P.SUPPLIER_RETURNS) && view.lines.some((l) => l.remainingInLot > 0) && (
              <Button danger onClick={() => setReturning(view)}>Trả hàng nhà cung cấp</Button>
            )}
            {view.status === 'COMPLETED' && can(P.PURCHASE_ORDERS) && <Button onClick={() => setCancelling(view)}>Hủy phiếu nhập</Button>}
          </Space>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }} items={[
            { label: 'Nhà cung cấp', children: <>{view.supplierName}{view.supplierTaxCode && <div className="a-muted small">MST {view.supplierTaxCode}</div>}</> },
            { label: 'Theo phiếu đặt', children: view.purchaseOrderCode ?? 'Nhập lẻ' },
            { label: 'Người giao hàng', children: view.delivererName ?? '—' },
            { label: 'Người nhập', children: view.staffName ?? view.createdBy ?? '—' },
            { label: 'Hóa đơn NCC', children: view.invoiceNo ? `${view.invoiceSeries ?? ''} ${view.invoiceNo} · ${date(view.invoiceDate)}` : 'Không có / chỉ phiếu giao' },
            { label: 'Ngày nhập', children: dateTime(view.createdAt) },
            { label: 'Hạn thanh toán', children: <span className={view.overdue ? 'a-limit' : ''}>{date(view.dueDate)}</span> },
            { label: 'Đã trả / trả hàng / còn nợ', children: `${money(view.paidAmount)} / ${money(view.returnedAmount)} / ${money(view.remainingAmount)}` },
            ...(view.note ? [{ label: 'Ghi chú', children: view.note, span: 2 }] : []),
            ...(view.cancelReason ? [{ label: 'Lý do hủy', children: `${view.cancelReason} · ${dateTime(view.cancelledAt)}`, span: 2 }] : []),
          ]} />
          <Table<GoodsReceiptLine> rowKey="id" size="small" pagination={false} dataSource={view.lines} scroll={{ x: 820 }}
            summary={() => moneyLines(view).map(([label, value], i, all) => (
              <Table.Summary.Row key={label}>
                <Table.Summary.Cell index={0} colSpan={5} align="right">{i === all.length - 1 ? <b>{label}</b> : label}</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">{i === all.length - 1 ? <b>{money(value)}</b> : money(value)}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            ))}
            columns={[
              { title: 'Nguyên liệu', render: (_, l) => <><b>{l.materialName}</b>{l.batchId && <div className="a-muted small">Lô #{l.batchId} · còn {num(l.remainingInLot)} {l.unit}</div>}</> },
              { title: 'Theo chứng từ', render: (_, l) => inPackages(l.documentQuantity, l) },
              { title: 'Thực nhận', render: (_, l) => <b>{inPackages(l.receivedQuantity, l)}</b> },
              {
                title: 'Không nhận / thiếu', render: (_, l) => <>
                  {l.rejectedQuantity > 0 && <div className="a-limit">{inPackages(l.rejectedQuantity, l)}: {l.rejectReason}</div>}
                  {l.shortQuantity > 0 && <div className="a-muted">Thiếu {inPackages(l.shortQuantity, l)}</div>}
                  {!l.rejectedQuantity && !l.shortQuantity && '—'}
                </>,
              },
              { title: 'Đơn giá', render: (_, l) => (l.unitPrice == null ? '—' : `${num(l.unitPrice)}đ/${l.unit}`) },
              { title: 'Thành tiền', dataIndex: 'amount', render: money, align: 'right' },
              { title: 'HSD · nhiệt độ', render: (_, l) => <>{date(l.expiryDate)}{l.temperature != null && <div className="a-muted small">{l.temperature}°C</div>}</> },
            ]} />
          {view.documentImageId && (
            <div style={{ marginTop: 16 }}><b>Chứng từ kèm theo</b><div><Image width={180} src={imageSrc(`/api/public/images/${view.documentImageId}`)} /></div></div>
          )}
          {returns.length > 0 && <>
            <h3 style={{ marginTop: 24 }}>Phiếu trả hàng</h3>
            <Table rowKey="id" size="small" pagination={false} dataSource={returns}
              columns={[
                { title: 'Số phiếu', dataIndex: 'code' },
                { title: 'Ngày', render: (_, t) => dateTime(t.completedAt ?? t.createdAt) },
                { title: 'Lý do', dataIndex: 'reason' },
                { title: 'Giá trị', dataIndex: 'totalAmount', render: money, align: 'right' },
                { title: 'Trạng thái', render: (_, t) => <StatusTag label={RETURN_STATUS[t.status]} /> },
              ]} />
          </>}
        </>}
      </Drawer>

      <ReceiptModal loose={loose} onClose={() => setLoose(false)} onDone={(r) => setViewId(r.id)} />
      <SupplierReturnModal receipt={returning} onClose={() => setReturning(null)} />
      <Modal open={!!cancelling} title={`Hủy phiếu nhập ${cancelling?.code}`} onCancel={() => setCancelling(null)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { reason: string }) => cancel.mutate({ id: cancelling!.id, reason: v.reason }, { onSuccess: () => setCancelling(null) })}>
          <p className="a-muted">Chỉ hủy được khi các lô của phiếu chưa dùng tới. Hàng rời kho, phiếu đặt nhận lại số lượng, công nợ của phiếu bị bỏ.
            Hàng đã dùng một phần thì lập phiếu trả hàng.</p>
          <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true }]}><Input.TextArea rows={2} placeholder="Nhập nhầm nhà cung cấp, sai số lượng…" /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={cancel.isPending}>Hủy phiếu nhập</Button>
        </Form>
      </Modal>
    </>
  )
}
