import { useQuery } from '@tanstack/react-query'
import { AutoComplete, Input } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'
import { publicApi } from '@/api/public'
import { useDebounced } from '@/lib/useDebounced'

/** Ô địa chỉ có gợi ý khi gõ, như ô tìm kiếm của Google Maps. Dùng trong Form.Item (value / onChange). */
export function AddressInput({ value, onChange, placeholder = 'Nhập địa chỉ' }: {
  value?: string; onChange?: (v: string) => void; placeholder?: string
}) {
  const q = useDebounced((value ?? '').trim(), 350)
  const { data = [] } = useQuery({
    queryKey: ['address-suggest', q], queryFn: () => publicApi.addressSuggest(q),
    enabled: q.length >= 3, staleTime: 10 * 60_000, retry: false,
  })
  const options = data.filter((s) => s !== value).map((s) => ({ value: s, label: <><EnvironmentOutlined style={{ color: '#8c8c8c', marginRight: 6 }} />{s}</> }))
  return (
    <AutoComplete value={value} onChange={onChange} options={q.length >= 3 ? options : []} style={{ width: '100%' }} popupMatchSelectWidth>
      <Input placeholder={placeholder} allowClear />
    </AutoComplete>
  )
}
