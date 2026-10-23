import { useEffect } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Radio, Select, Table } from 'antd'
import { coreApi, type SupplierReturnPayload } from '@/api/core'
import type { GoodsReceipt, GoodsReceiptLine, PaymentMethod, SupplierReturn, SupplierReturnSettlement } from '@/api/types'
import { PAYMENT_METHOD, RETURN_SETTLEMENT, SUPPLIER_PAY_METHODS, money, num } from '@/lib/format'
import { useAction } from './useCrud'
import { MoneyInput } from './MoneyInput'

type Row = { count?: number; price?: number }
type Values = {
  reason: string; settlement: SupplierReturnSettlement; refundMethod?: PaymentMethod; adjustmentInvoiceNo?: string; note?: string
  rows: Row[]
}

/** still returnable from a receipt line, in its packaging (or units when loose) */
const returnable = (l: GoodsReceiptLine) => (l.packageSize ? Math.floor(l.remainingInLot / l.packageSize * 100) / 100 : l.remainingInLot)

/**
 * Phiếu trả hàng nhập for lines of one phiếu nhập: how much goes back (≤ what is still in the lot), at the import price,
 * and how the supplier settles it — trừ công nợ or hoàn tiền. "Lưu tạm" keeps it as phiếu tạm; "Trả hàng" takes the
 * goods out of stock straight away.
 */
export function SupplierReturnModal({ receipt, editing, onClose }: {
  receipt: GoodsReceipt | null; editing?: SupplierReturn | null; onClose: () => void
}) {
  const [form] = Form.useForm<Values>()
  const lines = receipt?.lines.filter((l) => l.batchId && (l.remainingInLot > 0 || editing?.items.some((i) => i.receiptItemId === l.id))) ?? []
  const keys = [['supplier-returns'], ['goods-receipts'], ['goods-receipt', receipt?.id], ['materials'], ['batches'], ['supplier-debts'], ['transactions']]
  const save = useAction((b: SupplierReturnPayload) => (editing ? coreApi.updateSupplierReturn(editing.id, b) : coreApi.createSupplierReturn(b)),
    keys, 'Đã lưu phiếu trả hàng')

  useEffect(() => {
    if (!receipt) return
    form.resetFields()
    form.setFieldsValue({
      reason: editing?.reason, settlement: editing?.settlement ?? 'DEBT', refundMethod: editing?.refundMethod ?? 'CASH',
      adjustmentInvoiceNo: editing?.adjustmentInvoiceNo, note: editing?.note,
      rows: lines.map((l) => {
        const it = editing?.items.find((i) => i.receiptItemId === l.id)
        const size = l.packageSize ?? 1
        return { count: it ? it.quantity / size : undefined, price: Math.round((it?.unitPrice ?? l.unitPrice ?? 0) * size) }
      }),
    })
  }, [receipt?.id, editing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = Form.useWatch([], form) as Values | undefined
  const rows = v?.rows ?? []
  const goods = rows.reduce((s, r) => s + (r?.count && r.price != null ? Math.round(r.count * r.price) : 0), 0)
  const vat = receipt?.vatRate ? Math.round(goods * receipt.vatRate / 100) : 0

  const submit = (x: Values, complete: boolean) => {
    const items = lines.flatMap((l, idx) => {
      const r = x.rows[idx]
      if (!r?.count) return []
      return [{ receiptItemId: l.id, count: r.count, unitPrice: r.price == null ? undefined : Math.round((r.price / (l.packageSize ?? 1)) * 100) / 100 }]
    })
    save.mutate({
      goodsReceiptId: receipt!.id, reason: x.reason, settlement: x.settlement,
      refundMethod: x.settlement === 'REFUND' ? x.refundMethod : undefined,
      adjustmentInvoiceNo: x.adjustmentInvoiceNo, note: x.note, complete, items,
    }, { onSuccess: onClose })
  }

  return (
    <Modal open={!!receipt} width={900} destroyOnHidden onCancel={onClose}
      title={receipt && `${editing ? `Sửa ${editing.code}` : 'Trả hàng nhập'} · phiếu nhập ${receipt.code} · ${receipt.supplierName}`}
      footer={<>
        <Button loading={save.isPending} onClick={() => form.validateFields().then((x) => submit(x, false))}>Lưu tạm</Button>
        <Button type="primary" danger loading={save.isPending} onClick={() => form.validateFields().then((x) => submit(x, true))}>
          Trả hàng · {money(goods + vat)}
        </Button>
      </>}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Hàng trả lấy từ đúng lô của phiếu nhập. Nhà cung cấp lập hóa đơn điều chỉnh giảm; ghi số hóa đơn đó khi nhận được." />
      <Form form={form} layout="vertical">
        <Table<GoodsReceiptLine> rowKey="id" size="small" pagination={false} dataSource={lines}
          columns={[
            { title: 'Nguyên liệu', render: (_, l) => <><b>{l.materialName}</b><div className="a-muted small">Lô #{l.batchId} · nhập {num(l.receivedQuantity)} {l.unit}</div></> },
            { title: 'Còn trong lô', render: (_, l) => `${num(l.remainingInLot)} ${l.unit}` },
            {
              title: 'Số lượng trả', width: 180, render: (_, l, idx) => (
                <Form.Item name={['rows', idx, 'count']} noStyle>
                  <InputNumber min={0} max={returnable(l)} style={{ width: '100%' }} addonAfter={l.packageName ?? l.unit} />
                </Form.Item>
              ),
            },
            {
              title: `Giá trả / ${'đv'}`, width: 170, render: (_, l, idx) => (
                <Form.Item name={['rows', idx, 'price']} noStyle><MoneyInput addonAfter={`/${(l.packageName ?? l.unit).toLowerCase()}`} /></Form.Item>
              ),
            },
          ]} />
        <div className="a-grid-2" style={{ marginTop: 12 }}>
          <Form.Item name="reason" label="Lý do trả" rules={[{ required: true }]}><Input placeholder="Hàng lỗi, cận date, sai quy cách…" /></Form.Item>
          <Form.Item name="adjustmentInvoiceNo" label="Số hóa đơn điều chỉnh giảm của NCC"><Input /></Form.Item>
        </div>
        <div className="a-grid-2">
          <Form.Item name="settlement" label="Nhà cung cấp thanh toán">
            <Radio.Group options={(['DEBT', 'REFUND'] as SupplierReturnSettlement[]).map((s) => ({ value: s, label: RETURN_SETTLEMENT[s] }))} />
          </Form.Item>
          {v?.settlement === 'REFUND' && (
            <Form.Item name="refundMethod" label="Hoàn bằng">
              <Select options={SUPPLIER_PAY_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))} />
            </Form.Item>
          )}
        </div>
        <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        <div style={{ textAlign: 'right' }}>
          Tiền hàng {money(goods)}{receipt?.vatRate != null && <> · VAT {receipt.vatRate}% {money(vat)}</>} · <b>Tổng {money(goods + vat)}</b>
        </div>
      </Form>
    </Modal>
  )
}
