import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Collapse, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Select } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi, type GoodsReceiptPayload } from '@/api/core'
import type { GoodsReceipt, Material, PaymentMethod, PurchaseOrder, PurchaseOrderItem } from '@/api/types'
import { PAYMENT_METHOD, SUPPLIER_PAY_METHODS, VAT_RATES, money, num } from '@/lib/format'
import { orderedText, pricePerLine } from '@/lib/purchase'
import { useAction } from './useCrud'
import { MoneyInput } from './MoneyInput'
import { ImageUpload, type ImageValue } from './ImageUpload'

/** loose = counted in the material's own unit */
const LOOSE = 0

/** still due on a purchase-order line, in the material's unit */
const left = (i: PurchaseOrderItem) => Math.max(0, Math.round((i.quantity - i.receivedQuantity) * 100) / 100)
/** …in whole packages when the line was ordered by package */
const leftCount = (i: PurchaseOrderItem) => (i.packageSize ? Math.floor(left(i) / i.packageSize + 1e-9) : left(i))

/** one line of the form: counts are in the line's packaging (Hộp, Bao…) or the material's unit; price per package / unit */
type Line = {
  itemId?: number; materialId?: number; packageId?: number
  documentCount?: number; receivedCount?: number; rejectedCount?: number; rejectReason?: string
  price?: number; expiryDate?: Dayjs; temperature?: number
}
type Values = {
  supplierId?: number; delivererName?: string; invoiceSeries?: string; invoiceNo?: string; invoiceDate?: Dayjs
  image?: ImageValue; discountAmount?: number; vatRate?: number; shippingCost?: number
  paidAmount?: number; paymentMethod?: PaymentMethod; paymentReference?: string; note?: string; lines: Line[]
}

/** materials kept cold: the receiver measures and writes down the temperature (≤ 5°C) */
const COLD = /sữa|kem|whipping|cream|milk|yaourt|sữa chua/i

/**
 * Phiếu nhập kho (mẫu 01-VT) as it happens at the door:
 * 1. đối chiếu phiếu giao / hóa đơn của nhà cung cấp (SL theo chứng từ);
 * 2. kiểm hàng — đếm, xem bao bì, hạn dùng, đo nhiệt độ hàng mát; phần không đạt thì không nhận (ghi lý do);
 * 3. nhập phần đạt (SL thực nhập) — mỗi dòng thành 1 lô; tiền hàng, giảm giá, VAT, chi phí nhập; trả ngay hoặc ghi nợ.
 * {@code order}: receiving a purchase order (lines prefilled with what is still due); {@code loose}: nhập lẻ.
 */
export function ReceiptModal({ order, loose, onClose, onDone }: {
  order?: PurchaseOrder | null; loose?: boolean; onClose: () => void; onDone?: (r: GoodsReceipt) => void
}) {
  const open = !!order || !!loose
  const [form] = Form.useForm<Values>()
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: coreApi.suppliers, enabled: !!loose })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials, enabled: open })
  const raws = materials.filter((m) => m.kind === 'RAW' && m.status === 'ACTIVE')
  const due = order?.items.filter((i) => left(i) > 0) ?? []
  const save = useAction(
    (b: GoodsReceiptPayload) => (order ? coreApi.receive(order.id, b) : coreApi.createReceipt(b)),
    [['purchase-orders'], ['purchase-order', order?.id], ['materials'], ['batches'], ['alerts'], ['transactions'],
      ['goods-receipts'], ['coffees'], ['menu'], ['supplier-debts']],
    'Đã nhập kho')

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      vatRate: order?.vatRate,
      paymentMethod: 'CASH',
      lines: order
        ? due.map((i) => ({ itemId: i.id, documentCount: leftCount(i), receivedCount: leftCount(i), price: pricePerLine(i) }))
        : [{ packageId: LOOSE }],
    })
  }, [open, order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = Form.useWatch([], form) as Values | undefined
  const lines = v?.lines ?? []
  const supplier = suppliers.find((s) => s.id === v?.supplierId)

  /** packaging of a line: from the purchase-order line, or the package picked on a loose line */
  const lineInfo = (l: Line, idx: number) => {
    if (order) {
      const i = due[idx]
      return { material: raws.find((m) => m.id === i?.materialId), unit: i?.unit ?? '', size: i?.packageSize, pkgName: i?.packageName, item: i }
    }
    const material = raws.find((m) => m.id === l.materialId)
    const pkg = material?.packages?.find((p) => p.id === l.packageId)
    return { material, unit: material?.unit ?? '', size: pkg?.size, pkgName: pkg?.name, item: undefined }
  }
  const amountOf = (l?: Line) => (l?.receivedCount && l.price != null ? Math.round(l.receivedCount * l.price) : 0)
  const goods = lines.reduce((s, l) => s + amountOf(l), 0)
  const afterDiscount = Math.max(0, goods - (v?.discountAmount ?? 0))
  const vat = v?.vatRate ? Math.round((afterDiscount * v.vatRate) / 100) : 0
  const total = afterDiscount + vat + (v?.shippingCost ?? 0)
  const termDays = order?.paymentTermDays ?? supplier?.paymentTermDays ?? 0

  const submit = (x: Values) => {
    const out: GoodsReceiptPayload['lines'] = []
    x.lines.forEach((l, idx) => {
      if (!l.receivedCount && !l.rejectedCount) return
      const info = lineInfo(l, idx)
      out.push({
        itemId: order ? due[idx].id : undefined,
        materialId: order ? undefined : l.materialId,
        packageId: order || !l.packageId || l.packageId === LOOSE ? undefined : l.packageId,
        documentCount: l.documentCount, receivedCount: l.receivedCount ?? 0, rejectedCount: l.rejectedCount,
        rejectReason: l.rejectReason,
        unitPrice: l.price == null ? undefined : Math.round((l.price / (info.size ?? 1)) * 100) / 100,
        expiryDate: l.expiryDate?.format('YYYY-MM-DD'), temperature: l.temperature,
      })
    })
    save.mutate({
      supplierId: order ? undefined : x.supplierId,
      delivererName: x.delivererName, invoiceSeries: x.invoiceSeries, invoiceNo: x.invoiceNo,
      invoiceDate: x.invoiceDate?.format('YYYY-MM-DD'), documentImageId: x.image?.id,
      discountAmount: x.discountAmount, vatRate: x.vatRate, shippingCost: x.shippingCost,
      paidAmount: x.paidAmount, paymentMethod: x.paidAmount ? x.paymentMethod : undefined, paymentReference: x.paymentReference,
      note: x.note, lines: out,
    }, { onSuccess: (r) => { onClose(); onDone?.(r) } })
  }

  const lineRow = (idx: number, remove?: () => void) => {
    const l = lines[idx] ?? {}
    const info = lineInfo(l, idx)
    const per = info.pkgName ?? info.unit
    const short = (l.documentCount ?? 0) - (l.receivedCount ?? 0) - (l.rejectedCount ?? 0)
    const cold = info.material && COLD.test(info.material.name)
    return (
      <div key={idx} className="a-rc-line">
        <div className="a-rc-line-head">
          {order ? (
            <div><b>{info.item?.materialName}</b> <span className="a-muted small">đặt {info.item && orderedText(info.item)} · còn chờ {info.item && `${num(left(info.item))} ${info.unit}`}</span></div>
          ) : (
            <div className="a-grid-2" style={{ flex: 1 }}>
              <Form.Item name={['lines', idx, 'materialId']} rules={[{ required: true, message: 'Chọn nguyên liệu' }]} style={{ marginBottom: 8 }}>
                <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu"
                  onChange={(id) => {
                    const m = raws.find((x: Material) => x.id === id)
                    const sm = supplier?.materials.find((x) => x.materialId === id)
                    const pkg = m?.packages?.find((p) => p.id === sm?.packageId) ?? m?.packages?.[0]
                    form.setFieldValue(['lines', idx], {
                      ...l, materialId: id, packageId: pkg?.id ?? LOOSE,
                      price: sm?.unitPrice == null ? undefined : Math.round(sm.unitPrice * (pkg?.size ?? 1)),
                    })
                  }}
                  options={raws.map((m) => ({ value: m.id, label: m.name, disabled: lines.some((x, i) => i !== idx && x?.materialId === m.id) }))} />
              </Form.Item>
              <Form.Item name={['lines', idx, 'packageId']} style={{ marginBottom: 8 }}>
                <Select options={[
                  ...(info.material?.packages ?? []).map((p) => ({ value: p.id, label: `${p.name} (${num(p.size)} ${info.unit})` })),
                  { value: LOOSE, label: `Lẻ (${info.unit || 'đơn vị gốc'})` },
                ]} />
              </Form.Item>
            </div>
          )}
          {remove && <Button type="text" icon={<MinusCircleOutlined />} onClick={remove} />}
        </div>
        <div className="a-rc-grid">
          <Form.Item name={['lines', idx, 'documentCount']} label="SL theo chứng từ" tooltip="Số lượng ghi trên phiếu giao / hóa đơn của nhà cung cấp">
            <InputNumber min={0} style={{ width: '100%' }} addonAfter={per} />
          </Form.Item>
          <Form.Item name={['lines', idx, 'receivedCount']} label="Thực nhận" rules={[{ required: !order, message: 'Nhập số thực nhận' }]}
            extra={info.size && l.receivedCount ? `= ${num(Math.round(l.receivedCount * info.size * 100) / 100)} ${info.unit}` : undefined}>
            <InputNumber min={0} max={info.item ? leftCount(info.item) : undefined} style={{ width: '100%' }} addonAfter={per} />
          </Form.Item>
          <Form.Item name={['lines', idx, 'rejectedCount']} label="Không nhận" tooltip="Hỏng, móp, sai quy cách, cận / quá hạn, không đủ lạnh — trả lại người giao">
            <InputNumber min={0} style={{ width: '100%' }} addonAfter={per} />
          </Form.Item>
          <Form.Item name={['lines', idx, 'price']} label={`Đơn giá / ${per.toLowerCase() || 'đv'}`}><MoneyInput /></Form.Item>
          <Form.Item name={['lines', idx, 'expiryDate']} label="Hạn sử dụng">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item name={['lines', idx, 'temperature']} label="Nhiệt độ (°C)" tooltip="Hàng mát nhận khi ≤ 5°C"
            validateStatus={cold && l.temperature != null && l.temperature > 5 ? 'warning' : undefined}
            help={cold && l.temperature != null && l.temperature > 5 ? 'Quá 5°C — cân nhắc không nhận' : undefined}>
            <InputNumber min={-50} max={60} step={0.5} style={{ width: '100%' }} placeholder={cold ? 'hàng mát' : ''} />
          </Form.Item>
        </div>
        {!!l.rejectedCount && (
          <Form.Item name={['lines', idx, 'rejectReason']} label="Lý do không nhận" rules={[{ required: true, message: 'Ghi lý do không nhận' }]}>
            <Input placeholder="VD: 1 hộp móp, rò rỉ" />
          </Form.Item>
        )}
        <div className="a-rc-foot">
          {short > 0 && <span className="a-limit">Giao thiếu {num(short)} {per} so với chứng từ · </span>}
          Thành tiền: <b>{money(amountOf(l))}</b>
        </div>
      </div>
    )
  }

  return (
    <Modal open={open} width={1040} destroyOnHidden onCancel={onClose}
      title={order ? `Nhận hàng · ${order.code} · ${order.supplierName}` : 'Phiếu nhập lẻ (không theo phiếu đặt)'}
      footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Nhập kho · {money(total)}</Button>}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Đối chiếu phiếu giao của nhà cung cấp → kiểm hàng (số lượng, bao bì, hạn dùng, nhiệt độ hàng mát) → chỉ nhập phần đạt. Phần không đạt ghi vào 'Không nhận' và trả lại người giao." />
      <Form form={form} layout="vertical" onFinish={submit}>
        <div className="a-grid-3">
          {loose && (
            <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={suppliers.filter((s) => s.status === 'ACTIVE').map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          )}
          <Form.Item name="delivererName" label="Người giao hàng"><Input placeholder="Họ tên người giao" /></Form.Item>
          <Form.Item label="Hóa đơn của nhà cung cấp" tooltip="Ký hiệu · số · ngày; để trống nếu chỉ có phiếu giao hàng">
            <div style={{ display: 'flex', gap: 6 }}>
              <Form.Item name="invoiceSeries" noStyle><Input placeholder="Ký hiệu" style={{ width: 90 }} /></Form.Item>
              <Form.Item name="invoiceNo" noStyle><Input placeholder="Số" style={{ width: 90 }} /></Form.Item>
              <Form.Item name="invoiceDate" noStyle><DatePicker format="DD/MM/YYYY" placeholder="Ngày" disabledDate={(d) => d.isAfter(dayjs())} /></Form.Item>
            </div>
          </Form.Item>
        </div>

        {order ? due.map((_, idx) => lineRow(idx)) : (
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => lineRow(f.name, fields.length > 1 ? () => remove(f.name) : undefined))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ packageId: LOOSE })} style={{ marginBottom: 16 }}>Thêm dòng</Button>
              </>
            )}
          </Form.List>
        )}

        <div className="a-grid-2" style={{ marginTop: 8 }}>
          <div>
            <div className="a-grid-3">
              <Form.Item name="discountAmount" label="Giảm giá"><MoneyInput /></Form.Item>
              <Form.Item name="vatRate" label="Thuế GTGT"><Select allowClear placeholder="Không HĐ" options={VAT_RATES} /></Form.Item>
              <Form.Item name="shippingCost" label="Chi phí nhập" tooltip="Vận chuyển, bốc xếp"><MoneyInput /></Form.Item>
            </div>
            <div className="a-grid-3">
              <Form.Item name="paidAmount" label="Trả ngay"
                tooltip={`Phần còn lại ghi công nợ, hạn ${dayjs().add(termDays, 'day').format('DD/MM/YYYY')} (${termDays ? `nợ ${termDays} ngày` : 'trả ngay'})`}>
                <MoneyInput max={total} />
              </Form.Item>
              <Form.Item name="paymentMethod" label="Hình thức">
                <Select options={SUPPLIER_PAY_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))} />
              </Form.Item>
              <Form.Item name="paymentReference" label="Mã GD chuyển khoản"><Input /></Form.Item>
            </div>
            <Collapse size="small" items={[{
              key: 'doc', label: 'Ảnh phiếu giao / hóa đơn · ghi chú',
              children: <>
                <Form.Item name="image" label="Ảnh chứng từ kèm theo"><ImageUpload /></Form.Item>
                <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
              </>,
            }]} />
          </div>
          <Descriptions size="small" column={1} bordered items={[
            { label: 'Tiền hàng thực nhận', children: money(goods) },
            ...(v?.discountAmount ? [{ label: 'Giảm giá', children: `−${money(v.discountAmount)}` }] : []),
            ...(v?.vatRate != null ? [{ label: `Thuế GTGT ${v.vatRate}%`, children: money(vat) }] : []),
            ...(v?.shippingCost ? [{ label: 'Chi phí nhập', children: money(v.shippingCost) }] : []),
            { label: <b>Cần trả nhà cung cấp</b>, children: <b>{money(total)}</b> },
            { label: 'Trả ngay', children: money(v?.paidAmount ?? 0) },
            { label: 'Ghi công nợ', children: <span className="a-limit">{money(Math.max(0, total - (v?.paidAmount ?? 0)))}</span> },
          ]} />
        </div>
      </Form>
    </Modal>
  )
}
