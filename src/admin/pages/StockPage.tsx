import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Row, Segmented, Select, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { Batch, PurchaseOrder, TransactionReason } from '@/api/types'
import { BATCH_STATUS, DISPOSAL_REASONS, EXPORT_REASONS, PO_STATUS, TX_REASON, date, num, packaging } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { StatusTag } from '../components/StatusTag'
import { ReceiptModal } from '../components/purchase'

/**
 * import: nhận hàng — theo phiếu đặt (danh sách chờ giao) hoặc nhập lẻ; both make a phiếu nhập (mẫu 01-VT);
 * dispose: phiếu hủy (hết hạn, hỏng, đổ vỡ, pha hỏng); export: xuất khác (dùng nội bộ, thử món). Kiểm kê has its own phiếu.
 * Sales and production take stock by themselves, trả hàng nhà cung cấp has its own phiếu, so there is no general "phiếu xuất".
 */
type Mode = 'import' | 'dispose' | 'export'

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
  const { data: orders = [] } = useQuery({ queryKey: ['purchase-orders', 'open'], queryFn: () => coreApi.purchaseOrders(), enabled: mode === 'import' })
  const waiting = orders.filter((o) => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED')
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null)
  const [loose, setLoose] = useState(false)
  // same order the backend takes stock in (FEFO): earliest expiry first, lots without expiry last, then oldest lot
  const fefo = batches.filter((b) => b.status === 'AVAILABLE' && b.remainingQuantity > 0)
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || a.id - b.id)

  // Phiếu hủy / xuất khác: one lot, the one used next by default
  useEffect(() => {
    if ((mode === 'dispose' || mode === 'export') && fefo.length && !form.getFieldValue('batchId')) form.setFieldsValue({ batchId: fefo[0].id })
  }, [mode, materialId, fefo.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const batchId = Form.useWatch('batchId', form) as number | undefined
  const lot = batches.find((b) => b.id === batchId)
  const reason = Form.useWatch('reason', form) as TransactionReason | undefined

  const keys = [['materials'], ['batches', materialId], ['alerts'], ['transactions'], ['coffees'], ['menu']]
  const dis = useAction(coreApi.disposeStock, keys, 'Đã hủy hàng')
  const exp = useAction(coreApi.exportStock, keys, 'Đã xuất kho')

  const submit = (v: { quantity?: number; note?: string; batchId?: number; reason?: TransactionReason }) => {
    const reset = { onSuccess: () => form.resetFields(['quantity', 'note', 'batchId', 'reason']) }
    if (mode === 'dispose') dis.mutate({ batchId: v.batchId!, quantity: v.quantity!, reason: v.reason!, note: v.note }, reset)
    else exp.mutate({ batchId: v.batchId!, quantity: v.quantity!, reason: v.reason!, note: v.note }, reset)
  }

  const out = mode === 'dispose' || mode === 'export'
  return (
    <>
      <PageHeader title="Nhập / xuất kho" subtitle="Bán hàng và chế biến tự trừ kho · ở đây: nhận hàng, hủy hàng, xuất dùng nội bộ"
        extra={can(P.STOCKTAKES) && <Link to="/admin/stocktakes"><Button>Kiểm kê kho</Button></Link>} />
      <Row gutter={16}>
        <Col xs={24} lg={11}>
          <Card>
            <Segmented block value={mode} onChange={(v) => { setMode(v as Mode); form.resetFields() }} style={{ marginBottom: 16 }}
              options={[
                { value: 'import', label: 'Nhận hàng' },
                { value: 'dispose', label: 'Phiếu hủy' },
                { value: 'export', label: 'Xuất khác' },
              ]} />
            {mode === 'import' ? (
              <>
                <Alert type="info" showIcon style={{ marginBottom: 16 }}
                  message="Hàng đã đặt: bấm 'Nhận hàng' ở phiếu đặt bên cạnh. Mua lẻ không qua phiếu đặt (đi chợ, mua gấp): lập phiếu nhập lẻ — vẫn phải chọn nhà cung cấp."
                  description={<>Mỗi lần nhận là 1 phiếu nhập (mẫu 01-VT); xem lại, in, hủy hoặc trả hàng ở <Link to="/admin/goods-receipts">Phiếu nhập kho</Link>.</>} />
                <Button type="primary" block icon={<PlusOutlined />} onClick={() => setLoose(true)}>Lập phiếu nhập lẻ</Button>
              </>
            ) : (
              <Form form={form} layout="vertical" onFinish={submit}>
                <Form.Item name="materialId" label="Nguyên liệu" rules={[{ required: true }]}
                  extra={mode === 'dispose' ? 'Hàng hết hạn được tự hủy mỗi ngày; phiếu hủy dùng cho hàng hỏng, đổ vỡ, pha hỏng'
                    : mode === 'export' ? 'Hàng rời kho không phải để bán / chế biến: dùng nội bộ, thử món. Trả nhà cung cấp: lập phiếu trả hàng nhập' : undefined}>
                  <Select showSearch optionFilterProp="label" onChange={() => form.resetFields(['batchId', 'quantity'])}
                    options={materials.filter((m) => m.status === 'ACTIVE').map((m) => ({ value: m.id, label: `${m.name} — tồn ${num(m.stockQuantity)} ${m.unit}` }))} />
                </Form.Item>

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

                <Form.Item name="note" label="Ghi chú" rules={mode === 'dispose' ? [{ required: reason === 'OTHER_DISPOSAL', message: 'Ghi rõ lý do hủy' }] : undefined}>
                  <Input />
                </Form.Item>
                <Button type="primary" danger={mode === 'dispose'} htmlType="submit" block loading={dis.isPending || exp.isPending}>
                  {mode === 'dispose' ? 'Hủy hàng' : 'Xuất kho'}
                </Button>
              </Form>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={13}>
          {mode === 'import' ? (
            <Card title={`Phiếu đặt chờ nhận hàng (${waiting.length})`}>
              {waiting.length ? (
                <Table<PurchaseOrder> rowKey="id" size="small" pagination={false} dataSource={waiting}
                  columns={[
                    { title: 'Phiếu', render: (_, o) => <><b>{o.code}</b><div className="a-muted small">{o.supplierName}</div></> },
                    { title: 'Còn chờ', render: (_, o) => o.items.filter((i) => i.receivedQuantity < i.quantity).map((i) => <div key={i.id} className="small">{i.materialName}: {num(i.quantity - i.receivedQuantity)} {i.unit}</div>) },
                    { title: 'Hẹn giao', dataIndex: 'expectedDate', render: date },
                    { title: '', render: (_, o) => <><StatusTag label={PO_STATUS[o.status]} /><Button size="small" type="primary" onClick={() => setReceiving(o)}>Nhận hàng</Button></> },
                  ]} />
              ) : <Empty description="Không có phiếu đặt nào đang chờ giao" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </Card>
          ) : (
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
          )}
        </Col>
      </Row>
      <ReceiptModal order={receiving} onClose={() => setReceiving(null)} />
      <ReceiptModal loose={loose} onClose={() => setLoose(false)} />
    </>
  )
}
