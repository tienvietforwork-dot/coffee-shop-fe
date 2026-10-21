import type { CashShift, GoodsReceipt, Invoice, PurchaseOrder, PurchaseOrderItem, Stocktake, SupplierPayment, SupplierReturn } from '@/api/types'
import { PAYMENT_METHOD, RETURN_SETTLEMENT, STOCK_QUALITY, date, dateTime, money, num } from '@/lib/format'
import { vndInWords } from '@/lib/vnWords'

/** "10 Hộp 500 ml = 5.000 ml", or "5.000 ml" for a loose line */
export const orderedText = (i: Pick<PurchaseOrderItem, 'packageName' | 'packageCount' | 'quantity' | 'unit'>) =>
  i.packageName && i.packageCount ? `${num(i.packageCount)} ${i.packageName} = ${num(i.quantity)} ${i.unit}` : `${num(i.quantity)} ${i.unit}`

/** price of one package (or one unit for a loose line), from the price per unit of the material */
export const pricePerLine = (i: { unitPrice?: number; packageSize?: number }) =>
  i.unitPrice == null ? undefined : Math.round(i.unitPrice * (i.packageSize ?? 1))

/** a quantity in the line's packaging when it has one ("9 Hộp 1 L"), else in the material's unit ("9.000 ml") */
export const inPackages = (qty: number, l: { packageName?: string; packageSize?: number; unit: string }) =>
  l.packageSize ? `${num(Math.round((qty / l.packageSize) * 100) / 100)} ${l.packageName}` : `${num(qty)} ${l.unit}`

/** the money lines under the goods: giảm giá, thuế GTGT, chi phí nhập, total */
export const moneyLines = (d: { goodsAmount: number; discountAmount: number; vatRate?: number; vatAmount: number; shippingCost: number; totalAmount: number }) => [
  ['Tổng tiền hàng', d.goodsAmount],
  ...(d.discountAmount ? [['Giảm giá', -d.discountAmount]] : []),
  ...(d.vatRate != null ? [[`Thuế GTGT (${num(d.vatRate)}%)`, d.vatAmount]] : []),
  ...(d.shippingCost ? [['Chi phí nhập hàng', d.shippingCost]] : []),
  ['Tổng thanh toán', d.totalAmount],
] as [string, number][]

const esc = (s?: string | number | null) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const SHOP = 'COFFEEHOLIC'

const STYLE = `
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Times New Roman', serif; font-size: 13px; color: #111; }
  h1 { text-align: center; font-size: 20px; margin: 4px 0 2px; letter-spacing: .5px; }
  .c { text-align: center; } .r { text-align: right; } .muted { color: #555; } .i { font-style: italic; }
  .head { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .form-no { text-align: center; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #555; padding: 4px 6px; vertical-align: top; }
  th { background: #f1f1f1; font-weight: bold; }
  p { margin: 4px 0; }
  .sign { display: flex; justify-content: space-between; margin-top: 18px; text-align: center; }
  .sign div { flex: 1; } .sign i { color: #555; font-size: 12px; } .sign .name { margin-top: 56px; }
  .flag { color: #b00; }
`

/** prints through a hidden frame (the browser can save it as PDF) */
function printHtml(title: string, body: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`
  const frame = document.createElement('iframe')
  Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0' })
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

/** "Ngày 20 tháng 10 năm 2026" */
const longDate = (v?: string) => {
  if (!v) return 'Ngày …… tháng …… năm ……'
  const [d, m, y] = date(v).split('/')
  return `Ngày ${d} tháng ${m} năm ${y}`
}

const header = (formNo: string | null, code: string, when?: string) => `
  <div class="head">
    <div><b>Đơn vị: ${SHOP}</b><div class="muted">Bộ phận: Kho</div></div>
    ${formNo ? `<div class="form-no"><b>Mẫu số ${formNo}</b><div class="i">(Theo Thông tư 99/2025/TT-BTC)</div></div>` : '<div></div>'}
  </div>
  <div class="c i">${longDate(when)}</div>
  <div class="c">Số: <b>${esc(code)}</b></div>`

const sign = (...roles: [string, string?][]) =>
  `<div class="sign">${roles.map(([role, name]) => `<div><b>${esc(role)}</b><br><i>(Ký, họ tên)</i><div class="name">${esc(name ?? '')}</div></div>`).join('')}</div>`

/** label cells spanning {@code cols} columns, the amount in the next one, {@code tail} empty cells after it */
const totalsRows = (cols: number, lines: [string, number][], tail = 0) =>
  lines.map(([label, v], i) => {
    const last = i === lines.length - 1
    return `<tr><td colspan="${cols}" class="r">${last ? `<b>${esc(label)}</b>` : esc(label)}</td>
      <td class="r">${last ? `<b>${esc(money(v))}</b>` : esc(money(v))}</td>${'<td></td>'.repeat(tail)}</tr>`
  }).join('')

/** A4 đơn đặt hàng to send the supplier */
export function printPurchaseOrder(o: PurchaseOrder) {
  const rows = o.items.map((i, n) => `<tr>
      <td class="c">${n + 1}</td><td>${esc(i.materialName)}</td>
      <td>${i.packageName ? esc(i.packageName) : esc(i.unit)}</td>
      <td class="r">${esc(num(i.packageCount ?? i.quantity))}</td>
      <td class="r">${esc(i.unitPrice == null ? '' : money(pricePerLine(i)))}</td>
      <td class="r">${esc(i.unitPrice == null ? '' : money(i.amount))}</td>
      <td>${esc(i.note)}</td></tr>`).join('')
  printHtml(o.code, `${header(null, o.code, o.orderedAt ?? o.createdAt)}
    <h1>ĐƠN ĐẶT HÀNG</h1>
    <p class="c muted">${o.status === 'DRAFT' ? '(Bản nháp)' : ''}</p>
    <p><b>Kính gửi:</b> ${esc(o.supplierName)}${o.supplierTaxCode ? ` · MST ${esc(o.supplierTaxCode)}` : ''}${o.supplierPhone ? ` · ĐT ${esc(o.supplierPhone)}` : ''}</p>
    ${o.supplierAddress ? `<p><b>Địa chỉ:</b> ${esc(o.supplierAddress)}</p>` : ''}
    <p>${SHOP} đề nghị quý nhà cung cấp giao các mặt hàng sau${o.expectedDate ? `, <b>trước ngày ${esc(date(o.expectedDate))}</b>` : ''}:</p>
    <table><thead><tr><th>STT</th><th>Mặt hàng</th><th>Quy cách / ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
    <tbody>${rows}${totalsRows(5, moneyLines(o), 1)}</tbody></table>
    <p><b>Điều khoản thanh toán:</b> ${o.paymentTermDays ? `trả chậm ${o.paymentTermDays} ngày kể từ ngày nhận hàng` : 'thanh toán khi nhận hàng'}.
      Hàng giao kèm phiếu giao hàng${o.vatRate != null ? ' và hóa đơn GTGT' : ''}; hàng không đạt chất lượng, quy cách hoặc hạn dùng sẽ được trả lại.</p>
    ${o.note ? `<p><b>Ghi chú:</b> ${esc(o.note)}</p>` : ''}
    ${sign(['Người lập phiếu', o.staffName ?? o.createdBy], ['Xác nhận của nhà cung cấp'])}`)
}

/** Phiếu nhập kho, mẫu 01-VT: SL theo chứng từ / thực nhập, tổng tiền bằng chữ, 4 chữ ký */
export function printGoodsReceipt(r: GoodsReceipt) {
  const rows = r.lines.map((l, n) => `<tr>
      <td class="c">${n + 1}</td>
      <td>${esc(l.materialName)}${l.packageName ? ` <span class="muted">(${esc(l.packageName)})</span>` : ''}${l.expiryDate ? `<div class="muted">HSD ${esc(date(l.expiryDate))}</div>` : ''}
        ${l.rejectedQuantity ? `<div class="flag">Không nhận ${esc(num(l.rejectedQuantity))} ${esc(l.unit)}: ${esc(l.rejectReason)}</div>` : ''}</td>
      <td class="c">NL${esc(l.materialId)}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="r">${esc(num(l.documentQuantity))}</td>
      <td class="r">${esc(num(l.receivedQuantity))}</td>
      <td class="r">${esc(l.unitPrice == null ? '' : num(l.unitPrice))}</td>
      <td class="r">${esc(money(l.amount))}</td></tr>`).join('')
  const invoice = r.invoiceNo ? `hóa đơn số ${esc(r.invoiceSeries ?? '')} ${esc(r.invoiceNo)} ngày ${esc(date(r.invoiceDate))}` : 'phiếu giao hàng'
  printHtml(r.code, `${header('01-VT', r.code, r.createdAt)}
    <h1>PHIẾU NHẬP KHO</h1>
    ${r.status === 'CANCELLED' ? `<p class="c flag"><b>ĐÃ HỦY</b> — ${esc(r.cancelReason)}</p>` : ''}
    <p>- Họ và tên người giao: <b>${esc(r.delivererName ?? '……………………')}</b></p>
    <p>- Theo ${invoice} của <b>${esc(r.supplierName)}</b>${r.supplierTaxCode ? ` (MST ${esc(r.supplierTaxCode)})` : ''}${r.purchaseOrderCode ? ` · đơn đặt hàng ${esc(r.purchaseOrderCode)}` : ''}</p>
    <p>- Nhập tại kho: Kho nguyên liệu ${SHOP}</p>
    <table><thead>
      <tr><th rowspan="2">STT</th><th rowspan="2">Tên, nhãn hiệu, quy cách, phẩm chất vật tư</th><th rowspan="2">Mã số</th><th rowspan="2">ĐVT</th>
        <th colspan="2">Số lượng</th><th rowspan="2">Đơn giá</th><th rowspan="2">Thành tiền</th></tr>
      <tr><th>Theo chứng từ</th><th>Thực nhập</th></tr></thead>
    <tbody>${rows}${totalsRows(7, moneyLines(r))}</tbody></table>
    <p>- Tổng số tiền (viết bằng chữ): <b class="i">${esc(vndInWords(r.totalAmount))}</b></p>
    <p>- Số chứng từ gốc kèm theo: ${r.invoiceNo ? '01 hóa đơn, ' : ''}01 phiếu giao hàng${r.documentImageId ? ' (ảnh lưu trên hệ thống)' : ''}</p>
    <p>- ${r.paidAmount ? `Đã trả nhà cung cấp ${esc(money(r.paidAmount))}; còn nợ ${esc(money(r.remainingAmount))}, ` : ''}hạn thanh toán ${esc(date(r.dueDate))}</p>
    ${r.note ? `<p>- Ghi chú: ${esc(r.note)}</p>` : ''}
    ${sign(['Người lập phiếu', r.staffName ?? r.createdBy], ['Người giao hàng', r.delivererName], ['Thủ kho', r.staffName], ['Kế toán trưởng'])}`)
}

/** Phiếu trả hàng nhà cung cấp (dùng làm biên bản trả hàng, hai bên ký) */
export function printSupplierReturn(t: SupplierReturn) {
  const rows = t.items.map((l, n) => `<tr><td class="c">${n + 1}</td><td>${esc(l.materialName)}</td><td class="c">${esc(l.unit)}</td>
      <td class="r">${esc(num(l.quantity))}</td><td class="r">${esc(num(l.unitPrice))}</td><td class="r">${esc(money(l.amount))}</td></tr>`).join('')
  const totals: [string, number][] = [['Tiền hàng', t.goodsAmount]]
  if (t.vatRate != null) totals.push([`Thuế GTGT (${num(t.vatRate)}%)`, t.vatAmount])
  totals.push(['Tổng giá trị hàng trả', t.totalAmount])
  printHtml(t.code, `${header(null, t.code, t.completedAt ?? t.createdAt)}
    <h1>PHIẾU TRẢ HÀNG NHÀ CUNG CẤP</h1>
    ${t.status === 'DRAFT' ? '<p class="c muted">(Phiếu tạm)</p>' : ''}
    <p>- Nhà cung cấp: <b>${esc(t.supplierName)}</b>${t.supplierTaxCode ? ` · MST ${esc(t.supplierTaxCode)}` : ''}${t.supplierAddress ? ` · ${esc(t.supplierAddress)}` : ''}</p>
    <p>- Trả hàng của phiếu nhập: <b>${esc(t.goodsReceiptCode)}</b>${t.receiptInvoiceNo ? ` (hóa đơn số ${esc(t.receiptInvoiceNo)})` : ''}</p>
    <p>- Lý do trả: ${esc(t.reason)}</p>
    <table><thead><tr><th>STT</th><th>Tên hàng</th><th>ĐVT</th><th>Số lượng trả</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${rows}${totalsRows(5, totals)}</tbody></table>
    <p>- Bằng chữ: <b class="i">${esc(vndInWords(t.totalAmount))}</b></p>
    <p>- Hình thức: ${esc(RETURN_SETTLEMENT[t.settlement])}${t.refundMethod ? ` (${esc(PAYMENT_METHOD[t.refundMethod])})` : ''}.
      ${t.adjustmentInvoiceNo ? `Hóa đơn điều chỉnh giảm số ${esc(t.adjustmentInvoiceNo)}.` : 'Nhà cung cấp lập hóa đơn điều chỉnh giảm cho phần hàng trả lại.'}</p>
    ${sign(['Người lập phiếu', t.staffName ?? t.createdBy], ['Thủ kho'], ['Đại diện nhà cung cấp'])}`)
}

/** Phiếu chi, mẫu 02-TT */
export function printSupplierPayment(p: SupplierPayment) {
  const reason = p.goodsReceiptCode ? `Thanh toán phiếu nhập ${p.goodsReceiptCode}`
    : p.purchaseOrderCode ? `Trả trước đơn đặt hàng ${p.purchaseOrderCode}` : 'Trả nợ nhà cung cấp'
  printHtml(p.code, `${header('02-TT', p.code, p.paidAt)}
    <h1>PHIẾU CHI</h1>
    ${p.status === 'CANCELLED' ? `<p class="c flag"><b>ĐÃ HỦY</b> — ${esc(p.cancelReason)}</p>` : ''}
    <p>Họ và tên người nhận tiền: <b>${esc(p.payeeName ?? '……………………')}</b></p>
    <p>Địa chỉ: ${esc(p.supplierName)}${p.supplierAddress ? ` — ${esc(p.supplierAddress)}` : ''}</p>
    <p>Lý do chi: ${esc(reason)}${p.note ? ` — ${esc(p.note)}` : ''}</p>
    <p>Số tiền: <b>${esc(money(p.amount))}</b> (Viết bằng chữ): <b class="i">${esc(vndInWords(p.amount))}</b></p>
    <p>Hình thức: ${esc(PAYMENT_METHOD[p.method])}${p.reference ? ` · mã giao dịch ${esc(p.reference)}` : ''}</p>
    <p>Kèm theo: ${p.goodsReceiptCode ? '01' : '……'} chứng từ gốc.</p>
    ${sign(['Giám đốc'], ['Kế toán trưởng'], ['Người lập phiếu', p.staffName ?? p.createdBy], ['Thủ quỹ'], ['Người nhận tiền', p.payeeName])}
    <p class="i">Đã nhận đủ số tiền (viết bằng chữ): ${esc(vndInWords(p.amount))}</p>
    <p class="muted">In lúc ${esc(dateTime(new Date().toISOString()))}</p>`)
}

/** Bản thể hiện hóa đơn điện tử khởi tạo từ máy tính tiền (to hand to the customer) */
export function printInvoice(i: Invoice) {
  const title = i.templateCode === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'
  const rows = i.lines.map((l) => `<tr><td class="c">${l.lineNo}</td><td>${esc(l.name)}</td><td class="c">${esc(l.unit)}</td>
      <td class="r">${esc(num(l.quantity))}</td><td class="r">${esc(num(l.unitPrice))}</td><td class="r">${esc(num(l.amount))}</td></tr>`).join('')
  const buyer = i.buyerCompany || i.buyerName || i.buyerTaxCode
  printHtml(i.invoiceNo ?? `hoa-don-${i.orderCode}`, `
    <div class="head"><div><b>${esc(i.sellerName)}</b><div>MST: ${esc(i.sellerTaxCode)}</div><div class="muted">${esc(i.sellerAddress)}</div></div>
      <div class="r">Ký hiệu: <b>${esc(i.series)}</b><div>Số: <b>${esc(i.invoiceNo ?? '(chờ cấp)')}</b></div></div></div>
    <h1>${title}</h1>
    <p class="c i">(Khởi tạo từ máy tính tiền) · ${esc(dateTime(i.issuedAt ?? i.createdAt))}</p>
    ${i.kind !== 'ORIGINAL' ? `<p class="c"><b>${i.kind === 'REPLACEMENT' ? 'Thay thế' : 'Điều chỉnh'} cho hóa đơn số ${esc(i.relatedNo)}</b> — ${esc(i.reason)}</p>` : ''}
    ${i.status === 'REPLACED' ? '<p class="c flag"><b>ĐÃ BỊ THAY THẾ</b></p>' : ''}
    <p>Mã của cơ quan thuế: <b>${esc(i.taxAuthorityCode ?? '—')}</b></p>
    <p>Người mua: ${buyer ? `${esc(i.buyerCompany ?? '')}${i.buyerName ? ` · ${esc(i.buyerName)}` : ''}${i.buyerTaxCode ? ` · MST ${esc(i.buyerTaxCode)}` : ''}${i.buyerAddress ? ` · ${esc(i.buyerAddress)}` : ''}` : 'Người mua không lấy hóa đơn'}</p>
    <p>Đơn hàng: ${esc(i.orderCode)} · Hình thức thanh toán: ${esc(i.paymentMethod)}</p>
    <table><thead><tr><th>STT</th><th>Tên hàng hóa, dịch vụ</th><th>ĐVT</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
    <tbody>${rows}${totalsRows(5, [
      ...(i.vatRate != null ? [['Cộng tiền hàng (chưa thuế)', i.amountBeforeTax] as [string, number], [`Thuế GTGT ${num(i.vatRate)}%`, i.vatAmount] as [string, number]] : []),
      ['Tổng tiền thanh toán', i.totalAmount]])}</tbody></table>
    <p>Số tiền viết bằng chữ: <b class="i">${esc(vndInWords(i.totalAmount))}</b></p>
    <p class="muted">Tra cứu tại ${esc(i.lookupUrl ?? '')} · mã tra cứu <b>${esc(i.lookupCode ?? '—')}</b></p>`)
}

/** Biên bản bàn giao ca / báo cáo chốt ca: doanh thu theo PTTT, thu chi trong ca, đếm tiền theo mệnh giá, chênh lệch */
export function printCashShift(s: CashShift) {
  const notes = (s.denominations ?? '').split(',').filter(Boolean).map((p) => p.split(':').map(Number))
  const counted = notes.map(([v, n]) => `<tr><td class="r">${esc(num(v))}</td><td class="r">${esc(n)}</td><td class="r">${esc(money(v * n))}</td></tr>`).join('')
  const line = (label: string, v?: number | null, bold = false) =>
    `<tr><td>${bold ? `<b>${esc(label)}</b>` : esc(label)}</td><td class="r">${bold ? `<b>${esc(money(v))}</b>` : esc(money(v))}</td></tr>`
  printHtml(s.code, `${header(null, s.code, s.closedAt ?? s.openedAt)}
    <h1>BIÊN BẢN BÀN GIAO CA</h1>
    <p>Thu ngân: <b>${esc(s.staffName)}</b> · mở ca ${esc(dateTime(s.openedAt))} · chốt ca ${esc(dateTime(s.closedAt))}</p>
    <table><tbody>
      ${line('Tiền đầu ca', s.openingCash)}
      ${line(`Doanh thu tiền mặt (${s.orderCount} lượt thanh toán trong ca)`, s.cashSales)}
      ${line('Doanh thu chuyển khoản / QR', s.transferSales)}${line('Doanh thu thẻ', s.cardSales)}${line('Doanh thu ví điện tử', s.ewalletSales)}
      ${line('Tổng doanh thu trong ca', s.totalSales, true)}
      ${line('Thu khác trong ca', s.cashIn)}${line('Chi trong ca', s.cashOut)}
      ${line('Tiền mặt lý thuyết', s.expectedCash, true)}
      ${line('Tiền mặt thực đếm', s.countedCash, true)}
      ${line('Chênh lệch (thực đếm − lý thuyết)', s.difference, true)}
    </tbody></table>
    ${s.differenceReason ? `<p>Lý do chênh lệch: ${esc(s.differenceReason)}</p>` : ''}
    <p><b>Đếm tiền theo mệnh giá</b></p>
    <table><thead><tr><th>Mệnh giá</th><th>Số tờ</th><th>Thành tiền</th></tr></thead><tbody>${counted}</tbody></table>
    <p>Để lại két cho ca sau: <b>${esc(money(s.nextOpeningCash))}</b> · Nộp lại: <b>${esc(money(s.handoverCash))}</b> (bằng chữ: ${esc(vndInWords(s.handoverCash ?? 0))})</p>
    ${s.movements.length ? `<p><b>Thu / chi trong ca</b></p><table><tbody>${s.movements.map((m) => `<tr><td>${esc(dateTime(m.at))}</td><td>${m.type === 'IN' ? 'Thu' : 'Chi'}</td><td>${esc(m.reason)}</td><td class="r">${esc(money(m.amount))}</td></tr>`).join('')}</tbody></table>` : ''}
    ${sign(['Người giao ca', s.staffName], ['Người nhận ca / quản lý', s.receivedBy])}`)
}

/** Biên bản kiểm kê vật tư, mẫu 05-VT: theo sổ / theo kiểm kê / chênh lệch thừa – thiếu / phẩm chất */
export function printStocktake(k: Stocktake) {
  const rows = (k.items ?? []).map((l, n) => {
    const d = l.difference
    return `<tr><td class="c">${n + 1}</td>
      <td>${esc(l.materialName)} <span class="muted">lô #${l.batchId}${l.expiryDate ? ` · HSD ${esc(date(l.expiryDate))}` : ''}</span></td>
      <td class="c">${esc(l.unit)}</td><td class="r">${esc(l.unitCost == null ? '' : num(l.unitCost))}</td>
      <td class="r">${esc(num(l.bookQuantity))}</td><td class="r">${esc(l.countedQuantity == null ? '' : num(l.countedQuantity))}</td>
      <td class="r">${d > 0 ? esc(num(d)) : ''}</td><td class="r">${d > 0 ? esc(money(l.differenceValue)) : ''}</td>
      <td class="r">${d < 0 ? esc(num(-d)) : ''}</td><td class="r">${d < 0 ? esc(money(-l.differenceValue)) : ''}</td>
      <td>${esc(STOCK_QUALITY[l.quality])}${l.reason ? `<div class="muted">${esc(l.reason)}</div>` : ''}</td></tr>`
  }).join('')
  printHtml(k.code, `${header('05-VT', k.code, k.countedAt)}
    <h1>BIÊN BẢN KIỂM KÊ VẬT TƯ, HÀNG HÓA</h1>
    <p>Thời điểm kiểm kê: ${esc(dateTime(k.countedAt))}</p>
    <p>Ban kiểm kê: Trưởng ban <b>${esc(k.staffName ?? k.createdBy)}</b>${k.members ? ` · Ủy viên: ${esc(k.members)}` : ''}</p>
    <p>Đã kiểm kê kho có những mặt hàng dưới đây:</p>
    <table><thead>
      <tr><th rowspan="2">STT</th><th rowspan="2">Tên, nhãn hiệu, quy cách</th><th rowspan="2">ĐVT</th><th rowspan="2">Đơn giá</th>
        <th rowspan="2">Theo sổ</th><th rowspan="2">Theo kiểm kê</th><th colspan="2">Thừa</th><th colspan="2">Thiếu</th><th rowspan="2">Phẩm chất</th></tr>
      <tr><th>SL</th><th>Tiền</th><th>SL</th><th>Tiền</th></tr></thead>
    <tbody>${rows}<tr><td colspan="7" class="r"><b>Cộng</b></td><td class="r"><b>${esc(money(k.surplusValue))}</b></td><td></td>
      <td class="r"><b>${esc(money(k.shortageValue))}</b></td><td></td></tr></tbody></table>
    <p>Ý kiến giải quyết số chênh lệch: ${esc(k.resolution ?? '……………………………………………')}</p>
    ${sign(['Giám đốc', k.balancedByName], ['Kế toán trưởng'], ['Thủ kho'], ['Trưởng ban kiểm kê', k.staffName])}`)
}
