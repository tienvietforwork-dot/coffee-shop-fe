import { Tag, Tooltip } from 'antd'
import type { Material } from '@/api/types'
import { num } from '@/lib/format'

/** "Dùng cho": coffees (per cup) and prepared materials (per standard batch) that take this material. */
export function UsedInCell({ material }: { material: Material }) {
  const uses = material.usedIn ?? []
  if (!uses.length) return <span className="a-muted small">Chưa dùng</span>
  const prepared = uses.filter((u) => u.kind === 'PREPARED')
  const coffees = uses.filter((u) => u.kind === 'COFFEE').sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="a-used-in">
      {prepared.map((u) => (
        <Tooltip key={`p${u.id}`} title={`${num(u.quantity)} ${material.unit} cho 1 lần chế biến chuẩn`}>
          <Tag color="gold">{u.name} · {num(u.quantity)} {material.unit}</Tag>
        </Tooltip>
      ))}
      {coffees.map((u) => (
        <Tooltip key={`c${u.id}`} title={`${num(u.quantity)} ${material.unit} mỗi ly`}>
          <Tag>{u.name} · {num(u.quantity)} {material.unit}</Tag>
        </Tooltip>
      ))}
    </div>
  )
}
