import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Button, DatePicker, InputNumber, Modal, Select, Space, Table, Tag } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Batch, Material } from '@/api/types'
import { date, duration, num, packaging } from '@/lib/format'
import { useAction } from '../components/useCrud'

const KEYS = [['materials'], ['batches'], ['alerts'], ['transactions'], ['coffees'], ['menu']]

/** lots still in stock, in the order the backend takes them (FEFO): earliest expiry, no expiry last, then oldest */
const fefo = (lots: Batch[]) => lots.filter((b) => b.status === 'AVAILABLE' && b.remainingQuantity > 0)
  .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || a.id - b.id)

/** Largest amount of `m` the raw stock allows, and the input that runs out first. */
function maxOf(m: Material, materials: Material[]) {
  let limit: { name: string; times: number } | undefined
  for (const c of m.components ?? []) {
    const times = (materials.find((x) => x.id === c.componentId)?.stockQuantity ?? 0) / c.quantity
    if (!limit || times < limit.times) limit = { name: c.name, times }
  }
  return { max: limit ? Math.floor(limit.times * (m.yieldQuantity ?? 0) * 100) / 100 : 0, limit }
}

/**
 * Chế biến popup: amount starts at the standard quantity (cut down to what the stock allows),
 * the deduction of every input is worked out from it, and confirming puts the lot in stock at once.
 */
export function ProduceModal({ material: m, materials, onClose }: { material: Material; materials: Material[]; onClose: () => void }) {
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
  // which lot each input is taken from first: the one closest to expiry unless staff picks another
  const comps = m.components ?? []
  const lotQueries = useQueries({ queries: comps.map((c) => ({ queryKey: ['batches', c.componentId], queryFn: () => coreApi.batches(c.componentId) })) })
  const lotsOf = (componentId: number) => fefo(lotQueries[comps.findIndex((c) => c.componentId === componentId)]?.data ?? [])
  const [picked, setPicked] = useState<Record<number, number>>({})
  const firstLot = (componentId: number) => {
    const lots = lotsOf(componentId)
    return lots.find((b) => b.id === picked[componentId]) ?? lots[0]
  }
  // made from one packaged input (e.g. opening a carton of milk): one package of the picked lot
  const single = comps.length === 1 ? comps[0] : undefined
  const singleLot = single && firstLot(single.componentId)
  const openOne = single && singleLot?.packageSize && singleLot.packageName
    ? { name: singleLot.packageName, amount: Math.round(singleLot.packageSize * (std / single.quantity) * 100) / 100 }
    : undefined
  const lots = Object.fromEntries(comps.map((c) => [c.componentId, firstLot(c.componentId)?.id]).filter(([, id]) => id != null))

  return (
    <Modal open title={`Chế biến · ${m.name}`} onCancel={onClose} width={820} okText="Chế biến & nhập kho"
      okButtonProps={{ disabled: tooSmall, loading: produce.isPending }}
      onOk={() => produce.mutate({ materialId: m.id, batches: factor, expiresAt: expiresAt?.format('YYYY-MM-DDTHH:mm:ss'), lots }, { onSuccess: onClose })}>
      <div className="a-produce-amount">
        <div>
          <div className="a-muted small">Lượng chế biến</div>
          <Space.Compact>
            <InputNumber min={0} value={amount} onChange={(v) => setWant(Number(v ?? 0))} style={{ width: 160 }} autoFocus />
            <Button disabled>{m.unit}</Button>
          </Space.Compact>
        </div>
        <Space wrap>
          {openOne && (
            <Button size="small" type="primary" ghost onClick={() => setWant(openOne.amount)}>Mở 1 {openOne.name.toLowerCase()} ({num(openOne.amount)} {m.unit})</Button>
          )}
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
            title: 'Lấy từ lô', width: 300, render: (_, c) => {
              const all = lotsOf(c.componentId)
              const lot = firstLot(c.componentId)
              const need = Math.round(c.quantity * factor * 100) / 100
              const next = lot && all.find((b) => b.id !== lot.id)
              return <>
                <Select size="small" style={{ width: '100%' }} value={lot?.id} placeholder="Không có lô"
                  onChange={(id) => setPicked((p) => ({ ...p, [c.componentId]: id }))}
                  options={all.map((b) => ({
                    value: b.id,
                    label: <>#{b.id}{packaging(b) && ` · ${b.packageName}`} · HSD {date(b.expiryDate)} · còn {num(b.remainingQuantity)} {b.unit}
                      {all.some((o) => o.id !== b.id && o.expiryDate === b.expiryDate) && <Tag color="gold" bordered={false} style={{ marginLeft: 6 }}>cùng hạn</Tag>}</>,
                  }))} />
                {lot && lot.remainingQuantity < need && (
                  <div className="a-muted small">Lô thiếu {num(Math.round((need - lot.remainingQuantity) * 100) / 100)} {c.unit}{next ? ` — lấy tiếp từ lô #${next.id}` : ''}</div>
                )}
              </>
            },
          },
          {
            title: 'Tồn sau', align: 'right', render: (_, c) => (
              <span className={c.name === limit?.name ? 'a-limit' : ''}>
                {num(Math.round((stockOf(c.componentId) - c.quantity * factor) * 100) / 100)} {c.unit}
              </span>
            ),
          },
        ]} />
      <div style={{ margin: '12px 0 6px' }}>
        Dự kiến hết hạn {m.shelfLifeMinutes ? <span className="a-muted small">(chuẩn: {duration(m.shelfLifeMinutes)} sau khi chế biến / mở)</span> : null}
      </div>
      <DatePicker showTime={{ format: 'HH:mm' }} format="HH:mm DD/MM/YYYY" value={expiresAt} onChange={setExpiresAt} style={{ width: '100%' }}
        disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
    </Modal>
  )
}
