import { useEffect } from 'react'
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Table } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { PurchaseOrder, PurchaseOrderItem } from '@/api/types'
import { money, num } from '@/lib/format'
import { orderedText } from '@/lib/purchase'
import { useAction } from './useCrud'
import { MoneyInput } from './MoneyInput'

/** whole packages left to receive (lines ordered by package), else the loose quantity left */
const left = (i: PurchaseOrderItem) => Math.max(0, Math.round((i.quantity - i.receivedQuantity) * 100) / 100)
const leftPackages = (i: PurchaseOrderItem) => (i.packageSize ? Math.floor(left(i) / i.packageSize + 1e-9) : undefined)

type Row = { itemId: number; count?: number; amount?: number; expiryDate?: Dayjs }

/**
 * Phiếu nhập against a purchase order: what arrived for each line (defaults to everything still due),
 * its real amount and expiry. Lines left empty are not received this time.
 */
export function ReceiveModal({ order, onClose }: { order: PurchaseOrder | null; onClose: () => void }) {
  const [form] = Form.useForm<{ note?: string; rows: Row[] }>()
  const due = order?.items.filter((i) => left(i) > 0) ?? []
  const receive = useAction((v: { id: number; body: Parameters<typeof coreApi.receive>[1] }) => coreApi.receive(v.id, v.body),
    [['purchase-orders'], ['purchase-order', order?.id], ['materials'], ['batches'], ['alerts'], ['transactions'], ['goods-receipts'], ['coffees'], ['menu']],
    'Đã nhập kho')

  useEffect(() => {
    if (!order) return
    form.resetFields()
    form.setFieldsValue({
      rows: due.map((i) => {
        const count = i.packageSize ? leftPackages(i) : left(i)
        const qty = i.packageSize ? (count ?? 0) * i.packageSize : left(i)
        return { itemId: i.id, count, amount: i.unitPrice != null ? Math.round(i.unitPrice * qty) : undefined }
      }),
    })
  }, [order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = (Form.useWatch('rows', form) ?? []) as Row[]
  const qtyOf = (i: PurchaseOrderItem, r?: Row) => (r?.count ? (i.packageSize ? Math.round(r.count * i.packageSize * 100) / 100 : r.count) : 0)
  const total = rows.reduce((s, r) => s + (r?.count ? r.amount ?? 0 : 0), 0)

  const submit = (v: { note?: string; rows: Row[] }) => {
    const lines = due.flatMap((i, idx) => {
      const r = v.rows[idx]
      const qty = qtyOf(i, r)
      if (!qty) return []
      return [{
        itemId: i.id,
        packageCount: i.packageSize ? r.count : undefined,
        quantity: i.packageSize ? undefined : r.count,
        unitPrice: r.amount != null ? Math.round((r.amount / qty) * 100) / 100 : undefined,
        expiryDate: r.expiryDate?.format('YYYY-MM-DD'),
      }]
    })
    receive.mutate({ id: order!.id, body: { note: v.note, lines } }, { onSuccess: onClose })
  }

  return (
    <Modal open={!!order} width={980} title={order && `Nhận hàng · ${order.code} · ${order.supplierName}`} onCancel={onClose} destroyOnHidden
      footer={<Button type="primary" loading={receive.isPending} onClick={() => form.submit()}>Nhập kho{total ? ` · ${money(total)}` : ''}</Button>}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Ghi số thực nhận của đợt giao này — mỗi dòng thành 1 lô. Để trống dòng chưa giao; phiếu tự chuyển Hoàn tất khi nhận đủ." />
      <Form form={form} layout="vertical" onFinish={submit}>
        <Table<PurchaseOrderItem> rowKey="id" size="small" pagination={false} dataSource={due} scroll={{ x: 800 }}
          columns={[
            { title: 'Nguyên liệu', dataIndex: 'materialName', render: (v, i) => <><b>{v}</b><div className="a-muted small">Đặt {orderedText(i)}</div></> },
            { title: 'Còn chờ', render: (_, i) => `${num(left(i))} ${i.unit}` },
            {
              title: 'Thực nhận', width: 170, render: (_, i, idx) => (
                <>
                  <Form.Item name={['rows', idx, 'itemId']} hidden initialValue={i.id}><Input /></Form.Item>
                  <Form.Item name={['rows', idx, 'count']} noStyle>
                    <InputNumber min={0} max={i.packageSize ? leftPackages(i) : left(i)} style={{ width: '100%' }}
                      addonAfter={i.packageName ?? i.unit}
                      onChange={(c) => {
                        // keep the line's amount at the ordered price while the count changes
                        const qty = c ? (i.packageSize ? c * i.packageSize : c) : 0
                        if (i.unitPrice != null) form.setFieldValue(['rows', idx, 'amount'], Math.round(i.unitPrice * qty))
                      }} />
                  </Form.Item>
                  {i.packageSize && rows[idx]?.count ? <div className="a-muted small">= {num(qtyOf(i, rows[idx]))} {i.unit}</div> : null}
                </>
              ),
            },
            {
              title: 'Thành tiền', width: 170, render: (_, i, idx) => (
                <Form.Item name={['rows', idx, 'amount']} noStyle><MoneyInput /></Form.Item>
              ),
            },
            {
              title: 'Hạn sử dụng', width: 150, render: (_, _i, idx) => (
                <Form.Item name={['rows', idx, 'expiryDate']} noStyle>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
                </Form.Item>
              ),
            },
          ]} />
        <Form.Item name="note" label="Ghi chú" style={{ marginTop: 12 }}><Input placeholder="Số hóa đơn, người giao…" /></Form.Item>
      </Form>
    </Modal>
  )
}
