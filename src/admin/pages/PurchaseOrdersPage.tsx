import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Table,
} from 'antd'
import { MinusCircleOutlined, PlusOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi, type PurchaseOrderPayload } from '@/api/core'
import type { Material, PurchaseOrder, PurchaseOrderStatus, Supplier } from '@/api/types'
import { PO_STATUS, date, dateTime, money, num, options, packaging } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { MoneyInput } from '../components/MoneyInput'
import { useAction } from '../components/useCrud'
import { ReceiveModal } from '../components/purchase'
import { orderedText, pricePerLine, printPurchaseOrder } from '@/lib/purchase'

/** loose = ordered in the material's own unit */
const LOOSE = 0

type Line = { materialId?: number; packageId?: number; count?: number; price?: number; note?: string }
type Draft = { id?: number; supplierId?: number; expectedDate?: Dayjs; note?: string; items: Line[] }

/** how much of the order has arrived, by value of the ordered quantities */
const progress = (o: PurchaseOrder) => {
  const ordered = o.items.reduce((s, i) => s + i.quantity, 0)
  return ordered ? Math.round((o.items.reduce((s, i) => s + Math.min(i.receivedQuantity, i.quantity), 0) / ordered) * 100) : 0
}

/**
 * Suggested line to bring a low-stock material back to twice its minimum, rounded up to whole packages,
 * with the supplier's usual packaging and price.
 */
function suggestLine(m: Material, supplier?: Supplier): Line {
  const sm = supplier?.materials.find((x) => x.materialId === m.id)
  const pkg = m.packages?.find((p) => p.id === sm?.packageId) ?? (sm ? undefined : m.packages?.[0])
  const need = Math.max(m.minStock * 2 - m.stockQuantity, m.minStock, 1)
  return {
    materialId: m.id,
    packageId: pkg?.id ?? LOOSE,
    count: pkg ? Math.ceil(need / pkg.size) : Math.ceil(need),
    price: sm?.unitPrice == null ? undefined : Math.round(sm.unitPrice * (pkg?.size ?? 1)),
  }
}

/**
 * Phiếu đặt hàng nhà cung cấp: Nháp (sửa / xóa / gửi) → Đã đặt (nhận hàng, hủy khi chưa nhận gì)
 * → Nhận một phần (nhận tiếp, đóng phiếu) → Hoàn tất; Đã hủy. Each delivery is a phiếu nhập; each line a lot.
 */
export function PurchaseOrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<PurchaseOrderStatus>()
  const [supplierId, setSupplierId] = useState<number>()
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useQuery({ queryKey: ['purchase-orders', status, supplierId], queryFn: () => coreApi.purchaseOrders({ status, supplierId }) })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: coreApi.suppliers })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const raws = materials.filter((m) => m.kind === 'RAW' && m.status === 'ACTIVE')
  const q = search.trim().toLowerCase()
  const rows = data.filter((o) => !q || o.code.toLowerCase().includes(q) || o.items.some((i) => i.materialName.toLowerCase().includes(q)))

  const [viewId, setViewId] = useState<number>()
  const { data: view } = useQuery({ queryKey: ['purchase-order', viewId], queryFn: () => coreApi.purchaseOrder(viewId!), enabled: !!viewId })
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null)
  const [closing, setClosing] = useState<{ order: PurchaseOrder; action: 'cancel' | 'close' } | null>(null)

  const keys = [['purchase-orders'], ['purchase-order', viewId]]
  const save = useAction((v: PurchaseOrderPayload & { id?: number }) => (v.id ? coreApi.updatePurchaseOrder(v.id, v) : coreApi.createPurchaseOrder(v)), keys, 'Đã lưu phiếu nháp')
  const send = useAction(coreApi.sendPurchaseOrder, keys, 'Đã chuyển sang Đã đặt')
  const remove = useAction(coreApi.deletePurchaseOrder, keys, 'Đã xóa phiếu nháp')
  const cancel = useAction((v: { id: number; reason: string }) => coreApi.cancelPurchaseOrder(v.id, v.reason), keys, 'Đã hủy phiếu')
  const close = useAction((v: { id: number; reason: string }) => coreApi.closePurchaseOrder(v.id, v.reason), keys, 'Đã đóng phiếu')

  // ---- editor (drafts only) ---------------------------------------------
  const [draft, setDraft] = useState<Draft | null>(null)
  const [form] = Form.useForm<Draft>()
  const lines = (Form.useWatch('items', form) ?? []) as Line[]
  const formSupplierId = Form.useWatch('supplierId', form) as number | undefined
  const formSupplier = suppliers.find((s) => s.id === formSupplierId)
  const activeSuppliers = suppliers.filter((s) => s.status === 'ACTIVE' || s.id === draft?.supplierId)
  const openEditor = (d: Draft) => {
    setDraft(d)
    form.resetFields()
    form.setFieldsValue(d)
  }
  const fromOrder = (o: PurchaseOrder): Draft => ({
    id: o.id, supplierId: o.supplierId, note: o.note, expectedDate: o.expectedDate ? dayjs(o.expectedDate) : undefined,
    items: o.items.map((i) => {
      const pkg = raws.find((m) => m.id === i.materialId)?.packages?.find((p) => p.name === i.packageName)
      return {
        materialId: i.materialId, packageId: pkg?.id ?? LOOSE, count: i.packageCount ?? i.quantity,
        price: pricePerLine(i), note: i.note,
      }
    }),
  })

  // "Lập phiếu đặt hàng" from the low-stock alert: a draft with the materials running out, at the supplier selling most of them
  useEffect(() => {
    const ids = (location.state as { materialIds?: number[] } | null)?.materialIds
    if (!ids?.length || !materials.length || !suppliers.length) return
    const low = ids.map((id) => materials.find((m) => m.id === id)).filter((m): m is Material => !!m)
    const best = suppliers.filter((s) => s.status === 'ACTIVE')
      .map((s) => ({ s, n: low.filter((m) => s.materials.some((x) => x.materialId === m.id)).length }))
      .sort((a, b) => b.n - a.n)[0]
    const supplier = best?.n ? best.s : undefined
    openEditor({
      supplierId: supplier?.id,
      items: low.filter((m) => !supplier || supplier.materials.some((x) => x.materialId === m.id)).map((m) => suggestLine(m, supplier)),
      note: 'Bổ sung nguyên liệu sắp hết',
    })
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, materials.length, suppliers.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const sizeOf = (l: Line) => raws.find((m) => m.id === l.materialId)?.packages?.find((p) => p.id === l.packageId)?.size
  const lineTotal = (l?: Line) => (l?.count && l.price != null ? l.count * l.price : 0)
  const draftTotal = lines.reduce((s, l) => s + lineTotal(l), 0)
  const submit = (v: Draft) => save.mutate({
    id: draft?.id,
    supplierId: v.supplierId!,
    expectedDate: v.expectedDate?.format('YYYY-MM-DD'),
    note: v.note,
    items: v.items.map((l) => {
      const byPackage = !!l.packageId && l.packageId !== LOOSE
      const size = byPackage ? sizeOf(l) ?? 1 : 1
      return {
        materialId: l.materialId!,
        packageId: byPackage ? l.packageId : undefined,
        packageCount: byPackage ? l.count : undefined,
        quantity: byPackage ? undefined : l.count,
        unitPrice: l.price == null ? undefined : Math.round((l.price / size) * 100) / 100,
        note: l.note,
      }
    }),
  }, { onSuccess: (o) => { setDraft(null); setViewId(o.id) } })

  // ---- actions available in each status ---------------------------------
  const actions = (o: PurchaseOrder) => (
    <Space wrap>
      {o.status === 'DRAFT' && <>
        <Button onClick={() => openEditor(fromOrder(o))}>Sửa</Button>
        <Popconfirm title="Gửi phiếu cho nhà cung cấp?" description="Sau khi gửi không sửa được nữa." onConfirm={() => send.mutate(o.id)}>
          <Button type="primary">Gửi nhà cung cấp</Button>
        </Popconfirm>
        <Popconfirm title="Xóa phiếu nháp?" onConfirm={() => remove.mutate(o.id, { onSuccess: () => setViewId(undefined) })}>
          <Button danger>Xóa</Button>
        </Popconfirm>
      </>}
      {(o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED') && <Button type="primary" onClick={() => setReceiving(o)}>Nhận hàng</Button>}
      {o.status === 'ORDERED' && <Button danger onClick={() => setClosing({ order: o, action: 'cancel' })}>Hủy phiếu</Button>}
      {o.status === 'PARTIALLY_RECEIVED' && <Button onClick={() => setClosing({ order: o, action: 'close' })}>Đóng phiếu (thiếu hàng)</Button>}
      <Button icon={<PrinterOutlined />} onClick={() => printPurchaseOrder(o)}>In phiếu</Button>
    </Space>
  )

  return (
    <>
      <PageHeader title="Phiếu đặt hàng" subtitle="Đặt nguyên liệu từ nhà cung cấp · mỗi lần giao hàng lập 1 phiếu nhập, mỗi dòng nhận về thành 1 lô"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor({ items: [{ packageId: LOOSE }] })}>Lập phiếu đặt hàng</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã phiếu, nguyên liệu" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 170 }} value={status} onChange={setStatus} options={options(PO_STATUS)} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="Nhà cung cấp" style={{ width: 240 }} value={supplierId} onChange={setSupplierId}
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
      </Space>
      <Table<PurchaseOrder> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 900 }}
        onRow={(o) => ({ onClick: () => setViewId(o.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Mã phiếu', dataIndex: 'code', render: (v) => <b>{v}</b> },
          { title: 'Nhà cung cấp', dataIndex: 'supplierName' },
          { title: 'Ngày lập', dataIndex: 'createdAt', render: date },
          { title: 'Hẹn giao', dataIndex: 'expectedDate', render: (v, o) => <span className={v && dayjs(v).isBefore(dayjs(), 'day') && (o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED') ? 'a-limit' : ''}>{date(v)}</span> },
          { title: 'Số dòng', render: (_, o) => o.items.length, align: 'right' },
          { title: 'Tổng tiền', dataIndex: 'totalAmount', render: money, align: 'right' },
          {
            title: 'Đã nhận', width: 140, render: (_, o) => (o.status === 'DRAFT' || o.status === 'CANCELLED'
              ? <span className="a-muted">—</span> : <Progress percent={progress(o)} size="small" />),
          },
          { title: 'Trạng thái', render: (_, o) => <StatusTag label={PO_STATUS[o.status]} /> },
        ]} />

      <Drawer open={!!viewId} width={860} onClose={() => setViewId(undefined)} title={view ? `${view.code} · ${view.supplierName}` : 'Phiếu đặt hàng'}
        extra={view && <StatusTag label={PO_STATUS[view.status]} />}>
        {view && <>
          <div style={{ marginBottom: 16 }}>{actions(view)}</div>
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }} items={[
            { label: 'Nhà cung cấp', children: <>{view.supplierName}{view.supplierPhone && <div className="a-muted small">{view.supplierPhone}</div>}</> },
            { label: 'Người lập', children: view.staffName ?? view.createdBy ?? '—' },
            { label: 'Ngày lập', children: dateTime(view.createdAt) },
            { label: 'Gửi nhà cung cấp', children: dateTime(view.orderedAt) },
            { label: 'Hẹn giao', children: date(view.expectedDate) },
            { label: view.status === 'CANCELLED' ? 'Ngày hủy' : 'Hoàn tất', children: dateTime(view.completedAt) },
            ...(view.note ? [{ label: 'Ghi chú', children: view.note, span: 2 }] : []),
            ...(view.closeReason ? [{ label: view.status === 'CANCELLED' ? 'Lý do hủy' : 'Lý do đóng phiếu', children: view.closeReason, span: 2 }] : []),
          ]} />
          <Table rowKey="id" size="small" pagination={false} dataSource={view.items}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right"><b>Tổng cộng</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{money(view.totalAmount)}</b></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            columns={[
              { title: 'Nguyên liệu', dataIndex: 'materialName', render: (v, i) => <>{v}{i.note && <div className="a-muted small">{i.note}</div>}</> },
              { title: 'Đặt', render: (_, i) => orderedText(i) },
              { title: 'Đơn giá', render: (_, i) => (i.unitPrice == null ? '—' : `${money(pricePerLine(i))} / ${i.packageName?.toLowerCase() ?? i.unit}`) },
              {
                title: 'Đã nhận', render: (_, i) => (
                  <span className={i.receivedQuantity >= i.quantity ? '' : i.receivedQuantity > 0 ? 'a-limit' : 'a-muted'}>
                    {num(i.receivedQuantity)} / {num(i.quantity)} {i.unit}
                  </span>
                ),
              },
              { title: 'Thành tiền', dataIndex: 'amount', render: money, align: 'right' },
            ]} />

          <h3 style={{ marginTop: 24 }}>Phiếu nhập ({view.receipts?.length ?? 0})</h3>
          {view.receipts?.length ? view.receipts.map((r) => (
            <div key={r.id} style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 6 }}>
                <b>{r.code}</b> · {dateTime(r.createdAt)} · {r.staffName ?? r.createdBy} · {money(r.totalAmount)}
                {r.note && <span className="a-muted"> · {r.note}</span>}
              </div>
              <Table rowKey="id" size="small" pagination={false} dataSource={r.lines}
                columns={[
                  { title: 'Lô', dataIndex: 'id', render: (v) => `#${v}` },
                  { title: 'Nguyên liệu', dataIndex: 'materialName' },
                  { title: 'Số lượng', render: (_, b) => <>{packaging(b) && `${packaging(b)} = `}{num(b.importQuantity)} {b.unit}</> },
                  { title: 'Thành tiền', render: (_, b) => (b.unitCost == null ? '—' : money(b.importQuantity * b.unitCost)), align: 'right' },
                  { title: 'HSD', dataIndex: 'expiryDate', render: date },
                ]} />
            </div>
          )) : <Empty description={view.status === 'DRAFT' ? 'Phiếu nháp — gửi nhà cung cấp rồi mới nhận hàng' : 'Chưa nhận đợt hàng nào'} />}
        </>}
      </Drawer>

      <Modal open={!!draft} width={980} title={draft?.id ? 'Sửa phiếu đặt hàng (nháp)' : 'Lập phiếu đặt hàng'} onCancel={() => setDraft(null)} forceRender
        footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Lưu nháp{draftTotal ? ` · ${money(draftTotal)}` : ''}</Button>}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <div className="a-grid-2">
            <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true }]}
              extra={formSupplier && !formSupplier.materials.length ? 'Nhà cung cấp chưa khai báo nguyên liệu — chọn tự do bên dưới' : undefined}>
              <Select showSearch optionFilterProp="label" options={activeSuppliers.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(id) => {
                  // re-price the lines this supplier has a price for
                  const s = suppliers.find((x) => x.id === id)
                  form.setFieldValue('items', (form.getFieldValue('items') as Line[]).map((l) => {
                    const m = raws.find((x) => x.id === l.materialId)
                    const sm = s?.materials.find((x) => x.materialId === l.materialId)
                    return m && sm?.unitPrice != null ? { ...l, price: Math.round(sm.unitPrice * (sizeOf(l) ?? 1)) } : l
                  }))
                }} />
            </Form.Item>
            <Form.Item name="expectedDate" label="Hẹn giao">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </div>
          <Form.List name="items" rules={[{ validator: async (_, v) => { if (!v?.length) throw new Error('Thêm ít nhất 1 nguyên liệu') } }]}>
            {(fields, { add, remove: drop }, { errors }) => (
              <>
                <div className="a-po-lines a-po-head">
                  <span>Nguyên liệu</span><span>Quy cách</span><span>Số lượng</span><span>Đơn giá</span><span>Thành tiền</span><span />
                </div>
                {fields.map((f) => {
                  const line = lines[f.name] ?? {}
                  const material = raws.find((m) => m.id === line.materialId)
                  const pkg = material?.packages?.find((p) => p.id === line.packageId)
                  const sold = formSupplier?.materials.map((x) => x.materialId) ?? []
                  return (
                    <div key={f.key} className="a-po-lines">
                      <Form.Item name={[f.name, 'materialId']} rules={[{ required: true, message: 'Chọn nguyên liệu' }]}
                        extra={material && `Tồn ${num(material.stockQuantity)} ${material.unit} · tối thiểu ${num(material.minStock)}`}>
                        <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu"
                          onChange={(id) => {
                            const m = raws.find((x) => x.id === id)
                            if (m) form.setFieldValue(['items', f.name], { ...suggestLine(m, formSupplier), count: undefined })
                          }}
                          options={[...raws].sort((a, b) => Number(sold.includes(b.id)) - Number(sold.includes(a.id))).map((m) => ({
                            value: m.id,
                            label: `${m.name}${sold.includes(m.id) ? ' ★' : ''}${m.lowStock ? ' (sắp hết)' : ''}`,
                            disabled: lines.some((l, i) => i !== f.name && l?.materialId === m.id),
                          }))} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'packageId']}>
                        <Select options={[
                          ...(material?.packages ?? []).map((p) => ({ value: p.id, label: `${p.name} (${num(p.size)} ${material!.unit})` })),
                          { value: LOOSE, label: `Lẻ (${material?.unit ?? 'đơn vị gốc'})` },
                        ]} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'count']} rules={[{ required: true, message: 'Nhập số lượng' }]}
                        extra={pkg && line.count ? `= ${num(pkg.size * line.count)} ${material?.unit}` : undefined}>
                        <InputNumber min={0.01} style={{ width: '100%' }} addonAfter={pkg?.name ?? material?.unit} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'price']}>
                        <MoneyInput placeholder={`/ ${pkg?.name.toLowerCase() ?? material?.unit ?? 'đơn vị'}`} />
                      </Form.Item>
                      <div className="a-po-amount">{lineTotal(line) ? money(lineTotal(line)) : '—'}</div>
                      <Button type="text" icon={<MinusCircleOutlined />} onClick={() => drop(f.name)} />
                    </div>
                  )
                })}
                <Form.ErrorList errors={errors} />
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ packageId: LOOSE })} style={{ margin: '4px 0 16px' }}>
                  Thêm nguyên liệu
                </Button>
              </>
            )}
          </Form.List>
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        </Form>
      </Modal>

      <ReceiveModal order={receiving} onClose={() => setReceiving(null)} />

      <Modal open={!!closing} title={closing?.action === 'cancel' ? `Hủy phiếu ${closing.order.code}` : `Đóng phiếu ${closing?.order.code}`}
        onCancel={() => setClosing(null)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { reason: string }) => {
          const done = { onSuccess: () => setClosing(null) }
          if (closing!.action === 'cancel') cancel.mutate({ id: closing!.order.id, reason: v.reason }, done)
          else close.mutate({ id: closing!.order.id, reason: v.reason }, done)
        }}>
          <p className="a-muted">{closing?.action === 'cancel'
            ? 'Phiếu chưa nhận hàng; hủy để báo nhà cung cấp không giao nữa.'
            : 'Nhà cung cấp không giao phần còn lại: phiếu chuyển Hoàn tất với số đã nhận.'}</p>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" danger={closing?.action === 'cancel'} htmlType="submit" block loading={cancel.isPending || close.isPending}>
            {closing?.action === 'cancel' ? 'Hủy phiếu' : 'Đóng phiếu'}
          </Button>
        </Form>
      </Modal>
    </>
  )
}
