import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Result, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { useGuestStore } from '@/store/guestStore'

/** Landing for the table QR sticker: /t/:qr – remembers the table and starts a fresh cart for it. */
export function TableEntryPage() {
  const { qr = '' } = useParams()
  const navigate = useNavigate()
  const { setTable, setCart, tableQr } = useGuestStore()
  const { data, isError } = useQuery({ queryKey: ['table', qr], queryFn: () => publicApi.table(qr), retry: false })

  useEffect(() => {
    if (!data) return
    if (data.status === 'INACTIVE') return
    if (tableQr !== qr) setCart(null)
    setTable(qr, data.tableNo)
    navigate('/', { replace: true })
  }, [data, qr, tableQr, setTable, setCart, navigate])

  if (isError) return <Result status="warning" title="Mã QR không hợp lệ" subTitle="Vui lòng nhờ nhân viên hỗ trợ." />
  if (data?.status === 'INACTIVE') return <Result status="info" title={`Bàn ${data.tableNo} đang tạm ngưng phục vụ`} />
  return <div className="g-container g-page g-center"><Spin size="large" tip="Đang mở thực đơn cho bàn của bạn…" /></div>
}
