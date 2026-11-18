import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Result, Spin, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/api/public'
import { coreApi } from '@/api/core'
import { useGuestStore } from '@/store/guestStore'
import { P, usePerm } from '@/lib/perm'
import { money } from '@/lib/format'
import { TableStatusButtons } from '@/admin/pages/pos/tableStatus'

/**
 * Landing for the table QR sticker: /t/:qr – remembers the table and starts a fresh cart for it.
 * Nhân viên (đã đăng nhập, có quyền bàn / order tại quầy) quét bằng điện thoại thì mở màn đổi trạng thái bàn thay vì
 * thực đơn khách.
 */
export function TableEntryPage() {
  const { qr = '' } = useParams()
  const { canAny } = usePerm()
  const [asGuest, setAsGuest] = useState(false)
  if (canAny(P.TABLES, P.POS) && !asGuest) return <StaffTablePanel qr={qr} onGuest={() => setAsGuest(true)} />
  return <GuestEntry qr={qr} />
}

function GuestEntry({ qr }: { qr: string }) {
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

/** Nhân viên quét QR trên bàn: xem bàn, đổi trạng thái, hoặc mở màn order của bàn. */
function StaffTablePanel({ qr, onGuest }: { qr: string; onGuest: () => void }) {
  const navigate = useNavigate()
  const { data: t, isError, refetch } = useQuery({ queryKey: ['tables', 'qr', qr], queryFn: () => coreApi.tableByQr(qr), retry: false })

  if (isError) return <Result status="warning" title="Mã QR không hợp lệ" />
  if (!t) return <div className="g-container g-page g-center"><Spin size="large" /></div>
  const state = t.status === 'INACTIVE' ? <Tag>Tạm ngưng</Tag> : t.occupied ? <Tag color="orange">Có khách</Tag> : <Tag color="green">Trống</Tag>
  return (
    <div className="g-container g-page a-staff-table">
      <Card>
        <div className="a-muted small">Nhân viên · đổi trạng thái bàn</div>
        <h2 className="a-staff-table-no">Bàn {t.tableNo} {state}</h2>
        <p className="a-muted">
          {[t.floor, t.area].filter(Boolean).join(' · ')}{t.capacity ? ` · ${t.capacity} chỗ` : ''}
          {t.orderCount > 0 && <><br />{t.orderCount} đơn đang mở · chưa thu {money(t.unpaid)}</>}
        </p>
        <TableStatusButtons table={t} onDone={() => void refetch()} onOrder={() => navigate(`/admin/pos?table=${t.id}`)} />
        <Button type="link" block style={{ marginTop: 8 }} onClick={onGuest}>Xem thực đơn như khách</Button>
      </Card>
    </div>
  )
}
