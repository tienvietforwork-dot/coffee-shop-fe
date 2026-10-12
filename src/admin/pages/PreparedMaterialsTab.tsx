import { useState } from 'react'
import { Button, DatePicker, Empty, InputNumber, Modal, Space, Table, Tag } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Material } from '@/api/types'
import { duration, num } from '@/lib/format'
import { useAction } from '../components/useCrud'
import { UsedInCell } from '../components/UsedInCell'

const KEYS = [['materials'], ['batches'], ['alerts'], ['transactions'], ['coffees'], ['menu']]

/** Largest amount of `m` the raw stock allows, and the input that runs out first. */
function maxOf(m: Material, materials: Material[]) {
  let limit: { name: string; times: number } | undefined
  for (const c of m.components ?? []) {
    const times = (materials.find((x) => x.id === c.componentId)?.stockQuantity ?? 0) / c.quantity
    if (!limit || times < limit.times) limit = { name: c.name, times }
  }
  return { max: limit ? Math.floor(limit.times * (m.yieldQuantity ?? 0) * 100) / 100 : 0, limit }
}

/** Bán thành phẩm: one row per prepared material; "Chế biến" opens the popup that works out the deduction. */
export function PreparedMaterialsTab({ materials, canProduce, onDetail }: {
  materials: Material[]; canProduce: boolean; onDetail: (m: Material) => void
}) {
  const rows = materials.filter((m) => m.kind === 'PREPARED')
  const [producing, setProducing] = useState<Material | null>(null)

  if (!rows.length) return <Empty description="Chưa có bán thành phẩm — bấm Thêm để khai báo (VD: cốt cold brew, nước đường)" />

  return (
    <>
      <Table<Material>
        rowKey="id"
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
        columns={[
          {
            title: 'Bán thành phẩm', width: 170, render: (_, m) => <>
              <b>{m.name}</b>
              {m.status === 'INACTIVE' && <div><Tag>Ngưng dùng</Tag></div>}
            </>,
          },
          {
            title: 'Tồn kho', width: 110, align: 'right', sorter: (a, b) => a.stockQuantity - b.stockQuantity,
            render: (_, m) => <>
              <b>{num(m.stockQuantity)} {m.unit}</b>
              {m.lowStock && <div><Tag color="red" style={{ margin: 0 }}>Sắp hết</Tag></div>}
            </>,
          },
          { title: 'Hạn dùng', width: 90, align: 'right', render: (_, m) => duration(m.shelfLifeMinutes) },
          {
            title: 'Định lượng chuẩn', width: 210, render: (_, m) => <>
              <b>{num(m.yieldQuantity)} {m.unit}</b>
              {m.components?.map((c) => <div key={c.componentId} className="a-muted small">{c.name}: {num(c.quantity)} {c.unit}</div>)}
            </>,
          },
          { title: 'Dùng cho', render: (_, m) => <UsedInCell material={m} /> },
          {
            title: '', width: 170, render: (_, m) => (
              <Space>
                {canProduce && (
                  <Button type="primary" size="small" disabled={m.status === 'INACTIVE'} onClick={() => setProducing(m)}>Chế biến</Button>
                )}
                <Button size="small" onClick={() => onDetail(m)}>Xem chi tiết</Button>
              </Space>
            ),
          },
        ]}
      />
      {producing && <ProduceModal material={producing} materials={materials} onClose={() => setProducing(null)} />}
    </>
  )
}

/**
 * Chế biến popup: amount starts at the standard quantity (cut down to what the stock allows),
 * the deduction of every input is worked out from it, and confirming puts the lot in stock at once.
 */
function ProduceModal({ material: m, materials, onClose }: { material: Material; materials: Material[]; onClose: () => void }) {
  const std = m.yieldQuantity ?? 0
  const { max, limit } = maxOf(m, materials)
  const [want, setWant] = useState(std)
  const amount = Math.min(want, max)
  const clamped = want > max
  const factor = std ? Math.floor((amount / std) * 10000) / 10000 : 0
  const tooSmall = factor < 0.1
  // standard shelf life from now; can be changed for this lot
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(m.shelfLifeMinutes ? dayjs().add(m.shelfLifeMinutes, 'minute') : null)
  const produce = useAction(coreApi.produce, KEYS, 'Đã chế biến, lô đã vào kho')
  const stockOf = (id: number) => materials.find((x) => x.id === id)?.stockQuantity ?? 0

  return (
    <Modal open title={`Chế biến · ${m.name}`} onCancel={onClose} width={620} okText="Chế biến & nhập kho"
      okButtonProps={{ disabled: tooSmall, loading: produce.isPending }}
      onOk={() => produce.mutate({ materialId: m.id, batches: factor, expiresAt: expiresAt?.format('YYYY-MM-DDTHH:mm:ss') }, { onSuccess: onClose })}>
      <div className="a-produce-amount">
        <div>
          <div className="a-muted small">Lượng chế biến</div>
          <Space.Compact>
            <InputNumber min={0} value={amount} onChange={(v) => setWant(Number(v ?? 0))} style={{ width: 160 }} autoFocus />
            <Button disabled>{m.unit}</Button>
          </Space.Compact>
        </div>
        <Space wrap>
          {[0.5, 1, 2].map((k) => <Button key={k} size="small" onClick={() => setWant(std * k)}>×{num(k)} chuẩn</Button>)}
        </Space>
        <div className="a-muted small">Định lượng chuẩn {num(std)} {m.unit} · tối đa theo kho {num(max)} {m.unit}</div>
      </div>
      {clamped && limit && (
        <div className="a-warn-text" style={{ marginBottom: 8 }}><WarningOutlined /> Kho chỉ đủ {num(max)} {m.unit} — giới hạn bởi {limit.name}, đã tự giảm</div>
      )}
      {tooSmall && (
        <div className="a-warn-text" style={{ marginBottom: 8 }}><WarningOutlined /> Tối thiểu 10% định lượng chuẩn ({num(std * 0.1)} {m.unit})</div>
      )}
      <Table size="small" pagination={false} rowKey="componentId" dataSource={m.components ?? []}
        columns={[
          { title: 'Nguyên liệu', dataIndex: 'name' },
          { title: 'Chuẩn', align: 'right', render: (_, c) => `${num(c.quantity)} ${c.unit}` },
          { title: `Khấu trừ (×${num(factor)})`, align: 'right', render: (_, c) => <b>{num(Math.round(c.quantity * factor * 100) / 100)} {c.unit}</b> },
          {
            title: 'Tồn sau', align: 'right', render: (_, c) => (
              <span className={c.name === limit?.name ? 'a-limit' : ''}>
                {num(Math.round((stockOf(c.componentId) - c.quantity * factor) * 100) / 100)} {c.unit}
              </span>
            ),
          },
        ]} />
      <div style={{ margin: '12px 0 6px' }}>
        Dự kiến hết hạn {m.shelfLifeMinutes ? <span className="a-muted small">(chuẩn: {duration(m.shelfLifeMinutes)} sau khi chế biến)</span> : null}
      </div>
      <DatePicker showTime={{ format: 'HH:mm' }} format="HH:mm DD/MM/YYYY" value={expiresAt} onChange={setExpiresAt} style={{ width: '100%' }}
        disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
    </Modal>
  )
}
