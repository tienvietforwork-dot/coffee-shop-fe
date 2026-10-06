import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { Empty, Input } from 'antd'
import { publicApi } from '@/api/public'
import { useGuestStore } from '@/store/guestStore'
import { useAuthStore } from '@/store/authStore'
import { ORDER_STATUS, dateTime, money } from '@/lib/format'

export function MyOrdersPage() {
  const orders = useGuestStore((s) => s.orders)
  const isCustomer = !!useAuthStore((s) => s.user?.customerId)
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const results = useQueries({
    queries: orders.map((o) => ({ queryKey: ['track', o.code], queryFn: () => publicApi.order(o.code), retry: false })),
  })

  return (
    <div className="g-container g-page g-narrow">
      <h1 className="g-page-title">Đơn của tôi</h1>
      {isCustomer && <p><Link to="/account">Xem toàn bộ đơn trong tài khoản của bạn →</Link></p>}
      <div className="g-panel">
        <Input.Search
          placeholder="Nhập mã đơn để tra cứu, ví dụ CH261006ABCD"
          enterButton="Tra cứu"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onSearch={(v) => v.trim() && navigate(`/order/${v.trim()}`)}
        />
      </div>
      {orders.length === 0 ? (
        <Empty description="Bạn chưa đặt đơn nào trên thiết bị này" />
      ) : (
        <ul className="g-order-list">
          {results.map((r, i) => {
            const o = r.data
            return (
              <li key={orders[i].code}>
                <Link to={`/order/${orders[i].code}`} className="g-panel g-order-item">
                  <div>
                    <strong>{orders[i].code}</strong>
                    <span className="g-muted">{dateTime(orders[i].at)}</span>
                    {o && <span className="g-muted">{o.items.map((x) => `${x.quantity}× ${x.coffeeName}`).join(', ')}</span>}
                  </div>
                  <div className="g-order-right">
                    {o && <span className={`g-status g-status-${o.status.toLowerCase()}`}>{ORDER_STATUS[o.status].text}</span>}
                    {o && <strong>{money(o.totalAmount)}</strong>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
