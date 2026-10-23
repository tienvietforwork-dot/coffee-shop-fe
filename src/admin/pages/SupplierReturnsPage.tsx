import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { GoodsReceipt, SupplierReturn, SupplierReturnStatus } from '@/api/types'
import { PAYMENT_METHOD, RETURN_SETTLEMENT, RETURN_STATUS, date, dateTime, money, num, options } from '@/lib/format'
import { printSupplierReturn } from '@/lib/purchase'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { SupplierReturnModal } from '../components/SupplierReturnModal'

/**
 * Phiếu trả hàng nhập: phiếu tạm → đã trả hàng (stock leaves the lots; công nợ drops or the supplier refunds) / đã hủy.
 * A return always starts from the phiếu nhập the goods came in on.
 */
export function SupplierReturnsPage() {
  const [status, setStatus] = useState<SupplierReturnStatus>()
  const [supplierId, setSupplierId] = useState<number>()
  const { data = [], isLoading } = useQuery({ queryKey: ['supplier-returns', status, supplierId], queryFn: () => coreApi.supplierReturns({ status, supplierId }) })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: coreApi.suppliers })
  const [view, setView] = useState<SupplierReturn | null>(null)
  const [editing, setEditing] = useState<{ receipt: GoodsReceipt; ret?: SupplierReturn } | null>(null)
  const [picking, setPicking] = useState(false)
  const [cancelling, setCancelling] = useState<SupplierReturn | null>(null)
  const keys = [['supplier-returns'], ['goods-receipts'], ['materials'], ['batches'], ['supplier-debts'], ['transactions']]
  const complete = useAction(coreApi.completeSupplierReturn, keys, 'Đã trả hàng')
  const cancel = useAction((v: { id: number; reason: string }) => coreApi.cancelSupplierReturn(v.id, v.reason), keys, 'Đã hủy phiếu tạm')

  // pick the phiếu nhập the goods came in on
  const [receiptSupplier, setReceiptSupplier] = useState<number>()
  const { data: receipts = [] } = useQuery({ queryKey: ['goods-receipts', 'for-return', receiptSupplier], enabled: picking && !!receiptSupplier,
    queryFn: () => coreApi.goodsReceipts({ supplierId: receiptSupplier, status: 'COMPLETED' }) })
  const openForReceipt = async (receiptId: number) => {
    const receipt = await coreApi.goodsReceipt(receiptId)
    setPicking(false)
    setEditing({ receipt })
  }
  const edit = async (t: SupplierReturn) => {
    const receipt = await coreApi.goodsReceipt(t.goodsReceiptId)
    setView(null)
    setEditing({ receipt, ret: t })
  }

  return (
    <>
      <PageHeader title="Trả hàng nhập" subtitle="Trả lại nhà cung cấp hàng lỗi, cận hạn, sai quy cách · trừ vào công nợ hoặc nhà cung cấp hoàn tiền"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setPicking(true)}>Lập phiếu trả hàng</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear showSearch optionFilterProp="label" placeholder="Nhà cung cấp" style={{ width: 220 }} value={supplierId} onChange={setSupplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 160 }} value={status} onChange={setStatus} options={options(RETURN_STATUS)} />
      </Space>
      <Table<SupplierReturn> rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 900 }}
        onRow={(t) => ({ onClick: () => setView(t), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Số phiếu', dataIndex: 'code', render: (v) => <b>{v}</b> },
          { title: 'Ngày', render: (_, t) => dateTime(t.completedAt ?? t.createdAt) },
          { title: 'Nhà cung cấp', dataIndex: 'supplierName' },
          { title: 'Phiếu nhập gốc', dataIndex: 'goodsReceiptCode' },
          { title: 'Lý do', dataIndex: 'reason' },
          { title: 'Thanh toán', render: (_, t) => RETURN_SETTLEMENT[t.settlement] },
          { title: 'Giá trị', dataIndex: 'totalAmount', render: money, align: 'right' },
          { title: 'Trạng thái', render: (_, t) => <StatusTag label={RETURN_STATUS[t.status]} /> },
        ]} />

      <Drawer open={!!view} width={760} onClose={() => setView(null)} title={view && `${view.code} · ${view.supplierName}`}
        extra={view && <StatusTag label={RETURN_STATUS[view.status]} />}>
        {view && <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button icon={<PrinterOutlined />} onClick={() => printSupplierReturn(view)}>In phiếu trả hàng</Button>
            {view.status === 'DRAFT' && <>
              <Button onClick={() => edit(view)}>Sửa</Button>
              <Popconfirm title="Trả hàng và trừ kho?" onConfirm={() => complete.mutate(view.id, { onSuccess: setView })}>
                <Button type="primary" danger>Trả hàng</Button>
              </Popconfirm>
              <Button onClick={() => setCancelling(view)}>Hủy phiếu tạm</Button>
            </>}
          </Space>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }} items={[
            { label: 'Phiếu nhập gốc', children: `${view.goodsReceiptCode}${view.receiptInvoiceNo ? ` · HĐ ${view.receiptInvoiceNo}` : ''}` },
            { label: 'Người lập', children: view.staffName ?? view.createdBy },
            { label: 'Lý do', children: view.reason, span: 2 },
            { label: 'Thanh toán', children: `${RETURN_SETTLEMENT[view.settlement]}${view.refundMethod ? ` · ${PAYMENT_METHOD[view.refundMethod]}` : ''}` },
            { label: 'HĐ điều chỉnh giảm', children: view.adjustmentInvoiceNo ?? <span className="a-muted">chưa có</span> },
            { label: 'Ngày trả', children: dateTime(view.completedAt) },
            { label: 'Ngày lập', children: date(view.createdAt) },
            ...(view.cancelReason ? [{ label: 'Lý do hủy', children: view.cancelReason, span: 2 }] : []),
          ]} />
          <Table rowKey="id" size="small" pagination={false} dataSource={view.items}
            columns={[
              { title: 'Nguyên liệu', render: (_, l) => <>{l.materialName}<div className="a-muted small">Lô #{l.batchId}</div></> },
              { title: 'Số lượng', render: (_, l) => `${num(l.quantity)} ${l.unit}` },
              { title: 'Giá trả', render: (_, l) => `${num(l.unitPrice)}đ/${l.unit}` },
              { title: 'Thành tiền', dataIndex: 'amount', render: money, align: 'right' },
            ]} />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            Tiền hàng {money(view.goodsAmount)}{view.vatRate != null && <> · VAT {view.vatRate}% {money(view.vatAmount)}</>} · <b>Tổng {money(view.totalAmount)}</b>
          </div>
        </>}
      </Drawer>

      <Modal open={picking} title="Chọn phiếu nhập có hàng cần trả" footer={null} onCancel={() => setPicking(false)} destroyOnHidden width={720}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Hàng trả phải lấy đúng từ lô của phiếu nhập đã mang nó vào kho." />
        <Select showSearch optionFilterProp="label" placeholder="Nhà cung cấp" style={{ width: '100%', marginBottom: 12 }} value={receiptSupplier}
          onChange={setReceiptSupplier} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Table<GoodsReceipt> rowKey="id" size="small" pagination={{ pageSize: 8 }} dataSource={receipts.filter((r) => r.lines.some((l) => l.remainingInLot > 0))}
          columns={[
            { title: 'Phiếu nhập', render: (_, r) => <><b>{r.code}</b><div className="a-muted small">{dateTime(r.createdAt)}</div></> },
            { title: 'Hàng còn trong kho', render: (_, r) => r.lines.filter((l) => l.remainingInLot > 0).map((l) => <div key={l.id} className="small">{l.materialName}: {num(l.remainingInLot)} {l.unit}</div>) },
            { title: '', render: (_, r) => <Button size="small" type="primary" onClick={() => openForReceipt(r.id)}>Chọn</Button> },
          ]} />
      </Modal>
      <SupplierReturnModal receipt={editing?.receipt ?? null} editing={editing?.ret} onClose={() => setEditing(null)} />
      <Modal open={!!cancelling} title={`Hủy ${cancelling?.code}`} onCancel={() => setCancelling(null)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { reason: string }) => cancel.mutate({ id: cancelling!.id, reason: v.reason }, { onSuccess: () => { setCancelling(null); setView(null) } })}>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input /></Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={cancel.isPending}>Hủy phiếu tạm</Button>
        </Form>
      </Modal>
    </>
  )
}
