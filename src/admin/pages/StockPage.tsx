import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Segmented, Select, Space, Table } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Batch, TransactionReason } from '@/api/types'
import { BATCH_STATUS, DISPOSAL_REASONS, EXPORT_REASONS, TX_REASON, date, money, num, packaging } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { MoneyInput } from '../components/MoneyInput'
import { StatusTag } from '../components/StatusTag'

/**
 * import: phiếu nhập (by package: 10 × Hộp 500 ml, or loose); dispose: phiếu hủy (hết hạn, hỏng, đổ vỡ, pha hỏng);
 * export: xuất khác (trả nhà cung cấp, dùng nội bộ); adjust: kiểm kê.
 * Sales and production take stock by themselves, so there is no general "phiếu xuất".
 */
type Mode = 'import' | 'dispose' | 'export' | 'adjust'

/** loose = imported in the material's own unit, no packaging */
const LOOSE = 0

const lotLabel = (b: Batch) =>
  `#${b.id}${packaging(b) ? ` · ${packaging(b)}` : ''} · còn ${num(b.remainingQuantity)} ${b.unit} · HSD ${date(b.expiryDate)}`

export function StockPage() {
  const { can } = usePerm()
  const [mode, setMode] = useState<Mode>('import')
  const [form] = Form.useForm()
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const materialId = Form.useWatch('materialId', form) as number | undefined
  const { data: batches = [] } = useQuery({ queryKey: ['batches', materialId], queryFn: () => coreApi.batches(materialId!), enabled: !!materialId })
  const material = materials.find((m) => m.id === materialId)
  const packages = material?.packages ?? []
  // same order the backend takes stock in (FEFO): earliest expiry first, lots without expiry last, then oldest lot
  const fefo = batches.filter((b) => b.status === 'AVAILABLE' && b.remainingQuantity > 0)
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || a.id - b.id)

  // Phiếu nhập: packaging + expiry suggested from the latest import (batches come newest first);
  // the expiry keeps that lot's shelf life in days, counted from today.
  const lastImport = batches.find((b) => b.materialId === materialId)
  const shelfDays = lastImport?.expiryDate && lastImport.createdAt
    ? dayjs(lastImport.expiryDate).diff(dayjs(lastImport.createdAt).startOf('day'), 'day') : undefined
  useEffect(() => {
    if (mode !== 'import' || !material) return
    const lastPkg = packages.find((p) => p.name === lastImport?.packageName)
    form.setFieldsValue({
      packageId: lastPkg?.id ?? packages[0]?.id ?? LOOSE,
      expiryDate: shelfDays != null && shelfDays >= 0 ? dayjs().startOf('day').add(shelfDays, 'day') : undefined,
    })
  }, [mode, material?.id, lastImport?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const packageId = Form.useWatch('packageId', form) as number | undefined
  const pkg = packages.find((p) => p.id === packageId)
  const packageCount = Form.useWatch('packageCount', form) as number | undefined
  const looseQty = Form.useWatch('quantity', form) as number | undefined
  const importQty = pkg ? (packageCount ? Math.round(pkg.size * packageCount * 100) / 100 : undefined) : looseQty
  // the whole slip's amount; unit cost of the lot = amount ÷ quantity
  const totalCost = Form.useWatch('totalCost', form) as number | undefined
  const unitCostOf = (total?: number, qty?: number) => (total != null && qty ? Math.round((total / qty) * 100) / 100 : undefined)

  // Phiếu hủy / xuất khác: one lot, the one used next by default
  useEffect(() => {
    if ((mode === 'dispose' || mode === 'export') && fefo.length && !form.getFieldValue('batchId')) form.setFieldsValue({ batchId: fefo[0].id })
  }, [mode, materialId, fefo.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const batchId = Form.useWatch('batchId', form) as number | undefined
  const lot = batches.find((b) => b.id === batchId)
  const reason = Form.useWatch('reason', form) as TransactionReason | undefined

  const keys = [['materials'], ['batches', materialId], ['alerts'], ['transactions'], ['coffees'], ['menu']]
  const imp = useAction(coreApi.importStock, keys, 'Đã nhập kho')
  const dis = useAction(coreApi.disposeStock, keys, 'Đã hủy hàng')
  const exp = useAction(coreApi.exportStock, keys, 'Đã xuất kho')
  const adj = useAction(coreApi.adjustStock, keys, 'Đã điều chỉnh tồn kho')

  const submit = (v: {
    materialId: number; packageId?: number; packageCount?: number; quantity?: number; totalCost?: number; expiryDate?: Dayjs
    note?: string; batchId?: number; actualQuantity?: number; reason?: TransactionReason
  }) => {
    const reset = { onSuccess: () => form.resetFields(['packageCount', 'quantity', 'totalCost', 'note', 'batchId', 'actualQuantity', 'reason']) }
    if (mode === 'import') {
      const byPackage = !!v.packageId && v.packageId !== LOOSE
      imp.mutate({
        materialId: v.materialId,
        packageId: byPackage ? v.packageId : undefined,
        packageCount: byPackage ? v.packageCount : undefined,
        quantity: byPackage ? undefined : v.quantity,
        unitCost: unitCostOf(v.totalCost, importQty),
        note: v.note,
        expiryDate: v.expiryDate?.format('YYYY-MM-DD'),
      }, reset)
    } else if (mode === 'dispose') dis.mutate({ batchId: v.batchId!, quantity: v.quantity!, reason: v.reason!, note: v.note }, reset)
    else if (mode === 'export') exp.mutate({ batchId: v.batchId!, quantity: v.quantity!, reason: v.reason!, note: v.note }, reset)
    else adj.mutate({ batchId: v.batchId!, actualQuantity: v.actualQuantity!, note: v.note }, reset)
  }

  const out = mode === 'dispose' || mode === 'export'
  return (
    <>
      <PageHeader title="Nhập / xuất kho" subtitle="Bán hàng và chế biến tự trừ kho · ở đây: nhập mua, hủy hàng, xuất khác, kiểm kê" />
      <Row gutter={16}>
        <Col xs={24} lg={11}>
          <Card>
            <Segmented block value={mode} onChange={(v) => { setMode(v as Mode); form.resetFields() }} style={{ marginBottom: 16 }}
              options={[
                { value: 'import', label: 'Phiếu nhập' },
                { value: 'dispose', label: 'Phiếu hủy' },
                { value: 'export', label: 'Xuất khác' },
                ...(can(P.MATERIALS_EDIT) ? [{ value: 'adjust', label: 'Kiểm kê' }] : []),
              ]} />
            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item name="materialId" label="Nguyên liệu" rules={[{ required: true }]}
                extra={mode === 'import' ? 'Nguyên liệu chế biến / đang sử dụng: tạo bằng Chế biến ở Nguyên liệu & lô'
                  : mode === 'dispose' ? 'Hàng hết hạn được tự hủy mỗi ngày; phiếu hủy dùng cho hàng hỏng, đổ vỡ, pha hỏng'
                    : mode === 'export' ? 'Hàng rời kho không phải để bán / chế biến: trả nhà cung cấp, dùng nội bộ, thử món' : undefined}>
                <Select showSearch optionFilterProp="label" onChange={() => form.resetFields(['batchId', 'packageId', 'packageCount', 'quantity'])}
                  options={materials.filter((m) => m.status === 'ACTIVE' && (mode !== 'import' || m.kind === 'RAW'))
                    .map((m) => ({ value: m.id, label: `${m.name} — tồn ${num(m.stockQuantity)} ${m.unit}` }))} />
              </Form.Item>

              {mode === 'import' && (
                <>
                  {lastImport && (
                    <div style={{ marginTop: -8, marginBottom: 12, color: '#8c8c8c', fontSize: 13 }}>
                      Lần nhập gần nhất {date(lastImport.createdAt)} (lô #{lastImport.id}): {packaging(lastImport) || `${num(lastImport.importQuantity)} ${lastImport.unit}`}
                      {lastImport.unitCost != null && ` = ${money(lastImport.importQuantity * lastImport.unitCost)}`}
                      {shelfDays != null && ` · bảo quản ${shelfDays} ngày`}
                    </div>
                  )}
                  <div className="a-grid-2">
                    <Form.Item name="packageId" label="Quy cách"
                      extra={material && !packages.length ? 'Chưa khai báo quy cách — thêm ở Nguyên liệu & lô › Xem chi tiết' : undefined}>
                      <Select options={[
                        ...packages.map((p) => ({ value: p.id, label: `${p.name} (${num(p.size)} ${material?.unit ?? ''})` })),
                        { value: LOOSE, label: `Lẻ (${material?.unit ?? 'đơn vị gốc'})` },
                      ]} />
                    </Form.Item>
                    {pkg ? (
                      <Form.Item name="packageCount" label={`Số ${pkg.name.toLowerCase()}`} rules={[{ required: true }]}
                        extra={importQty ? `= ${num(importQty)} ${material?.unit}` : undefined}>
                        <InputNumber min={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    ) : (
                      <Form.Item name="quantity" label={`Số lượng${material ? ` (${material.unit})` : ''}`} rules={[{ required: true }]}>
                        <InputNumber min={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                    )}
                  </div>
                  <div className="a-grid-2">
                    <Form.Item name="totalCost" label="Thành tiền cả phiếu"
                      extra={unitCostOf(totalCost, importQty) != null
                        ? `≈ ${num(unitCostOf(totalCost, importQty))}đ / ${material?.unit ?? 'đơn vị'}${pkg && packageCount ? ` · ${money(totalCost! / packageCount)} / ${pkg.name.toLowerCase()}` : ''}`
                        : undefined}>
                      <MoneyInput step={1000} />
                    </Form.Item>
                    <Form.Item name="expiryDate" label="Hạn sử dụng">
                      <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
                    </Form.Item>
                  </div>
                </>
              )}

              {out && (
                <>
                  <Form.Item name="batchId" label="Lô" rules={[{ required: true }]}>
                    <Select options={fefo.map((b) => ({ value: b.id, label: lotLabel(b) }))} />
                  </Form.Item>
                  <div className="a-grid-2">
                    <Form.Item label={`Số lượng${material ? ` (${material.unit})` : ''}`} required>
                      <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="quantity" noStyle rules={[{ required: true, message: 'Nhập số lượng' }]}>
                          <InputNumber min={0.01} max={lot?.remainingQuantity} style={{ width: '100%' }} />
                        </Form.Item>
                        <Button disabled={!lot} onClick={() => form.setFieldsValue({ quantity: lot?.remainingQuantity })}>Cả lô</Button>
                      </Space.Compact>
                    </Form.Item>
                    <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}>
                      <Select options={(mode === 'dispose' ? DISPOSAL_REASONS : EXPORT_REASONS).map((r) => ({ value: r, label: TX_REASON[r] }))} />
                    </Form.Item>
                  </div>
                </>
              )}

              {mode === 'adjust' && (
                <div className="a-grid-2">
                  <Form.Item name="batchId" label="Lô" rules={[{ required: true }]}>
                    <Select options={batches.filter((b) => b.status === 'AVAILABLE' || b.status === 'DEPLETED').map((b) => ({ value: b.id, label: lotLabel(b) }))} />
                  </Form.Item>
                  <Form.Item name="actualQuantity" label="Số lượng thực tế" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                </div>
              )}
              <Form.Item name="note" label="Ghi chú" rules={mode === 'dispose' ? [{ required: reason === 'OTHER_DISPOSAL', message: 'Ghi rõ lý do hủy' }] : undefined}>
                <Input />
              </Form.Item>
              <Button type="primary" danger={mode === 'dispose'} htmlType="submit" block loading={imp.isPending || dis.isPending || exp.isPending || adj.isPending}>
                {mode === 'import' ? 'Nhập kho' : mode === 'dispose' ? 'Hủy hàng' : mode === 'export' ? 'Xuất kho' : 'Cập nhật tồn kho'}
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={13}>
          <Card title={material ? `Lô hiện có · ${material.name}` : 'Chọn nguyên liệu để xem lô'}>
            <Table rowKey="id" size="small" pagination={false} dataSource={fefo}
              columns={[
                { title: 'Lô', dataIndex: 'id', render: (v, _, i) => <>#{v} {i === 0 && <StatusTag label={{ text: 'Dùng trước', color: 'blue' }} />}</> },
                { title: 'Quy cách', render: (_, b) => packaging(b) || '—' },
                { title: 'Còn lại', render: (_, b) => `${num(b.remainingQuantity)} ${b.unit}` },
                { title: 'Hạn dùng', dataIndex: 'expiryDate', render: date },
                { title: 'Trạng thái', render: (_, b) => <StatusTag label={BATCH_STATUS[b.status]} /> },
              ]} />
          </Card>
        </Col>
      </Row>
    </>
  )
}
