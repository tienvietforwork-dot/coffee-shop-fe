import type { CashShift, Invoice } from '@/api/types'
import { date, dateTime, money, num } from '@/lib/format'
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

