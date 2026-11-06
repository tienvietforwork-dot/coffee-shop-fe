import dayjs from 'dayjs'
import type {
  CoffeeStatus, IncidentSeverity, IncidentStatus, IncidentType, OrderChannel, OrderStatus,
  OrderType, PaymentMethod, PaymentStatus, ShipmentStatus, TableStatus, WorkStatus,
} from '@/api/types'

const vnd = new Intl.NumberFormat('vi-VN')

export const money = (v?: number | null) => (v == null ? '—' : `${vnd.format(Math.round(Number(v)))}đ`)
export const num = (v?: number | null) => (v == null ? '—' : vnd.format(Number(v)))
export const dateTime = (v?: string | null) => (v ? dayjs(v).format('HH:mm DD/MM/YYYY') : '—')
export const date = (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')
export const time = (v?: string | null) => (v ? dayjs(v).format('HH:mm') : '—')

type Label = { text: string; color: string }
const L = (text: string, color: string): Label => ({ text, color })

export const ORDER_STATUS: Record<OrderStatus, Label> = {
  PENDING: L('Chờ xác nhận', 'gold'),
  CONFIRMED: L('Đã xác nhận', 'blue'),
  PREPARING: L('Đang pha chế', 'purple'),
  READY: L('Sẵn sàng', 'cyan'),
  DELIVERING: L('Đang giao', 'geekblue'),
  COMPLETED: L('Hoàn tất', 'green'),
  REJECTED: L('Bị từ chối', 'red'),
  CANCELLED: L('Đã hủy', 'default'),
}
export const ORDER_TYPE: Record<OrderType, string> = { DINE_IN: 'Tại bàn', TAKE_AWAY: 'Mang về', DELIVERY: 'Giao hàng' }
export const ORDER_CHANNEL: Record<OrderChannel, Label> = {
  COUNTER: L('Tại quầy', 'orange'), QR: L('QR tại bàn', 'magenta'), ONLINE: L('Online', 'blue'),
}
export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', E_WALLET: 'Ví điện tử', CARD: 'Thẻ',
}
export const PAYMENT_STATUS: Record<PaymentStatus, Label> = {
  PENDING: L('Chưa thu', 'gold'), PAID: L('Đã thanh toán', 'green'), FAILED: L('Hủy', 'default'), REFUNDED: L('Đã hoàn tiền', 'red'),
}
export const SHIPMENT_STATUS: Record<ShipmentStatus, Label> = {
  PENDING: L('Chờ giao', 'gold'), BOOKED: L('Chờ giao', 'gold'), DRIVER_ACCEPTED: L('Chờ giao', 'gold'),
  DELIVERING: L('Đang giao', 'geekblue'), DELIVERED: L('Đã giao', 'green'), FAILED: L('Giao không thành công', 'red'),
}
export const COFFEE_STATUS: Record<CoffeeStatus, Label> = {
  AVAILABLE: L('Đang bán', 'green'), SOLD_OUT: L('Hết món', 'orange'), HIDDEN: L('Ẩn', 'default'), DISCONTINUED: L('Ngừng bán', 'red'),
}
export const TABLE_STATUS: Record<TableStatus, Label> = {
  AVAILABLE: L('Trống', 'green'), OCCUPIED: L('Có khách', 'orange'), INACTIVE: L('Tạm ngưng', 'default'),
}
export const WORK_STATUS: Record<WorkStatus, Label> = {
  ACTIVE: L('Đang làm', 'green'), ON_LEAVE: L('Nghỉ phép', 'gold'), RESIGNED: L('Đã nghỉ', 'default'),
}
export const INCIDENT_TYPE: Record<IncidentType, string> = {
  WRONG_ITEM: 'Sai món', QUALITY: 'Chất lượng', LATE: 'Trễ đơn', SPILLED: 'Đổ / hư hỏng', MISSING_ITEM: 'Thiếu món', OTHER: 'Khác',
}
export const INCIDENT_SEVERITY: Record<IncidentSeverity, Label> = {
  LOW: L('Thấp', 'green'), MEDIUM: L('Trung bình', 'gold'), HIGH: L('Cao', 'red'),
}
export const INCIDENT_STATUS: Record<IncidentStatus, Label> = {
  OPEN: L('Chưa xử lý', 'red'), RESOLVED: L('Đã xử lý', 'green'),
}

export const options = <K extends string>(m: Record<K, string | Label>) =>
  (Object.keys(m) as K[]).map((k) => ({ value: k, label: typeof m[k] === 'string' ? (m[k] as string) : (m[k] as Label).text }))

export const BREW_METHOD = [{ value: 'PHIN', label: 'Phin' }, { value: 'MACHINE', label: 'Máy espresso' }, { value: 'COLD_BREW', label: 'Cold brew' }, { value: 'POUR_OVER', label: 'Pour over' }]

const API_ORIGIN = String(import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '')
/** Uploaded images are stored as API-relative paths (/api/public/images/12); external links pass through. */
export const imageSrc = (v?: string | null) => (v?.startsWith('/api/') ? API_ORIGIN + v : v || undefined)

/** ảnh mặc định cho món không có ảnh hoặc ảnh lỗi (ảnh lỗi được đổi tự động trong main.tsx) */
export const DEFAULT_IMAGE = '/images/coffee-default.svg'
/** ảnh món để hiển thị: ảnh của món, không có thì ảnh mặc định */
export const photoSrc = (v?: string | null) => imageSrc(v) ?? DEFAULT_IMAGE

