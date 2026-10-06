import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Segmented, Select, Table } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import { BATCH_STATUS, date, num } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'
import { MoneyInput } from '../components/MoneyInput'
import { StatusTag } from '../components/StatusTag'

type Mode = 'import' | 'export' | 'adjust'

/** Phiếu nhập / xuất / kiểm kê (BPMN-03). Xuất tự chọn lô hạn dùng gần nhất (FEFO). Người thực hiện = tài khoản đăng nhập. */
export function StockPage() {
  const { can } = usePerm()
  const [mode, setMode] = useState<Mode>('import')
  const [form] = Form.useForm()
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const materialId = Form.useWatch('materialId', form) as number | undefined
  const { data: batches = [] } = useQuery({ queryKey: ['batches', materialId], queryFn: () => coreApi.batches(materialId!), enabled: !!materialId })
  const material = materials.find((m) => m.id === materialId)
  const keys = [['materials'], ['batches', materialId], ['alerts'], ['transactions']]
  const imp = useAction(coreApi.importStock, keys, 'Đã nhập kho')
  const exp = useAction(coreApi.exportStock, keys, 'Đã xuất kho')
  const adj = useAction(coreApi.adjustStock, keys, 'Đã điều chỉnh tồn kho')

  const submit = (v: { materialId: number; quantity: number; unitCost?: number; expiryDate?: Dayjs; note?: string; batchId?: number; actualQuantity?: number }) => {
    const reset = { onSuccess: () => form.resetFields(['quantity', 'unitCost', 'expiryDate', 'note', 'batchId', 'actualQuantity']) }
    if (mode === 'import') imp.mutate({ materialId: v.materialId, quantity: v.quantity, unitCost: v.unitCost, note: v.note, expiryDate: v.expiryDate?.format('YYYY-MM-DD') }, reset)
    else if (mode === 'export') exp.mutate({ materialId: v.materialId, quantity: v.quantity, note: v.note }, reset)
    else adj.mutate({ batchId: v.batchId!, actualQuantity: v.actualQuantity!, note: v.note }, reset)
  }

  return (
    <>
      <PageHeader title="Nhập / xuất kho" subtitle="Nhập theo lô · xuất FEFO (hạn dùng gần nhất trước) · kiểm kê điều chỉnh" />
      <Row gutter={16}>
        <Col xs={24} lg={11}>
          <Card>
            <Segmented block value={mode} onChange={(v) => setMode(v as Mode)} style={{ marginBottom: 16 }}
              options={[
                { value: 'import', label: 'Phiếu nhập' },
                { value: 'export', label: 'Phiếu xuất' },
                ...(can(P.MATERIALS_EDIT) ? [{ value: 'adjust', label: 'Kiểm kê' }] : []),
              ]} />
            <Form form={form} layout="vertical" onFinish={submit}>
              <Form.Item name="materialId" label="Nguyên liệu" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={materials.filter((m) => m.status === 'ACTIVE').map((m) => ({ value: m.id, label: `${m.name} — tồn ${num(m.stockQuantity)} ${m.unit}` }))} />
              </Form.Item>
              {mode !== 'adjust' && (
                <Form.Item name="quantity" label={`Số lượng${material ? ` (${material.unit})` : ''}`} rules={[{ required: true }]}>
                  <InputNumber min={0.01} max={mode === 'export' ? material?.stockQuantity : undefined} style={{ width: '100%' }} />
                </Form.Item>
              )}
              {mode === 'import' && (
                <div className="a-grid-2">
                  <Form.Item name="unitCost" label={`Đơn giá nhập / ${material?.unit ?? 'đơn vị'}`}><MoneyInput step={1} /></Form.Item>
                  <Form.Item name="expiryDate" label="Hạn sử dụng">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
                  </Form.Item>
                </div>
              )}
              {mode === 'adjust' && (
                <div className="a-grid-2">
                  <Form.Item name="batchId" label="Lô" rules={[{ required: true }]}>
                    <Select options={batches.filter((b) => b.status !== 'EXPIRED').map((b) => ({ value: b.id, label: `#${b.id} · còn ${num(b.remainingQuantity)} · HSD ${date(b.expiryDate)}` }))} />
                  </Form.Item>
                  <Form.Item name="actualQuantity" label="Số lượng thực tế" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                </div>
              )}
              <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" block loading={imp.isPending || exp.isPending || adj.isPending}>
                {mode === 'import' ? 'Nhập kho' : mode === 'export' ? 'Xuất kho' : 'Cập nhật tồn kho'}
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={13}>
          <Card title={material ? `Lô hiện có · ${material.name}` : 'Chọn nguyên liệu để xem lô'}>
            <Table rowKey="id" size="small" pagination={false} dataSource={batches.filter((b) => b.status === 'AVAILABLE')}
              columns={[
                { title: 'Lô', dataIndex: 'id', render: (v, _, i) => <>#{v} {i === 0 && mode === 'export' && <StatusTag label={{ text: 'Xuất trước', color: 'blue' }} />}</> },
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
