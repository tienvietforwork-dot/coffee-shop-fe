import { useQuery } from '@tanstack/react-query'
import { Select } from 'antd'
import { publicApi } from '@/api/public'
import { money } from '@/lib/format'

/**
 * Quận / phường giao tới, grouped by khu vực giao hàng with its fee (miễn phí từ … đ, đơn tối thiểu). Used at checkout
 * and on the counter screen; a district outside every zone cannot be picked.
 */
export function DistrictSelect({ value, onChange }: { value?: string; onChange?: (v?: string) => void }) {
  const { data: zones = [] } = useQuery({ queryKey: ['delivery-zones-public'], queryFn: publicApi.deliveryZones, staleTime: 5 * 60_000 })
  return (
    <Select showSearch allowClear value={value} onChange={onChange} placeholder="Chọn quận / phường" optionFilterProp="label"
      notFoundContent="Ngoài khu vực giao hàng"
      options={zones.map((z) => ({
        label: `${z.name} · phí ${money(z.fee)}${z.freeShipThreshold != null ? ` · miễn phí từ ${money(z.freeShipThreshold)}` : ''}${z.minOrderAmount != null ? ` · tối thiểu ${money(z.minOrderAmount)}` : ''}`,
        options: z.districts.map((d) => ({ value: d, label: d })),
      }))} />
  )
}
