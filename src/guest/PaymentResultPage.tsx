import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Result, Spin } from 'antd'
import { publicApi } from '@/api/public'
import { money } from '@/lib/format'

/**
 * VNPAY sends the customer back here (vnp_ReturnUrl). The server checks the signature and, if the IPN has not arrived,
 * asks VNPAY; the order itself is only marked paid by the IPN / query, never by this page.
 */
export function PaymentResultPage() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ['payment-return', search], queryFn: () => publicApi.paymentReturn(search), retry: false })

  useEffect(() => {
    if (data?.status === 'SUCCESS') {
      const t = setTimeout(() => navigate(`/order/${data.orderCode}`, { replace: true }), 2500)
      return () => clearTimeout(t)
    }
  }, [data, navigate])

  if (isLoading) return <div className="g-container g-page" style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /><p>Đang xác nhận thanh toán…</p></div>
  if (isError || !data) return <Result status="error" title="Không đọc được kết quả thanh toán" extra={<Link to="/orders"><Button>Tra cứu đơn</Button></Link>} />

  const ok = data.validSignature && data.status === 'SUCCESS'
  return (
    <div className="g-container g-page g-narrow">
      <Result status={ok ? 'success' : data.status === 'PENDING' ? 'info' : 'warning'}
        title={ok ? 'Thanh toán thành công' : data.status === 'PENDING' ? 'Đang chờ ngân hàng xác nhận' : 'Thanh toán chưa thành công'}
        subTitle={<>Đơn {data.orderCode} · {money(data.amount)}<br />{data.message}</>}
        extra={[
          <Link key="order" to={`/order/${data.orderCode}`}><Button type="primary">Xem đơn hàng</Button></Link>,
          !ok && data.status !== 'PENDING' && (
            <Button key="again" onClick={async () => { const l = await publicApi.pay(data.orderCode); window.location.href = l.paymentUrl }}>Thanh toán lại</Button>
          ),
        ]} />
    </div>
  )
}
