import dayjs from 'dayjs'
import type {
  CoffeeStatus, IncidentSeverity, IncidentStatus, IncidentType, MaterialTransactionType, OrderChannel, TransactionReason, OrderStatus,
  OrderType, PaymentMethod, PaymentStatus, ShipmentStatus, TableStatus, WorkStatus, BatchStatus, PurchaseOrderStatus, SupplierStatus,
  GoodsReceiptStatus, SupplierReturnStatus, SupplierReturnSettlement, SupplierPaymentStatus, StocktakeStatus, StockQuality,
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
  PENDING: L('Chờ đặt xe', 'gold'), BOOKED: L('Đã đặt xe', 'blue'), DRIVER_ACCEPTED: L('Tài xế đã nhận', 'cyan'),
  DELIVERING: L('Đang giao', 'geekblue'), DELIVERED: L('Đã giao', 'green'), FAILED: L('Hủy', 'default'),
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
export const TX_TYPE: Record<MaterialTransactionType, Label> = {
  IMPORT: L('Nhập', 'green'), EXPORT: L('Xuất khác', 'orange'), SALE: L('Bán', 'blue'), ADJUSTMENT: L('Kiểm kê', 'purple'),
  PRODUCTION_USE: L('Xuất chế biến', 'gold'), PRODUCE: L('Nhập chế biến', 'cyan'), DISPOSAL: L('Hủy', 'red'),
  IMPORT_CANCEL: L('Hủy phiếu nhập', 'volcano'), SUPPLIER_RETURN: L('Trả NCC', 'magenta'),
}
export const TX_REASON: Record<TransactionReason, string> = {
  EXPIRED: 'Hết hạn', SPOILED: 'Hỏng / biến chất', SPILLED: 'Đổ vỡ / rơi vãi', BREW_FAILED: 'Pha hỏng', OTHER_DISPOSAL: 'Hủy khác',
  RETURN_SUPPLIER: 'Trả nhà cung cấp', INTERNAL_USE: 'Dùng nội bộ / thử món',
}
export const DISPOSAL_REASONS: TransactionReason[] = ['EXPIRED', 'SPOILED', 'SPILLED', 'BREW_FAILED', 'OTHER_DISPOSAL']
/** xuất khác: trả nhà cung cấp has its own phiếu trả hàng nhập */
export const EXPORT_REASONS: TransactionReason[] = ['INTERNAL_USE']
/** "10 Hộp 500 ml" for a lot imported by package, empty otherwise */
export const packaging = (b: { packageName?: string; packageCount?: number }) => (b.packageName && b.packageCount ? `${num(b.packageCount)} ${b.packageName}` : '')
export const SUPPLIER_STATUS: Record<SupplierStatus, Label> = { ACTIVE: L('Đang hợp tác', 'green'), INACTIVE: L('Ngừng hợp tác', 'default') }
export const PO_STATUS: Record<PurchaseOrderStatus, Label> = {
  DRAFT: L('Nháp', 'default'), ORDERED: L('Đã đặt', 'blue'), PARTIALLY_RECEIVED: L('Nhận một phần', 'gold'),
  COMPLETED: L('Hoàn tất', 'green'), CANCELLED: L('Đã hủy', 'red'),
}
export const RECEIPT_STATUS: Record<GoodsReceiptStatus, Label> = { COMPLETED: L('Đã nhập kho', 'green'), CANCELLED: L('Đã hủy', 'red') }
export const RETURN_STATUS: Record<SupplierReturnStatus, Label> = {
  DRAFT: L('Phiếu tạm', 'default'), COMPLETED: L('Đã trả hàng', 'green'), CANCELLED: L('Đã hủy', 'red'),
}
export const RETURN_SETTLEMENT: Record<SupplierReturnSettlement, string> = { DEBT: 'Trừ vào công nợ', REFUND: 'NCC hoàn tiền' }
export const SUPPLIER_PAYMENT_STATUS: Record<SupplierPaymentStatus, Label> = { COMPLETED: L('Đã chi', 'green'), CANCELLED: L('Đã hủy', 'red') }
/** trả nhà cung cấp: tiền mặt hoặc chuyển khoản */
export const SUPPLIER_PAY_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER']
/** thuế suất GTGT hàng mua thường gặp; empty = không có hóa đơn GTGT */
export const VAT_RATES = [{ value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' }]
export const STOCKTAKE_STATUS: Record<StocktakeStatus, Label> = {
  DRAFT: L('Đang kiểm', 'gold'), BALANCED: L('Đã cân bằng kho', 'green'), CANCELLED: L('Đã hủy', 'default'),
}
export const STOCK_QUALITY: Record<StockQuality, string> = { GOOD: 'Còn tốt', POOR: 'Kém phẩm chất', LOST: 'Mất phẩm chất' }
export const BATCH_STATUS: Record<BatchStatus, Label> = {
  PREPARING: L('Đang chế biến', 'gold'), AVAILABLE: L('Còn hàng', 'green'), DEPLETED: L('Đã hết', 'default'), EXPIRED: L('Hết hạn', 'red'),
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

/** Minutes as "45 phút", "18 giờ", "7 ngày" (or "1 giờ 30 phút"). */
export const duration = (min?: number | null) => {
  if (min == null) return '—'
  if (min % 1440 === 0) return `${min / 1440} ngày`
  if (min % 60 === 0) return `${min / 60} giờ`
  return min > 60 ? `${Math.floor(min / 60)} giờ ${min % 60} phút` : `${min} phút`
}

/** delivery carriers to book a ride with */
export const CARRIERS = ['Grab', 'Be', 'Ahamove', 'Lalamove', 'Shipper cửa hàng']
