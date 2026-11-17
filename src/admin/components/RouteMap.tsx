import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Empty, List, Space, Spin, Tag } from 'antd'
import { CarOutlined, EnvironmentOutlined, PhoneOutlined } from '@ant-design/icons'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { RoutePlan, RouteStop } from '@/api/types'
import { SHIPMENT_STATUS } from '@/lib/format'
import { StatusTag } from './StatusTag'

const APPROX: Record<string, string> = { WARD: 'trung tâm phường / xã', PROVINCE: 'trung tâm tỉnh / thành' }
/** điểm chỉ định vị gần đúng (bản đồ không biết số nhà khách gõ) */
const approxOf = (s: RouteStop) => (s.precision ? APPROX[s.precision] : undefined)

/** chấm tròn đánh số (không cần ảnh marker của Leaflet) */
const pin = (label: string, color: string) => L.divIcon({
  className: '',
  html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
})

/** Bản đồ OpenStreetMap: quán (Q) → các điểm giao đánh số theo thứ tự, đường đi xe (hoặc nối thẳng). */
export function RouteMap({ plan, height = 360 }: { plan: RoutePlan; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const map = L.map(box.current, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const shop: L.LatLngTuple = [plan.shopLat, plan.shopLng]
    L.marker(shop, { icon: pin('Q', '#6d4c41') }).addTo(map).bindPopup(`<b>Quán</b><br>${plan.shopAddress}`)
    const stops = plan.stops.filter((s) => s.lat != null && s.lng != null)
    stops.forEach((s, i) => L.marker([s.lat!, s.lng!], { icon: pin(String(i + 1), approxOf(s) ? '#fa8c16' : '#1677ff') }).addTo(map)
      .bindPopup(`<b>${i + 1}. ${s.orderCode}</b><br>${s.recipientName} · ${s.recipientPhone}<br>${s.address}`
        + (approxOf(s) ? `<br><i>Vị trí gần đúng: ${approxOf(s)} — gọi khách hỏi đường</i>` : '')))
    const line: L.LatLngTuple[] = plan.path?.length ? plan.path : [shop, ...stops.map((s) => [s.lat!, s.lng!] as L.LatLngTuple)]
    const poly = L.polyline(line, { color: '#1677ff', weight: 5, opacity: 0.75, dashArray: plan.path?.length ? undefined : '8 8' }).addTo(map)
    map.fitBounds(poly.getBounds().pad(0.15), { maxZoom: 16 })
    return () => { map.remove() }
  }, [plan])
  return <div ref={box} style={{ height, borderRadius: 8, overflow: 'hidden', zIndex: 0 }} />
}

/** Tuyến giao cho các đơn đã chọn: bản đồ, thứ tự đi, mở Google Maps chỉ đường. */
export function RouteDrawer({ shipmentIds, onClose, title = 'Tuyến giao' }: { shipmentIds: number[] | null; onClose: () => void; title?: string }) {
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['shipment-route', shipmentIds], enabled: !!shipmentIds?.length,
    queryFn: () => coreApi.shipmentRoute(shipmentIds!), staleTime: 60_000, retry: false,
  })
  return (
    <Drawer open={!!shipmentIds} title={title} onClose={onClose} width={560} destroyOnHidden
      extra={plan?.googleMapsUrl && <Button type="primary" icon={<CarOutlined />} href={plan.googleMapsUrl} target="_blank" rel="noreferrer">Mở Google Maps</Button>}>
      {isLoading ? <Spin style={{ display: 'block', margin: 48 }} />
        : error ? <Alert type="error" showIcon message={errorMessage(error)} />
        : !plan ? <Empty /> : <RoutePlanView plan={plan} />}
    </Drawer>
  )
}

export function RoutePlanView({ plan }: { plan: RoutePlan }) {
  return (
    <>
      <Space style={{ marginBottom: 8 }} wrap>
        <Tag icon={<EnvironmentOutlined />}>{plan.stops.length + plan.unlocated.length} điểm giao</Tag>
        {plan.km != null && <Tag color="blue">~{plan.km.toLocaleString('vi-VN')} km</Tag>}
        {plan.minutes != null && <Tag color="blue">~{plan.minutes} phút chạy xe</Tag>}
        {!plan.path?.length && <span className="a-muted small">Chưa lấy được đường đi — nối thẳng các điểm</span>}
      </Space>
      <RouteMap plan={plan} />
      {plan.stops.some(approxOf) && (
        <Alert type="info" showIcon style={{ marginTop: 8 }}
          message={`${plan.stops.filter(approxOf).length} địa chỉ bản đồ không tìm thấy số nhà — chấm cam là trung tâm phường / xã, gọi khách hỏi đường; link Google Maps dùng địa chỉ chữ`} />
      )}
      {!!plan.unlocated.length && (
        <Alert type="warning" showIcon style={{ marginTop: 8 }}
          message={`Không định vị được ${plan.unlocated.length} địa chỉ — vẫn có trong link Google Maps (đi sau cùng)`} />
      )}
      <List style={{ marginTop: 8 }} size="small"
        dataSource={[...plan.stops, ...plan.unlocated]}
        renderItem={(s, i) => (
          <List.Item extra={<StatusTag label={SHIPMENT_STATUS[s.status]} />}>
            <List.Item.Meta
              avatar={<div style={{ width: 24, height: 24, borderRadius: 12, background: s.lat == null ? '#bfbfbf' : approxOf(s) ? '#fa8c16' : '#1677ff', color: '#fff', textAlign: 'center', lineHeight: '24px', fontWeight: 700 }}>{i + 1}</div>}
              title={<>{s.orderCode} · {s.recipientName} <a href={`tel:${s.recipientPhone}`}><PhoneOutlined /> {s.recipientPhone}</a></>}
              description={approxOf(s) ? <>{s.address} <Tag color="orange" style={{ marginLeft: 4 }}>vị trí gần đúng</Tag></> : s.address} />
          </List.Item>
        )} />
    </>
  )
}
