import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Empty, InputNumber, Modal, Popconfirm, Space, Table, Tag } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { Batch, Material } from '@/api/types'
import { dateTime, duration, num } from '@/lib/format'
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
export function PreparedMaterialsTab({ materials, canEdit, canProduce, onEdit, onBatches }: {
  materials: Material[]; canEdit: boolean; canProduce: boolean
  onEdit: (m: Material) => void; onBatches: (m: Material) => void
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
        scroll={{ x: 1000 }}
        expandable={{ expandedRowRender: (m) => <Expanded material={m} canProduce={canProduce} />, rowExpandable: () => true }}
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
          { title: 'TG chế biến', width: 100, align: 'right', render: (_, m) => duration(m.prepMinutes) },
          { title: 'Hạn dùng', width: 90, align: 'right', render: (_, m) => duration(m.shelfLifeMinutes) },
          {
            title: 'Định lượng chuẩn', width: 210, render: (_, m) => <>
              <b>{num(m.yieldQuantity)} {m.unit}</b>
              {m.components?.map((c) => <div key={c.componentId} className="a-muted small">{c.name}: {num(c.quantity)} {c.unit}</div>)}
            </>,
          },
          { title: 'Dùng cho', render: (_, m) => <UsedInCell material={m} /> },
          {
            title: '', width: 150, render: (_, m) => (
              <Space direction="vertical" size={4}>
                {canProduce && (
                  <Button type="primary" size="small" block disabled={m.status === 'INACTIVE'} onClick={() => setProducing(m)}>Chế biến</Button>
                )}
                <Space>
                  <Button size="small" onClick={() => onBatches(m)}>Các lô</Button>
                  {canEdit && <Button size="small" onClick={() => onEdit(m)}>Sửa</Button>}
                </Space>
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
 * the deduction of every input is worked out from it, and confirming starts the lot.
 */
function ProduceModal({ material: m, materials, onClose }: { material: Material; materials: Material[]; onClose: () => void }) {
  const std = m.yieldQuantity ?? 0
  const { max, limit } = maxOf(m, materials)
  const [want, setWant] = useState(std)
  const amount = Math.min(want, max)
  const clamped = want > max
  const factor = std ? Math.floor((amount / std) * 10000) / 10000 : 0
  const tooSmall = factor < 0.1
  const produce = useAction(coreApi.produce, KEYS, 'Đã bắt đầu chế biến')
  const stockOf = (id: number) => materials.find((x) => x.id === id)?.stockQuantity ?? 0

  return (
    <Modal open title={`Chế biến · ${m.name}`} onCancel={onClose} width={620} okText="Bắt đầu chế biến"
      okButtonProps={{ disabled: tooSmall, loading: produce.isPending }}
      onOk={() => produce.mutate({ materialId: m.id, batches: factor }, { onSuccess: onClose })}>
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
      <div className="a-muted small" style={{ marginTop: 8 }}>
        {m.prepMinutes ? `Dự kiến xong ${dayjs().add(m.prepMinutes, 'minute').format('HH:mm DD/MM')}` : ''}
        {m.shelfLifeMinutes ? ` · hạn dùng ${duration(m.shelfLifeMinutes)} sau khi xong` : ''}
      </div>
      {m.instructions && (
        <>
          <div className="a-produce-guide-title">Hướng dẫn (định lượng chuẩn {num(std)} {m.unit})</div>
          <div className="a-produce-guide">{m.instructions}</div>
        </>
      )}
    </Modal>
  )
}

/** Expanded row: instructions + lots being prepared (finish / discard). */
function Expanded({ material, canProduce }: { material: Material; canProduce: boolean }) {
  const { data: batches = [] } = useQuery({ queryKey: ['batches', material.id], queryFn: () => coreApi.batches(material.id) })
  const finish = useAction((v: { id: number; actualQuantity: number; expiresAt?: string }) => coreApi.finishBatch(v.id, { actualQuantity: v.actualQuantity, expiresAt: v.expiresAt }), KEYS, 'Đã hoàn tất lô')
  const discard = useAction((id: number) => coreApi.discardBatch(id), KEYS, 'Đã hủy lô')
  const [finishing, setFinishing] = useState<Batch | null>(null)
  const [actual, setActual] = useState<number | null>(null)
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null)
  const open = (b: Batch) => {
    setFinishing(b)
    setActual(b.importQuantity)
    // standard shelf life from now; can be changed for this lot
    setExpiresAt(material.shelfLifeMinutes ? dayjs().add(material.shelfLifeMinutes, 'minute') : null)
  }
  const preparing = batches.filter((b) => b.status === 'PREPARING')

  return (
    <div className="a-prepared-expanded">
      <div>
        <div className="a-produce-guide-title">Hướng dẫn chế biến (định lượng chuẩn {num(material.yieldQuantity)} {material.unit})</div>
        <div className="a-produce-guide">{material.instructions || <span className="a-muted">Chưa có hướng dẫn</span>}</div>
      </div>
      <div>
        <div className="a-produce-guide-title">Đang chế biến</div>
        <Table<Batch> rowKey="id" size="small" pagination={false} dataSource={preparing} locale={{ emptyText: 'Không có lô nào đang chế biến' }}
          columns={[
            { title: 'Lô', dataIndex: 'id', render: (v) => `#${v}` },
            { title: 'Bắt đầu', render: (_, b) => dateTime(b.createdAt) },
            { title: 'Dự kiến xong', render: (_, b) => <>{dateTime(b.readyAt)} {dayjs(b.readyAt).isBefore(dayjs()) && <Tag color="green">Đủ giờ</Tag>}</> },
            { title: 'Dự kiến', render: (_, b) => `${num(b.importQuantity)} ${b.unit}` },
            ...(canProduce ? [{
              title: '', render: (_: unknown, b: Batch) => (
                <Space>
                  <Button size="small" type="primary" onClick={() => open(b)}>Hoàn tất</Button>
                  <Popconfirm title="Hủy lô này? Nguyên liệu đã dùng không được hoàn lại." onConfirm={() => discard.mutate(b.id)}>
                    <Button size="small" danger>Hủy</Button>
                  </Popconfirm>
                </Space>
              ),
            }] : []),
          ]} />
      </div>
      <Modal open={!!finishing} title={`Hoàn tất lô #${finishing?.id ?? ''} · ${material.name}`} onCancel={() => setFinishing(null)}
        okText="Nhập kho" okButtonProps={{ disabled: !actual, loading: finish.isPending }}
        onOk={() => finish.mutate({ id: finishing!.id, actualQuantity: actual!, expiresAt: expiresAt?.format('YYYY-MM-DDTHH:mm:ss') }, { onSuccess: () => setFinishing(null) })}>
        <div style={{ marginBottom: 6 }}>Sản lượng thực tế ({material.unit}) · dự kiến {num(finishing?.importQuantity)}</div>
        <InputNumber min={0.01} value={actual} onChange={setActual} style={{ width: '100%' }} autoFocus />
        <div style={{ margin: '12px 0 6px' }}>Hạn dùng lô này {material.shelfLifeMinutes ? `(chuẩn: ${duration(material.shelfLifeMinutes)} sau khi xong)` : ''}</div>
        <DatePicker showTime={{ format: 'HH:mm' }} format="HH:mm DD/MM/YYYY" value={expiresAt} onChange={setExpiresAt} style={{ width: '100%' }}
          disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
        {finishing?.inputs?.length ? (
          <div className="a-muted small" style={{ marginTop: 8 }}>Làm từ: {finishing.inputs.map((i) => `${num(i.quantity)} ${i.unit} ${i.materialName} (lô #${i.batchId})`).join(' · ')}</div>
        ) : null}
      </Modal>
    </div>
  )
}
