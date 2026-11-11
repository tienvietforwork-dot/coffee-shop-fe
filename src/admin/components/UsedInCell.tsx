import { Tag, Tooltip } from 'antd'
import type { Material } from '@/api/types'
import { num } from '@/lib/format'

/** "Dùng trong": coffees whose active recipe takes this material, with the quantity per cup. */
export function UsedInCell({ material }: { material: Material }) {
  const uses = [...(material.usedIn ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  if (!uses.length) return <span className="a-muted small">Chưa dùng</span>
  return (
    <div className="a-used-in">
      {uses.map((u) => (
        <Tooltip key={u.id} title={`${num(u.quantity)} ${material.unit} mỗi ly`}>
          <Tag>{u.name} · {num(u.quantity)} {material.unit}</Tag>
        </Tooltip>
      ))}
    </div>
  )
}
