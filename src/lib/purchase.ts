import type { PurchaseOrder, PurchaseOrderItem } from '@/api/types'
import { date, money, num } from '@/lib/format'

/** "10 Hộp 500 ml = 5.000 ml", or "5.000 ml" for a loose line */
export const orderedText = (i: Pick<PurchaseOrderItem, 'packageName' | 'packageCount' | 'quantity' | 'unit'>) =>
  i.packageName && i.packageCount ? `${num(i.packageCount)} ${i.packageName} = ${num(i.quantity)} ${i.unit}` : `${num(i.quantity)} ${i.unit}`

/** price of one package (or one unit for a loose line), from the price per unit of the material */
export const pricePerLine = (i: { unitPrice?: number; packageSize?: number }) =>
  i.unitPrice == null ? undefined : Math.round(i.unitPrice * (i.packageSize ?? 1))

const esc = (s?: string | number | null) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** A4 phiếu đặt hàng to send the supplier: printed through a hidden frame (the browser can save it as PDF). */
export function printPurchaseOrder(o: PurchaseOrder) {
  const rows = o.items.map((i, n) => `<tr>
      <td>${n + 1}</td><td>${esc(i.materialName)}</td>
      <td>${i.packageName ? `${esc(i.packageName)}` : esc(i.unit)}</td>
      <td class="r">${esc(num(i.packageCount ?? i.quantity))}</td>
      <td class="r">${esc(i.unitPrice == null ? '' : money(pricePerLine(i)))}</td>
      <td class="r">${esc(i.unitPrice == null ? '' : money(i.amount))}</td>
      <td>${esc(i.note)}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.code)}</title><style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
    h1 { text-align: center; font-size: 20px; margin: 4px 0 2px; }
    .c { text-align: center; } .r { text-align: right; } .muted { color: #666; }
    .head { display: flex; justify-content: space-between; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
    th { background: #f2ece6; }
    .sign { display: flex; justify-content: space-around; margin-top: 36px; text-align: center; }
    .sign div { width: 40%; } .sign i { color: #666; font-size: 12px; }
  </style></head><body>
    <div class="head"><div><b>COFFEEHOLIC</b><div class="muted">Bộ phận kho</div></div><div class="r">Số: <b>${esc(o.code)}</b><div class="muted">Ngày ${esc(date(o.orderedAt ?? o.createdAt))}</div></div></div>
    <h1>PHIẾU ĐẶT HÀNG</h1>
    <p class="c muted">${o.status === 'DRAFT' ? '(Bản nháp)' : ''}</p>
    <p><b>Kính gửi:</b> ${esc(o.supplierName)}${o.supplierPhone ? ` · ĐT ${esc(o.supplierPhone)}` : ''}${o.supplierAddress ? `<br><span class="muted">${esc(o.supplierAddress)}</span>` : ''}</p>
    <p>Coffeeholic đề nghị quý nhà cung cấp giao các mặt hàng sau${o.expectedDate ? `, <b>trước ngày ${esc(date(o.expectedDate))}</b>` : ''}:</p>
    <table><thead><tr><th>#</th><th>Mặt hàng</th><th>Quy cách</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5" class="r"><b>Tổng cộng</b></td><td class="r"><b>${esc(money(o.totalAmount))}</b></td><td></td></tr></tfoot></table>
    ${o.note ? `<p><b>Ghi chú:</b> ${esc(o.note)}</p>` : ''}
    <div class="sign"><div><b>Người lập phiếu</b><br><i>(ký, ghi rõ họ tên)</i><br><br><br><br>${esc(o.staffName ?? o.createdBy)}</div>
    <div><b>Xác nhận của nhà cung cấp</b><br><i>(ký, ghi rõ họ tên)</i></div></div>
  </body></html>`
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    frame.contentWindow!.focus()
    frame.contentWindow!.print()
    setTimeout(() => frame.remove(), 1000)
  }, 200)
}
