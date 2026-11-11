import type { CashShift, Invoice, Order } from '@/api/types'
import { ORDER_TYPE, date, dateTime, money, num, time } from '@/lib/format'
import { vndInWords } from '@/lib/vnWords'

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

/** Giấy in nhiệt 80mm của máy in hóa đơn tại quầy */
const RECEIPT_STYLE = `
  @page { size: 80mm auto; margin: 3mm; }
  body { width: 72mm; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; line-height: 1.35; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; } .i { font-style: italic; } .sm { font-size: 10px; }
  .shop { font-size: 14px; font-weight: bold; text-transform: uppercase; }
  h1 { text-align: center; font-size: 15px; margin: 6px 0 0; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .kv { display: flex; justify-content: space-between; gap: 8px; } .kv span:last-child { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  th { font-weight: bold; border-bottom: 1px solid #000; padding: 2px 0; }
  td { padding: 2px 0; vertical-align: top; }
  td.r, th.r { white-space: nowrap; padding-left: 6px; }
  .pay { font-size: 14px; font-weight: bold; }
  .flag { text-align: center; font-weight: bold; border: 1px solid #000; padding: 2px; margin: 4px 0; }
`

/** prints through a hidden frame (the browser can save it as PDF) */
function printHtml(title: string, body: string, style = STYLE) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${style}</style></head><body>${body}</body></html>`
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
    <div><b>Đơn vị: ${SHOP}</b></div>
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

/**
 * Bản thể hiện hóa đơn điện tử khởi tạo từ máy tính tiền, in trên giấy 80mm đưa cho khách ngay khi thanh toán:
 * ký hiệu, số hóa đơn, mã của CQT (máy tính tiền tạo), mã tra cứu và nơi tra cứu.
 */
export function printInvoice(i: Invoice) {
  const title = i.templateCode === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'
  const kv = (k: string, v?: string | number | null, bold = false) =>
    `<div class="kv"><span>${esc(k)}</span><span${bold ? ' class="b"' : ''}>${esc(v ?? '—')}</span></div>`
  const rows = i.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="r">${esc(num(l.quantity))}</td>
      <td class="r">${esc(num(l.unitPrice))}</td><td class="r">${esc(num(l.amount))}</td></tr>`).join('')
  const buyer = i.buyerCompany || i.buyerName
    ? `${esc(i.buyerCompany ?? i.buyerName)}${i.buyerCompany && i.buyerName ? ` · ${esc(i.buyerName)}` : ''}`
      + `${i.buyerTaxCode ? `<br>MST: ${esc(i.buyerTaxCode)}` : ''}${i.buyerAddress ? `<br>Đ/c: ${esc(i.buyerAddress)}` : ''}`
    : 'Khách lẻ không lấy hóa đơn'
  printHtml(i.invoiceNo ? `HD-${i.series}-${i.invoiceNo}` : `hoa-don-${i.orderCode}`, `
    <div class="c"><div class="shop">${esc(i.sellerName)}</div>
      <div class="sm">MST: ${esc(i.sellerTaxCode)}</div><div class="sm">${esc(i.sellerAddress)}</div></div>
    <div class="hr"></div>
    <h1>${title}</h1>
    <div class="c i sm">(Khởi tạo từ máy tính tiền)</div>
    <div class="c sm">Ngày: ${esc(dateTime(i.issuedAt ?? i.createdAt))}</div>
    ${i.status === 'REPLACED' ? '<div class="flag">ĐÃ BỊ THAY THẾ</div>' : ''}
    <div class="hr"></div>
    ${kv('Ký hiệu:', i.series, true)}${kv('Số HĐ:', i.invoiceNo, true)}
    ${kv('Mã CQT:', i.taxAuthorityCode)}${kv('Đơn hàng:', i.orderCode)}
    ${i.kind !== 'ORIGINAL' ? `<div class="sm b">${i.kind === 'REPLACEMENT' ? 'Thay thế' : 'Điều chỉnh'} cho hóa đơn số ${esc(i.relatedNo)}</div><div class="sm i">${esc(i.reason)}</div>` : ''}
    <div class="sm">Khách hàng: ${buyer}</div>
    <div class="hr"></div>
    <table><thead><tr><th style="text-align:left">Tên sản phẩm</th><th class="r">SL</th><th class="r">Đ.Giá</th><th class="r">T.Tiền</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="hr"></div>
    ${i.vatRate != null ? kv('Tiền chưa thuế:', money(i.amountBeforeTax)) + kv(`Thuế GTGT ${num(i.vatRate)}%:`, money(i.vatAmount)) : ''}
    <div class="kv pay"><span>Thanh toán</span><span>${esc(money(i.totalAmount))}</span></div>
    ${kv('Hình thức:', i.paymentMethod)}
    <div class="sm i">Bằng chữ: ${esc(vndInWords(Math.abs(i.totalAmount)))}</div>
    ${i.vatRate != null ? '<div class="c sm i">"Hóa đơn đã bao gồm thuế GTGT"</div>' : ''}
    <div class="hr"></div>
    <div class="c b">Thông tin tra cứu hóa đơn</div>
    ${kv('Mã tra cứu:', i.lookupCode, true)}
    <div class="sm">Tra cứu tại: ${esc(i.lookupUrl ?? '')}</div>
    <div class="hr"></div>
    <div class="c sm">Cảm ơn quý khách — hẹn gặp lại!</div>`, RECEIPT_STYLE)
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


/** Tem decal cuộn 50 × 30 mm của máy in tem nhiệt — mỗi tem một trang */
const LABEL_STYLE = `
  @page { size: 50mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .tem { width: 50mm; height: 30mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; }
  .tem:last-child { page-break-after: auto; break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 8px; border-bottom: 1px solid #000; padding-bottom: .6mm; }
  .top b { font-size: 10px; }
  .name { font-size: 14px; font-weight: bold; line-height: 1.15; margin-top: .8mm; max-height: 2.3em; overflow: hidden; }
  .note { font-size: 9px; font-style: italic; line-height: 1.2; max-height: 2.4em; overflow: hidden; }
  .bottom { margin-top: auto; display: flex; justify-content: space-between; gap: 2mm; font-size: 8px; }
  .bottom span:first-child { font-weight: bold; white-space: nowrap; }
  .bottom span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
`

/**
 * Tem dán cốc khi đơn đang pha chế: mỗi cốc một tem (món × số lượng, kể cả món trong combo),
 * ghi mã đơn, thứ tự cốc trong đơn, tên món, ghi chú của món, hình thức nhận và tên khách.
 */
export function printCupLabels(o: Order) {
  const total = o.items.reduce((n, i) => n + i.quantity, 0)
  const where = o.orderType === 'DINE_IN' && o.tableNo ? `Bàn ${o.tableNo}` : ORDER_TYPE[o.orderType]
  const when = o.pickupTime ? `Nhận ${time(o.pickupTime)}` : time(o.orderedAt)
  let cup = 0
  const labels = o.items.flatMap((i) => Array.from({ length: i.quantity }, () => {
    cup += 1
    return `<div class="tem">
      <div class="top"><span>${esc(SHOP)}</span><b>${esc(o.orderCode)}</b><b>${cup}/${total}</b></div>
      <div class="name">${esc(i.coffeeName)}</div>
      ${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}
      <div class="bottom"><span>${esc(where)} · ${esc(when)}</span><span>${esc(o.customerName ?? '')}</span></div>
    </div>`
  }))
  printHtml(`tem-${o.orderCode}`, labels.join(''), LABEL_STYLE)
}
