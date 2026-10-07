import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { App } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { usePerm } from '@/lib/perm'
import type { CoffeeStatus, Material, Order } from '@/api/types'

const RealtimeContext = createContext({ connected: false })
export const useRealtime = () => useContext(RealtimeContext)

/**
 * STOMP over SockJS to app-core (/ws). Topics:
 *  /topic/orders           – order created / changed → refresh order screens, toast on new orders
 *  /topic/inventory-alerts – material below min stock
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const qc = useQueryClient()
  const { notification } = App.useApp()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { hasAdminAccess } = usePerm()

  useEffect(() => {
    if (!isAuthenticated || !hasAdminAccess || !import.meta.env.VITE_WS_URL) return
    const client = new Client({
      webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL) as unknown as WebSocket,
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        client.subscribe('/topic/orders', (m) => {
          const order = JSON.parse(m.body) as Order
          if (order.status === 'PENDING') {
            notification.info({
              message: `Đơn mới ${order.orderCode}`,
              description: `${order.items.reduce((n, i) => n + i.quantity, 0)} món${order.tableNo ? ` · Bàn ${order.tableNo}` : ''}`,
              placement: 'bottomRight',
            })
          }
          qc.invalidateQueries({ queryKey: ['orders'] })
          qc.invalidateQueries({ queryKey: ['order', order.id] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
          qc.invalidateQueries({ queryKey: ['shipments'] })
        })
        client.subscribe('/topic/inventory-alerts', (m) => {
          const mat = JSON.parse(m.body) as Material
          notification.warning({
            message: 'Nguyên liệu sắp hết',
            description: `${mat.name}: còn ${mat.stockQuantity} ${mat.unit} (tối thiểu ${mat.minStock})`,
            placement: 'bottomRight',
          })
          qc.invalidateQueries({ queryKey: ['materials'] })
          qc.invalidateQueries({ queryKey: ['alerts'] })
        })
        client.subscribe('/topic/menu', (m) => {
          const changes = JSON.parse(m.body) as { coffeeId: number; name: string; status: CoffeeStatus }[]
          changes.forEach((c) => notification.info({
            message: c.status === 'SOLD_OUT' ? `${c.name}: tự chuyển Hết món` : `${c.name}: bán lại`,
            description: c.status === 'SOLD_OUT' ? 'Không đủ nguyên liệu để pha thêm ly nào' : 'Kho đã đủ nguyên liệu',
            placement: 'bottomRight',
          }))
          qc.invalidateQueries({ queryKey: ['coffees'] })
          qc.invalidateQueries({ queryKey: ['menu'] })
        })
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    })
    client.activate()
    return () => {
      void client.deactivate()
      setConnected(false)
    }
  }, [isAuthenticated, hasAdminAccess, qc, notification])

  return <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>
}
