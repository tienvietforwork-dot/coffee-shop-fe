import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { loadVnUnits, parseVnAddress } from './vnAddress'

/**
 * Phường / xã trong địa chỉ đã chọn có ngoài khu vực giao không — biết ngay khi chọn xong tỉnh + phường, trước khi nhập
 * số nhà. undefined = chưa chọn phường hoặc chưa kiểm tra xong.
 */
export function useDeliveryArea(address?: string) {
  const { data: units = [] } = useQuery({ queryKey: ['vn-units'], queryFn: loadVnUnits, staleTime: Infinity })
  const a = parseVnAddress(address, units)
  const { data } = useQuery({
    queryKey: ['delivery-area', a.ward, a.province], queryFn: () => publicApi.deliveryArea(a.ward!, a.province),
    enabled: !!a.ward, staleTime: 10 * 60_000, retry: false,
  })
  return a.ward ? data : undefined
}
