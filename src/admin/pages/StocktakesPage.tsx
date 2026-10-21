import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { coreApi, type StocktakePayload } from '@/api/core'
import type { Stocktake, StocktakeLine, StockQuality, StocktakeStatus } from '@/api/types'
import { STOCKTAKE_STATUS, STOCK_QUALITY, date, dateTime, money, num, options } from '@/lib/format'
import { printStocktake } from '@/lib/purchase'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'

type Count = { countedQuantity?: number; quality?: StockQuality; reason?: string }

/**
 * Kiểm kê kho (mẫu 05-VT): lập phiếu với các nguyên liệu cần đếm (SL theo sổ được chốt lúc lập) → đếm thực tế từng lô,
 * ghi phẩm chất và nguyên nhân chênh lệch → quản lý duyệt "cân bằng kho" (thừa / thiếu thành điều chỉnh tồn).
 * Hàng kém / mất phẩm chất sau đó hủy bằng phiếu hủy ở Nhập / xuất kho.
 */
export function StocktakesPage() {
  const [status, setStatus] = useState<StocktakeStatus>()
  const { data = [], isLoading } = useQuery({ queryKey: ['stocktakes', status], queryFn: () => coreApi.stocktakes(status) })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const [viewId, setViewId] = useState<number>()
  const { data: view } = useQuery({ queryKey: ['stocktake', viewId], queryFn: () => coreApi.stocktake(viewId!), enabled: !!viewId })
  const keys = [['stocktakes'], ['stocktake', viewId], ['materials'], ['batches'], ['alerts'], ['transactions']]
  const create = useAction(coreApi.createStocktake, keys, 'Đã lập phiếu kiểm kê')
  const save = useAction((v: { id: number; b: StocktakePayload }) => coreApi.updateStocktake(v.id, v.b), keys, 'Đã lưu số đếm')
  const balance = useAction((v: { id: number; resolution?: string }) => coreApi.balanceStocktake(v.id, v.resolution), keys, 'Đã cân bằng kho')
  const cancel = useAction(coreApi.cancelStocktake, keys, 'Đã hủy phiếu')

  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm<{ materialIds?: number[]; members?: string; note?: string }>()
  const [form] = Form.useForm<{ rows: Count[]; members?: string; note?: string }>()
  const [balancing, setBalancing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'todo' | 'diff'>('all')

  useEffect(() => {
    if (!view) return
    form.setFieldsValue({
      members: view.members, note: view.note,
      rows: (view.items ?? []).map((l) => ({ countedQuantity: l.countedQuantity, quality: l.quality, reason: l.reason })),
    })
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (Form.useWatch('rows', form) ?? []) as Count[]
  const draft = view?.status === 'DRAFT'
  const items = (view?.items ?? []).map((l, idx) => ({ ...l, idx }))
  const diffOf = (l: StocktakeLine & { idx: number }) => (rows[l.idx]?.countedQuantity == null ? 0 : rows[l.idx].countedQuantity! - l.bookQuantity)
  const shown = items.filter((l) => filter === 'all' || (filter === 'todo' ? rows[l.idx]?.countedQuantity == null : diffOf(l) !== 0))
  const counts = () => (view?.items ?? []).map((l, idx) => ({ itemId: l.id, ...form.getFieldValue(['rows', idx]) }))
  const saveCounts = (then?: () => void) => save.mutate({ id: view!.id, b: { members: form.getFieldValue('members'), note: form.getFieldValue('note'), counts: counts() } }, { onSuccess: then })

  return (
    <>
      <PageHeader title="Kiểm kê kho" subtitle="Đếm thực tế từng lô, so với sổ · thừa / thiếu được cân bằng khi quản lý duyệt"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreating(true); createForm.resetFields() }}>Lập phiếu kiểm kê</Button>} />
      <Select allowClear placeholder="Trạng thái" style={{ width: 180, marginBottom: 12 }} value={status} onChange={setStatus} options={options(STOCKTAKE_STATUS)} />
      <Table<Stocktake> rowKey="id" loading={isLoading} dataSource={data} onRow={(s) => ({ onClick: () => setViewId(s.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Số phiếu', dataIndex: 'code', render: (v) => <b>{v}</b> },
          { title: 'Thời điểm kiểm', dataIndex: 'countedAt', render: dateTime },
          { title: 'Người kiểm', render: (_, s) => <>{s.staffName ?? s.createdBy}{s.members && <div className="a-muted small">{s.members}</div>}</> },
          { title: 'Đã đếm', render: (_, s) => `${s.countedCount}/${s.lineCount} lô` },
          { title: 'Thừa', dataIndex: 'surplusValue', render: (v: number) => (v ? money(v) : '—'), align: 'right' },
          { title: 'Thiếu', dataIndex: 'shortageValue', render: (v: number) => (v ? <span className="a-limit">{money(v)}</span> : '—'), align: 'right' },
          { title: 'Trạng thái', render: (_, s) => <StatusTag label={STOCKTAKE_STATUS[s.status]} /> },
        ]} />

      <Drawer open={!!viewId} width={1080} onClose={() => setViewId(undefined)} title={view && `${view.code} · kiểm lúc ${dateTime(view.countedAt)}`}
        extra={view && <StatusTag label={STOCKTAKE_STATUS[view.status]} />}>
        {view && <Form form={form} layout="vertical">
          <Space wrap style={{ marginBottom: 12 }}>
            <Button icon={<PrinterOutlined />} onClick={() => printStocktake(view)}>In biên bản (05-VT)</Button>
            {draft && <>
              <Button type="primary" loading={save.isPending} onClick={() => saveCounts()}>Lưu số đếm</Button>
              <Button type="primary" danger onClick={() => saveCounts(() => setBalancing(true))}>Cân bằng kho</Button>
              <Popconfirm title="Hủy phiếu kiểm kê?" onConfirm={() => cancel.mutate(view.id)}><Button>Hủy phiếu</Button></Popconfirm>
            </>}
            <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[
              { value: 'all', label: `Tất cả (${items.length})` },
              { value: 'todo', label: `Chưa đếm (${items.filter((l) => rows[l.idx]?.countedQuantity == null).length})` },
              { value: 'diff', label: `Lệch (${items.filter((l) => diffOf(l) !== 0).length})` },
            ]} />
          </Space>
          {view.status === 'BALANCED' && (
            <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`Đã cân bằng kho lúc ${dateTime(view.balancedAt)} bởi ${view.balancedByName ?? '—'}`}
              description={view.resolution && `Ý kiến giải quyết: ${view.resolution}`} />
          )}
          <div className="a-grid-2">
            <Form.Item name="members" label="Ban kiểm kê (người cùng kiểm)"><Input disabled={!draft} /></Form.Item>
            <Form.Item name="note" label="Ghi chú"><Input disabled={!draft} /></Form.Item>
          </div>
          <Table rowKey="id" size="small" pagination={false} dataSource={shown} scroll={{ x: 980 }}
            columns={[
              { title: 'Nguyên liệu · lô', render: (_, l) => <><b>{l.materialName}</b><div className="a-muted small">Lô #{l.batchId}{l.expiryDate && ` · HSD ${date(l.expiryDate)}`}</div></> },
              { title: 'Theo sổ', render: (_, l) => `${num(l.bookQuantity)} ${l.unit}` },
              {
                title: 'Thực tế', width: 160, render: (_, l) => (draft
                  ? <Form.Item name={['rows', l.idx, 'countedQuantity']} noStyle><InputNumber min={0} style={{ width: '100%' }} addonAfter={l.unit} /></Form.Item>
                  : l.countedQuantity == null ? '—' : `${num(l.countedQuantity)} ${l.unit}`),
              },
              {
                title: 'Chênh lệch', render: (_, l) => {
                  const d = draft ? diffOf(l) : l.difference
                  if (!d) return rows[l.idx]?.countedQuantity == null && draft ? <span className="a-muted">chưa đếm</span> : <Tag color="green">Khớp</Tag>
                  return <Tag color={d > 0 ? 'blue' : 'red'}>{d > 0 ? 'Thừa' : 'Thiếu'} {num(Math.abs(d))} {l.unit}{l.unitCost != null && ` · ${money(Math.abs(d) * l.unitCost)}`}</Tag>
                },
              },
              {
                title: 'Phẩm chất', width: 150, render: (_, l) => (draft
                  ? <Form.Item name={['rows', l.idx, 'quality']} noStyle><Select style={{ width: '100%' }} options={options(STOCK_QUALITY)} /></Form.Item>
                  : STOCK_QUALITY[l.quality]),
              },
              {
                title: 'Nguyên nhân', width: 220, render: (_, l) => (draft
                  ? <Form.Item name={['rows', l.idx, 'reason']} noStyle><Input placeholder={diffOf(l) ? 'Hao hụt, đổ vỡ, ghi sai…' : ''} /></Form.Item>
                  : l.reason ?? ''),
              },
            ]} />
        </Form>}
      </Drawer>

      <Modal open={creating} title="Lập phiếu kiểm kê" onCancel={() => setCreating(false)} destroyOnHidden
        footer={<Button type="primary" loading={create.isPending} onClick={() => createForm.submit()}>Lập phiếu</Button>}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="SL theo sổ của từng lô được chốt lúc lập phiếu. Nên kiểm lúc vắng khách (đầu / cuối ca); hàng bán trong lúc đếm vẫn được tính đúng." />
        <Form form={createForm} layout="vertical" onFinish={(v) => create.mutate(v, { onSuccess: (s) => { setCreating(false); setViewId(s.id) } })}>
          <Form.Item name="materialIds" label="Nguyên liệu cần kiểm" extra="Để trống: kiểm toàn bộ kho">
            <Select mode="multiple" allowClear showSearch optionFilterProp="label"
              options={materials.filter((m) => m.status === 'ACTIVE' && m.stockQuantity > 0).map((m) => ({ value: m.id, label: `${m.name} — tồn ${num(m.stockQuantity)} ${m.unit}` }))} />
          </Form.Item>
          <Form.Item name="members" label="Người cùng kiểm"><Input /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input placeholder="Kiểm kê cuối tháng, kiểm nhóm sữa…" /></Form.Item>
        </Form>
      </Modal>

      <Modal open={balancing} title={`Cân bằng kho · ${view?.code}`} onCancel={() => setBalancing(false)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { resolution?: string }) => balance.mutate({ id: view!.id, resolution: v.resolution }, { onSuccess: () => setBalancing(false) })}>
          <p>Thừa <b>{money(view?.surplusValue)}</b> · thiếu <b className="a-limit">{money(view?.shortageValue)}</b>. Tồn kho các lô sẽ được điều chỉnh theo chênh lệch.</p>
          <Form.Item name="resolution" label="Ý kiến giải quyết số chênh lệch">
            <Input.TextArea rows={2} placeholder="Hao hụt định mức tính vào chi phí; thiếu do làm đổ: nhắc nhở nhân viên…" />
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={balance.isPending}>Cân bằng kho</Button>
        </Form>
      </Modal>
    </>
  )
}
