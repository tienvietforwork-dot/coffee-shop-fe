import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Input, InputNumber, Modal, Segmented, Space, Table, Tag } from 'antd'
import { Line } from '@ant-design/charts'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { CoffeeCost } from '@/api/types'
import { dateTime, money, num } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { MoneyInput } from '../components/MoneyInput'
import { useAction } from '../components/useCrud'

/** food cost % above this is flagged (cà phê pha chế thường 20–35%) */
const HIGH = 35

/**
 * Giá vốn món theo định lượng: Σ (định lượng công thức × giá vốn nguyên liệu). Giá vốn nguyên liệu = bình quân các lô
 * còn trong kho (hết hàng: giá nhập gần nhất; nguyên liệu chế biến: định mức thô ÷ định lượng ra). Job tính lại mỗi giờ
 * và lưu lịch sử mỗi khi giá vốn / giá bán đổi. Đổi giá bán theo food cost mục tiêu ngay tại đây.
 */
export function CoffeeCostsPage() {
  const { can } = usePerm()
  const { data = [], isLoading } = useQuery({ queryKey: ['coffee-costs'], queryFn: coreApi.coffeeCosts })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'high' | 'missing'>('all')
  const q = search.trim().toLowerCase()
  const rows = data.filter((c) => (!q || c.coffeeName.toLowerCase().includes(q))
    && (filter === 'all' || (filter === 'high' ? (c.foodCostPercent ?? 0) > HIGH : !c.complete)))
  const [view, setView] = useState<CoffeeCost | null>(null)
  const { data: history = [] } = useQuery({ queryKey: ['coffee-cost-history', view?.coffeeId], enabled: !!view,
    queryFn: () => coreApi.coffeeCostHistory(view!.coffeeId) })
  const recalc = useAction(coreApi.recalculateCosts, [['coffee-costs'], ['coffee-cost-history']], 'Đã tính lại giá vốn')
  const [pricing, setPricing] = useState<CoffeeCost | null>(null)
  const [target, setTarget] = useState(30)
  const [price, setPrice] = useState<number>()
  const setCoffeePrice = useAction((v: { id: number; price: number }) => coreApi.setCoffeePrice(v.id, v.price),
    [['coffee-costs'], ['coffee-cost-history'], ['coffees'], ['menu']], 'Đã đổi giá bán')
  const suggested = (c: CoffeeCost, pct: number) => (c.unitCost ? Math.ceil(c.unitCost / (pct / 100) / 1000) * 1000 : undefined)

  return (
    <>
      <PageHeader title="Giá vốn món" subtitle="Theo định lượng công thức · food cost % = giá vốn ÷ giá bán · tính lại tự động mỗi giờ"
        extra={<Button icon={<ReloadOutlined />} loading={recalc.isPending} onClick={() => recalc.mutate(undefined)}>Tính lại ngay</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm món" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
        <Segmented value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[
          { value: 'all', label: `Tất cả (${data.length})` },
          { value: 'high', label: `Food cost > ${HIGH}% (${data.filter((c) => (c.foodCostPercent ?? 0) > HIGH).length})` },
          { value: 'missing', label: `Thiếu giá (${data.filter((c) => !c.complete).length})` },
        ]} />
      </Space>
      <Table<CoffeeCost> rowKey="coffeeId" loading={isLoading} dataSource={rows} scroll={{ x: 900 }}
        onRow={(c) => ({ onClick: () => setView(c), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Món', render: (_, c) => <><b>{c.coffeeName}</b><div className="a-muted small">{c.categoryName}</div></> },
          { title: 'Giá bán', dataIndex: 'price', render: money, align: 'right', sorter: (a, b) => a.price - b.price },
          {
            title: 'Giá vốn / ly', align: 'right', sorter: (a, b) => (a.unitCost ?? 0) - (b.unitCost ?? 0), render: (_, c) => (
              !c.recipeId ? <span className="a-muted">Chưa có công thức</span> : <>
                {money(c.unitCost)}{!c.complete && <Tag color="orange" style={{ marginLeft: 6 }}>thiếu giá</Tag>}
                {c.previousCost != null && <div className={`small ${c.unitCost! > c.previousCost ? 'a-limit' : 'a-muted'}`}>
                  trước {money(c.previousCost)} ({c.unitCost! > c.previousCost ? '+' : ''}{num(c.unitCost! - c.previousCost)}đ)</div>}
              </>),
          },
          { title: 'Lãi gộp / ly', dataIndex: 'grossMargin', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
          {
            title: 'Food cost', dataIndex: 'foodCostPercent', align: 'right', sorter: (a, b) => (a.foodCostPercent ?? 0) - (b.foodCostPercent ?? 0),
            render: (v?: number) => (v == null ? '—' : <Tag color={v > HIGH ? 'red' : v > 28 ? 'gold' : 'green'}>{num(v)}%</Tag>),
          },
          {
            title: '', render: (_, c) => c.unitCost && can(P.MENU_EDIT) ? (
              <Button size="small" onClick={(e) => { e.stopPropagation(); setPricing(c); setPrice(suggested(c, target)) }}>Đổi giá bán</Button>
            ) : null,
          },
        ]} />

      <Drawer open={!!view} width={720} onClose={() => setView(null)} title={view && `Giá vốn · ${view.coffeeName}`}>
        {view && <>
          {!view.complete && view.recipeId && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Có nguyên liệu chưa có giá nhập — giá vốn đang thiếu phần đó" />}
          <Table rowKey="materialId" size="small" pagination={false} dataSource={view.lines}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3} align="right"><b>Giá vốn / ly</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{money(view.unitCost)}</b></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            columns={[
              { title: 'Nguyên liệu', render: (_, l) => <>{l.materialName}<div className="a-muted small">{l.costSource}</div></> },
              { title: 'Định lượng', render: (_, l) => `${num(l.quantity)} ${l.unit}` },
              { title: 'Giá vốn / đv', render: (_, l) => (l.unitCost == null ? '—' : `${num(Math.round(l.unitCost * 100) / 100)}đ/${l.unit}`), align: 'right' },
              { title: 'Thành tiền', dataIndex: 'cost', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
            ]} />
          <h3 style={{ marginTop: 20 }}>Lịch sử giá vốn & giá bán</h3>
          {history.length > 1
            ? <Line height={220} data={history.flatMap((h) => [{ at: dateTime(h.at), type: 'Giá vốn', value: h.unitCost }, { at: dateTime(h.at), type: 'Giá bán', value: h.price }])}
              xField="at" yField="value" colorField="type" point={{ size: 3 }} />
            : <div className="a-muted">Chưa đủ dữ liệu — lịch sử ghi lại mỗi khi giá vốn hoặc giá bán thay đổi.</div>}
        </>}
      </Drawer>

      <Modal open={!!pricing} title={pricing && `Đổi giá bán · ${pricing.coffeeName}`} onCancel={() => setPricing(null)} destroyOnHidden
        footer={<Button type="primary" disabled={!price} loading={setCoffeePrice.isPending}
          onClick={() => setCoffeePrice.mutate({ id: pricing!.coffeeId, price: price! }, { onSuccess: () => setPricing(null) })}>Lưu giá bán</Button>}>
        {pricing && <>
          <p>Giá vốn {money(pricing.unitCost)} · giá bán hiện tại {money(pricing.price)} ({num(pricing.foodCostPercent)}%)</p>
          <Space style={{ marginBottom: 12 }}>
            Food cost mục tiêu
            <InputNumber min={10} max={80} value={target} addonAfter="%" onChange={(v) => { setTarget(v ?? 30); setPrice(suggested(pricing, v ?? 30)) }} />
          </Space>
          <MoneyInput value={price} onChange={(v) => setPrice(v ?? undefined)} />
          {price && pricing.unitCost && <p className="a-muted" style={{ marginTop: 8 }}>
            Food cost mới {num(Math.round((pricing.unitCost / price) * 1000) / 10)}% · lãi gộp {money(price - pricing.unitCost)} / ly</p>}
        </>}
      </Modal>
    </>
  )
}
