import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Empty, Form, Input, Tabs, Tag } from 'antd'
import { accountApi } from '@/api/auth'
import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePerm, P } from '@/lib/perm'
import { ORDER_STATUS, date, dateTime, money } from '@/lib/format'
import { ChangePasswordModal } from '@/admin/components/ChangePasswordModal'

const VOUCHER: Record<string, { t: string; c: string }> = {
  ISSUED: { t: 'Có thể dùng', c: 'green' }, USED: { t: 'Đã dùng', c: 'default' }, EXPIRED: { t: 'Hết hạn', c: 'default' }, REVOKED: { t: 'Đã thu hồi', c: 'red' },
}

/** "Tài khoản của tôi" – khách hàng đã đăng nhập. */
export function AccountPage() {
  const { isAuthenticated, logout } = useAuthStore()
  const { can, hasAdminAccess } = usePerm()
  const qc = useQueryClient()
  const { message } = App.useApp()
  const [pwd, setPwd] = useState(false)
  const enabled = isAuthenticated && can(P.ACCOUNT)
  const profile = useQuery({ queryKey: ['account'], queryFn: accountApi.profile, enabled })
  const orders = useQuery({ queryKey: ['account-orders'], queryFn: accountApi.orders, enabled })
  const vouchers = useQuery({ queryKey: ['account-vouchers'], queryFn: accountApi.vouchers, enabled })
  const points = useQuery({ queryKey: ['account-points'], queryFn: accountApi.points, enabled })
  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (p) => { qc.setQueryData(['account'], p); message.success('Đã lưu') },
    onError: (e) => message.error(errorMessage(e)),
  })

  if (!isAuthenticated) return <Navigate to="/" replace />
  if (!can(P.ACCOUNT)) {
    return (
      <div className="g-container g-page g-center">
        <h2>Đây là trang dành cho khách hàng</h2>
        {hasAdminAccess && <Link to="/admin" className="g-cta">Vào hệ thống quản trị</Link>}
      </div>
    )
  }
  const p = profile.data
  const usable = (vouchers.data ?? []).filter((v) => v.status === 'ISSUED')

  return (
    <div className="g-container g-page g-narrow">
      <h1 className="g-page-title">Xin chào{p?.fullName ? `, ${p.fullName}` : ''}</h1>
      <div className="g-stats">
        <div className="g-stat"><span>Điểm tích lũy</span><b>{p?.loyaltyPoints ?? '—'}</b></div>
        <div className="g-stat"><span>Đơn đã đặt</span><b>{p?.orderCount ?? '—'}</b></div>
        <div className="g-stat"><span>Voucher có thể dùng</span><b>{usable.length}</b></div>
      </div>
      <div className="g-panel">
        <Tabs items={[
          {
            key: 'orders', label: 'Đơn hàng', children: orders.data?.length ? (
              <ul className="g-order-list">
                {orders.data.map((o) => (
                  <li key={o.id}>
                    <Link to={`/order/${o.orderCode}`} className="g-order-item g-order-row">
                      <div>
                        <strong>{o.orderCode}</strong>
                        <span className="g-muted">{dateTime(o.orderedAt)} · {o.items.map((x) => `${x.quantity}× ${x.coffeeName}`).join(', ')}</span>
                      </div>
                      <div className="g-order-right">
                        <span className={`g-status g-status-${o.status.toLowerCase()}`}>{ORDER_STATUS[o.status].text}</span>
                        <strong>{money(o.totalAmount)}</strong>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty description="Bạn chưa có đơn nào" />,
          },
          {
            key: 'vouchers', label: `Voucher (${usable.length})`, children: vouchers.data?.length ? (
              <div className="g-vouchers">
                {vouchers.data.map((v) => (
                  <div key={v.id} className={`g-voucher-card ${v.status !== 'ISSUED' ? 'is-off' : ''}`}>
                    <div className="g-voucher-value">-{money(v.discountValue)}</div>
                    <div>
                      <code>{v.code}</code> <Tag color={VOUCHER[v.status].c}>{VOUCHER[v.status].t}</Tag>
                      <div className="g-muted small">
                        {v.minOrderValue > 0 ? `Đơn từ ${money(v.minOrderValue)}` : 'Không yêu cầu đơn tối thiểu'}
                        {v.expiresAt && ` · HSD ${date(v.expiresAt)}`}{v.orderCode && ` · dùng cho ${v.orderCode}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty description="Chưa có voucher" />,
          },
          {
            key: 'points', label: 'Điểm tích lũy', children: points.data?.length ? (
              <ul className="g-sum-lines">
                {points.data.map((h) => (
                  <li key={h.id}><span>{h.reason}<small>{dateTime(h.createdAt)}</small></span><b className={h.pointsChange > 0 ? 'g-green' : ''}>{h.pointsChange > 0 ? '+' : ''}{h.pointsChange}</b></li>
                ))}
              </ul>
            ) : <Empty description="Hoàn tất đơn đầu tiên để nhận điểm (1 điểm / 10.000đ)" />,
          },
          {
            key: 'profile', label: 'Thông tin', children: p && (
              <Form layout="vertical" initialValues={p} onFinish={(v) => save.mutate(v)}>
                <Form.Item label="Số điện thoại"><Input value={p.phone} disabled /></Form.Item>
                <Form.Item name="fullName" label="Họ tên"><Input maxLength={100} /></Form.Item>
                <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
                <div className="g-actions" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <button type="button" className="g-btn-ghost" onClick={() => setPwd(true)}>Đổi mật khẩu</button>{' '}
                    <button type="button" className="g-btn-ghost g-danger" onClick={() => { logout(); qc.clear() }}>Đăng xuất</button>
                  </span>
                  <button className="g-cta" type="submit" disabled={save.isPending}>Lưu</button>
                </div>
              </Form>
            ),
          },
        ]} />
      </div>
      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  )
}
