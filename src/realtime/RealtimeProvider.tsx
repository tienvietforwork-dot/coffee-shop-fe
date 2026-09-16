import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { notification } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import type { Material, Order } from '@/types'

interface RealtimeContextValue {
  connected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue>({ connected: false })

export function useRealtime() {
  return useContext(RealtimeContext)
}

/**
 * Connects to the backend's STOMP-over-SockJS endpoint (VITE_WS_URL, e.g.
 * http://localhost:8080/ws) and subscribes to two topics:
 *  - /topic/orders            -> new/updated order events
 *  - /topic/inventory-alerts  -> low-stock material alerts
 *
 * On each event we pop an antd notification and invalidate the relevant
 * react-query cache keys so open tables/dashboards refresh automatically.
 * Only connects once the user is authenticated.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const clientRef = useRef<Client | null>(null)
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!isAuthenticated) {
      clientRef.current?.deactivate()
      clientRef.current = null
      setConnected(false)
      return
    }

    const wsUrl = import.meta.env.VITE_WS_URL

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)

        client.subscribe('/topic/orders', (message: IMessage) => {
          try {
            const order = JSON.parse(message.body) as Order
            notification.info({
              message: 'New order update',
              description: `Order ${order.code ?? order.id} is now ${order.status}`,
              placement: 'topRight',
            })
          } catch {
            notification.info({ message: 'New order update', placement: 'topRight' })
          }
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['reports'] })
        })

        client.subscribe('/topic/inventory-alerts', (message: IMessage) => {
          try {
            const material = JSON.parse(message.body) as Material
            notification.warning({
              message: 'Low stock alert',
              description: `${material.name} is at ${material.stockQuantity} ${material.unit} (min ${material.minThreshold})`,
              placement: 'topRight',
            })
          } catch {
            notification.warning({ message: 'Low stock alert', placement: 'topRight' })
          }
          queryClient.invalidateQueries({ queryKey: ['materials'] })
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  return (
    <RealtimeContext.Provider value={{ connected }}>{children}</RealtimeContext.Provider>
  )
}
