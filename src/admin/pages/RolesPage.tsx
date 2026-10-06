import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Checkbox, Space, Table, Tag } from 'antd'
import { SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { authApi } from '@/api/auth'
import type { PermissionInfo } from '@/api/types'
import { P, ROLE_LABEL } from '@/lib/perm'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

const MODULE: Record<string, string> = {
  core: 'Bán hàng & vận hành', crm: 'Khách hàng (CRM)', promotions: 'Khuyến mãi', stats: 'Thống kê', system: 'Hệ thống', customer: 'Khách hàng (trang của khách)',
}

/**
 * Phân quyền: 3 role cố định (Quản lý, Nhân viên, Khách hàng) × danh mục quyền (mỗi màn 1 quyền).
 * Giống màn Role–Permission của MES/SMT.
 */
export function RolesPage() {
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: authApi.roles })
  const { data: perms = [] } = useQuery({ queryKey: ['permissions'], queryFn: authApi.permissions })
  const [draft, setDraft] = useState<Record<number, Set<string>>>({})
  const save = useAction((v: { id: number; codes: string[] }) => authApi.setRolePermissions(v.id, v.codes), [['roles']], 'Đã lưu phân quyền')

  useEffect(() => {
    setDraft(Object.fromEntries(roles.map((r) => [r.id, new Set(r.permissionCodes)])))
  }, [roles])

  const dirty = (id: number) => {
    const r = roles.find((x) => x.id === id)
    const d = draft[id]
    return !!r && !!d && (r.permissionCodes.length !== d.size || r.permissionCodes.some((c) => !d.has(c)))
  }
  const toggle = (id: number, code: string, on: boolean) =>
    setDraft((s) => { const n = new Set(s[id]); if (on) n.add(code); else n.delete(code); return { ...s, [id]: n } })

  const rows = useMemo(() => {
    const out: (PermissionInfo & { groupHead?: string })[] = []
    let last = ''
    for (const p of perms) {
      out.push(p.module !== last ? { ...p, groupHead: MODULE[p.module] ?? p.module } : p)
      last = p.module
    }
    return out
  }, [perms])

  return (
    <>
      <PageHeader title="Phân quyền" subtitle="Hệ thống có 3 role cố định; mỗi màn hình là một quyền. Tích để cấp quyền cho role." />
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Quyền có hiệu lực ngay với tài khoản đang đăng nhập trên app-core. Các app CRM / Khuyến mãi / Thống kê đọc quyền từ token, nên cần đăng nhập lại." />
      <Card>
        <Table
          rowKey="code"
          size="small"
          pagination={false}
          dataSource={rows}
          scroll={{ x: 760 }}
          columns={[
            {
              title: 'Quyền', render: (_, p) => (
                <>
                  {p.groupHead && <div className="a-perm-group">{p.groupHead}</div>}
                  <b>{p.name}</b> {p.path ? <Tag bordered={false}>{p.path}</Tag> : <Tag color="purple" bordered={false}>thao tác</Tag>}
                  <div className="a-muted small"><code>{p.code}</code>{p.description && ` · ${p.description}`}</div>
                </>
              ),
            },
            ...roles.map((r) => ({
              title: (
                <Space direction="vertical" size={2} align="center">
                  <Tag color={ROLE_LABEL[r.code]?.color}>{r.name}</Tag>
                  <span className="a-muted small">{r.userCount} tài khoản</span>
                  <Space size={4}>
                    <Button size="small" type="primary" icon={<SaveOutlined />} disabled={!dirty(r.id)} loading={save.isPending}
                      onClick={() => save.mutate({ id: r.id, codes: [...draft[r.id]] })}>Lưu</Button>
                    <Button size="small" icon={<UndoOutlined />} disabled={!dirty(r.id)}
                      onClick={() => setDraft((s) => ({ ...s, [r.id]: new Set(r.permissionCodes) }))} />
                  </Space>
                </Space>
              ),
              width: 150,
              align: 'center' as const,
              render: (_: unknown, p: PermissionInfo) => {
                const locked = r.code === 'ADMIN' && (p.code === P.ROLES || p.code === P.USERS)
                return (
                  <Checkbox
                    checked={draft[r.id]?.has(p.code) ?? false}
                    disabled={locked}
                    title={locked ? 'Quản lý luôn giữ quyền Tài khoản và Phân quyền' : undefined}
                    onChange={(e) => toggle(r.id, p.code, e.target.checked)}
                  />
                )
              },
            })),
          ]}
        />
      </Card>
    </>
  )
}
