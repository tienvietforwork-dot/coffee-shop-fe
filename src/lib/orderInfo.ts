import type { Order } from '@/api/types'

/** Khách của đơn: tên · SĐT (đơn giao không gắn khách thì lấy người nhận), không có thì "Khách lẻ". */
export function customerText(o: Order) {
  const name = o.customerName || o.shipment?.recipientName
  const phone = o.customerPhone || o.shipment?.recipientPhone
  return [name, phone].filter(Boolean).join(' · ') || 'Khách lẻ'
}

/** Nơi nhận: địa chỉ giao, bàn, hoặc lấy tại quầy. */
export function receiveText(o: Order) {
  if (o.shipment) return o.shipment.address
  if (o.orderType === 'DINE_IN') return o.tableNo ? `Tại bàn ${o.tableNo}` : 'Dùng tại quán'
  return 'Lấy tại quầy'
}

/** Tổng khách được giảm: theo món + đợt giảm giá theo đơn + voucher. */
export const totalDiscount = (o: Order) => (o.itemDiscount ?? 0) + o.discountAmount

/** Món kèm mã sản phẩm, gọn cho một ô bảng: "SP004 ×2, SP001 ×1". */
export const itemCodes = (o: Order) => o.items.map((i) => `${i.coffeeCode ?? i.coffeeName} ×${i.quantity}`).join(', ')
