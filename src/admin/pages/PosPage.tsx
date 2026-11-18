import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Tag } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { P, usePerm } from '@/lib/perm'
import { coreApi } from '@/api/core'
import { PageHeader } from '../components/PageHeader'
import { FloorPlan } from './pos/FloorPlan'
import { PosOrder, type PosTarget } from './pos/PosOrder'

/**
 * Order tại quầy (BPMN-01, nhánh "Tại quầy"). Màn chính là sơ đồ bàn theo tầng / khu vực: bấm bàn trống để gọi món,
 * khách ngồi bàn trả sau — thanh toán xong bàn trống lại. Mang về và giao hàng là hai mục riêng ở đầu màn.
 */
export function PosPage() {
  const [target, setTarget] = useState<PosTarget | null>(null)
  const { can } = usePerm()
  // ?table=ID: mở thẳng màn order của bàn (từ màn quét QR bàn trên điện thoại)
  const [params, setParams] = useSearchParams()
  const openTable = Number(params.get('table')) || undefined
  const { data: board } = useQuery({ queryKey: ['tables', 'board'], queryFn: coreApi.tableBoard, enabled: !!openTable })
  useEffect(() => {
    const t = openTable && board?.find((b) => b.id === openTable)
    if (!t) return
    setTarget({ kind: 'TABLE', table: t })
    setParams({}, { replace: true })
  }, [openTable, board, setParams])
  // cash taken at the counter belongs to the open cashier shift
  const { data: shift, isFetched: shiftChecked } = useQuery({ queryKey: ['cash-shift'], queryFn: coreApi.currentShift, enabled: can(P.CASH_SHIFTS) || can(P.POS) })

  return (
    <>
      {!target && <PageHeader title="Order tại quầy" subtitle="Chọn bàn để gọi món, hoặc tạo đơn mang về / giao hàng"
        extra={shift && <Tag color="green">Ca {shift.code} · {shift.staffName}</Tag>} />}
      {shiftChecked && !shift && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chưa mở ca thu ngân"
          description={<>Tiền thu tại quầy được tính vào ca đang mở để chốt két cuối ca. <Link to="/admin/cash-shifts">Mở ca</Link></>} />
      )}
      {target
        ? <PosOrder key={target.kind === 'TABLE' ? `t${target.table.id}` : target.kind} target={target} onBack={() => setTarget(null)} />
        : <FloorPlan onPick={setTarget} />}
    </>
  )
}
