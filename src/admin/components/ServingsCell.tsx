import { Popover, Table, Tag } from 'antd'
import type { Coffee } from '@/api/types'
import { num } from '@/lib/format'

const LOW = 10

/** "Còn pha được" cell; clicking the count shows how it was computed. */
export function ServingsCell({ coffee }: { coffee: Coffee }) {
  if (!coffee.hasRecipe) return <Tag color="red">Chưa có công thức</Tag>
  const lines = coffee.stock ?? []
  if (coffee.servings == null) return <span className="a-muted">—</span>
  const n = coffee.servings
  const limit = lines.find((l) => l.cups === n)

  const detail = (
    <div className="a-servings">
      <div className="a-servings-formula">
        Số ly = min( ⌊ Tồn kho ÷ Định lượng/ly ⌋ ) = <b>{n}</b>
      </div>
      <Table size="small" pagination={false} rowKey="materialId" dataSource={lines}
        rowClassName={(l) => (l === limit ? 'is-limit' : '')}
        columns={[
          { title: 'Nguyên liệu', dataIndex: 'materialName' },
          { title: 'Tồn kho', align: 'right', render: (_, l) => `${num(l.stock)} ${l.unit}` },
          { title: 'Định lượng/ly', align: 'right', render: (_, l) => `${num(l.perCup)} ${l.unit}` },
          { title: 'Số ly', dataIndex: 'cups', align: 'right', render: (v) => <b>{v}</b> },
        ]} />
    </div>
  )

  return (
    <Popover trigger="click" title={`Còn pha được · ${coffee.name}`} content={detail} placement="left">
      <span className="a-servings-cell">
        <Tag color={n === 0 ? 'red' : n < LOW ? 'orange' : 'green'}>{n} ly</Tag>
        {limit && n < LOW && <div className="a-muted small">{limit.materialName}</div>}
      </span>
    </Popover>
  )
}
