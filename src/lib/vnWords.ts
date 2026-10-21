const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const GROUPS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']

/** 0–999; {@code full}: a group after a higher one ("một triệu không trăm linh năm nghìn") */
function readHundreds(n: number, full: boolean): string {
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  const words: string[] = []
  if (h > 0 || full) words.push(DIGITS[h], 'trăm')
  if (t > 1) {
    words.push(DIGITS[t], 'mươi')
    if (u === 1) words.push('mốt')
    else if (u === 4) words.push('tư')
    else if (u === 5) words.push('lăm')
    else if (u > 0) words.push(DIGITS[u])
  } else if (t === 1) {
    words.push('mười')
    if (u === 5) words.push('lăm')
    else if (u > 0) words.push(DIGITS[u])
  } else if (u > 0) {
    if (h > 0 || full) words.push('linh')
    words.push(DIGITS[u])
  }
  return words.join(' ')
}

/** "Ba trăm mười một nghìn sáu trăm đồng" — the "Tổng số tiền (viết bằng chữ)" line of a phiếu. */
export function vndInWords(amount: number): string {
  let n = Math.round(Math.abs(amount))
  if (n === 0) return 'Không đồng'
  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue
    parts.push(readHundreds(groups[i], i < groups.length - 1), GROUPS[i])
  }
  const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return (amount < 0 ? 'Âm ' : '') + text.charAt(0).toUpperCase() + text.slice(1) + ' đồng'
}
