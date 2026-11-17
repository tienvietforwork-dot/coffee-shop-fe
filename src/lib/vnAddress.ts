/**
 * Đơn vị hành chính Việt Nam 2 cấp (từ 1/7/2025): 34 tỉnh / thành phố → phường / xã / đặc khu.
 * Dữ liệu: danh mục trong DB (bảng vn_provinces, vn_wards) qua GET /api/public/vn-units, tải 1 lần khi cần.
 * Địa chỉ vẫn lưu thành một chuỗi "số nhà đường, Phường …, Tỉnh/Thành phố …" để app-core đo km như cũ.
 */
import apiClient from '@/api/client'

export interface VnProvince { c: number; n: string; w: [number, string][] }

let units: Promise<VnProvince[]> | null = null
export const loadVnUnits = () => (units ??= apiClient.get<VnProvince[]>('/public/vn-units').then((r) => r.data)
  .catch((e) => { units = null; throw e })) // lỗi thì lần sau tải lại

/** "Thành phố Hồ Chí Minh" = "TP. HCM" = "ho chi minh": accents, prefixes and case ignored */
export const unitKey = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
  .replace(/^(thanh pho|tp\.?|tinh|phuong|xa|dac khu|thi tran)\s+/, '').replace(/\bhcm\b/, 'ho chi minh').replace(/\s+/g, ' ').trim()

export interface VnAddress { street: string; ward?: string; province?: string }

/** "12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh" → its parts (unknown tail: everything stays in street) */
export function parseVnAddress(value: string | undefined, all: VnProvince[]): VnAddress {
  const segs = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!segs.length) return { street: '' }
  const p = all.find((x) => unitKey(x.n) === unitKey(segs[segs.length - 1]))
  if (!p) return { street: segs.join(', ') }
  const rest = segs.slice(0, -1)
  const w = rest.length ? p.w.find(([, n]) => unitKey(n) === unitKey(rest[rest.length - 1])) : undefined
  return { street: (w ? rest.slice(0, -1) : rest).join(', '), ward: w?.[1], province: p.n }
}

export const composeVnAddress = (a: VnAddress) => [a.street.trim(), a.ward, a.province].filter(Boolean).join(', ')

/** Form rule: số nhà / đường, phường / xã và tỉnh / thành đều phải có */
export const vnAddressRule = (label = 'địa chỉ') => ({
  validator: async (_: unknown, value?: string) => {
    const a = parseVnAddress(value, await loadVnUnits())
    if (!a.province) throw new Error('Chọn tỉnh / thành phố')
    if (!a.ward) throw new Error('Chọn phường / xã')
    if (!a.street) throw new Error(`Nhập số nhà, tên đường của ${label}`)
  },
})

/** đủ số nhà / đường + phường + tỉnh (để đo km): composed strings have at least 3 parts */
export const isCompleteVnAddress = (s?: string) => !!s && s.split(',').filter((x) => x.trim()).length >= 3
