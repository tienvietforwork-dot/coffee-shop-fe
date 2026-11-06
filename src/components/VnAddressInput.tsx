import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AutoComplete, Input, Select } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'
import { publicApi } from '@/api/public'
import { useDebounced } from '@/lib/useDebounced'
import { composeVnAddress, loadVnUnits, parseVnAddress, unitKey, type VnAddress } from '@/lib/vnAddress'

/**
 * Địa chỉ chọn từng cấp: Tỉnh / Thành phố → Phường / Xã (combo box, gõ để lọc) → số nhà, tên đường (có gợi ý).
 * Dùng trong Form.Item: value / onChange là chuỗi đầy đủ "số nhà đường, Phường …, Tỉnh …".
 */
export function VnAddressInput({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { data: units = [] } = useQuery({ queryKey: ['vn-units'], queryFn: loadVnUnits, staleTime: Infinity })
  const [addr, setAddr] = useState<VnAddress>({ street: '' })
  const emitted = useRef<string | undefined>(undefined)

  // the form set a value (initial / reset): split it into its parts
  useEffect(() => {
    if (!units.length || value === emitted.current) return
    setAddr(parseVnAddress(value, units))
    emitted.current = value
  }, [value, units])

  const update = (patch: Partial<VnAddress>) => {
    const next = { ...addr, ...patch }
    setAddr(next)
    const s = composeVnAddress(next)
    emitted.current = s
    onChange?.(s)
  }

  const province = units.find((p) => p.n === addr.province)
  // gợi ý số nhà / đường trong phường đã chọn
  const q = useDebounced(addr.street.trim().length >= 3 && addr.province ? addr.street.trim() : '', 350)
  const { data: hints = [] } = useQuery({
    queryKey: ['address-suggest', q, addr.ward, addr.province],
    queryFn: () => publicApi.addressSuggest(q, { ward: addr.ward, province: addr.province }),
    enabled: !!q, staleTime: 10 * 60_000, retry: false,
  })
  /** keep only the street part of a suggestion: drop the ward / province / city at its end */
  const streetOf = (label: string) => {
    const known = [addr.ward, addr.province].filter(Boolean).map((x) => unitKey(x!))
    const segs = label.split(',').map((s) => s.trim())
    while (segs.length > 1 && (known.includes(unitKey(segs[segs.length - 1])) || /thanh pho|tinh /.test(unitKey(segs[segs.length - 1])) || unitKey(segs[segs.length - 1]) === 'ho chi minh')) segs.pop()
    return segs.join(', ')
  }

  return (
    <div>
      <div className="a-grid-2" style={{ marginBottom: 8 }}>
        <Select showSearch allowClear placeholder="Tỉnh / Thành phố" value={addr.province} loading={!units.length}
          filterOption={(input, o) => unitKey(String(o?.label ?? '')).includes(unitKey(input))}
          options={units.map((p) => ({ value: p.n, label: p.n }))}
          onChange={(v?: string) => { if (v !== addr.province) update({ province: v, ward: undefined, street: '' }) }} />
        <Select showSearch allowClear placeholder="Phường / Xã" value={addr.ward} disabled={!province}
          filterOption={(input, o) => unitKey(String(o?.label ?? '')).includes(unitKey(input))}
          options={(province?.w ?? []).map(([, n]) => ({ value: n, label: n }))}
          onChange={(v?: string) => { if (v !== addr.ward) update({ ward: v, street: '' }) }} />
      </div>
      <AutoComplete value={addr.street} style={{ width: '100%' }}
        options={hints.map((h) => ({ value: streetOf(h), label: <><EnvironmentOutlined style={{ color: '#8c8c8c', marginRight: 6 }} />{h}</> }))
          .filter((o, i, all) => o.value && o.value !== addr.street && all.findIndex((x) => x.value === o.value) === i)}
        onChange={(v: string) => update({ street: v })}>
        <Input placeholder="Số nhà, tên đường" allowClear />
      </AutoComplete>
    </div>
  )
}
