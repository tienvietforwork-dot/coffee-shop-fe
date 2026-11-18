import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Dropdown, Empty, Modal, Segmented, Skeleton } from 'antd'
import { CarOutlined, MoreOutlined, ScanOutlined, ShoppingOutlined, TeamOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { TableBoard } from '@/api/types'
import { money } from '@/lib/format'
import { P, usePerm } from '@/lib/perm'
import type { PosTarget } from './PosOrder'
import { QrScanModal, TableStatusButtons, statusActions, useSetTableStatus } from './tableStatus'

const NO_FLOOR = 'Chưa xếp tầng'
const NO_AREA = 'Chung'

/**
 * Sơ đồ bàn: tầng (tab) → khu vực (nhóm) → bàn. Bàn có khách hiện tiền chưa thu và thời gian ngồi. Bấm bàn để gọi món;
 * nút ⋯ trên bàn hoặc "Quét mã bàn" để đổi trạng thái bằng tay (khách vào ngồi, trả bàn, tạm ngưng).
 */
export function FloorPlan({ onPick }: { onPick: (t: PosTarget) => void }) {
  const { can } = usePerm()
  const { message } = App.useApp()
  const { data: tables, isLoading } = useQuery({ queryKey: ['tables', 'board'], queryFn: coreApi.tableBoard, refetchInterval: 30_000 })
  const floors = useMemo(() => [...new Set((tables ?? []).map((t) => t.floor ?? NO_FLOOR))], [tables])
  const [floor, setFloor] = useState<string>()
  useEffect(() => {
    if (floors.length && (!floor || !floors.includes(floor))) setFloor(floors[0])
  }, [floors, floor])
  // đồng hồ cho "ngồi bao lâu"
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t) }, [])

  const setStatus = useSetTableStatus()
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<TableBoard>()
  const onCode = useCallback((qr: string) => {
    setScanning(false)
    coreApi.tableByQr(qr).then(setScanned).catch((e) => message.error(errorMessage(e)))
  }, [message])

  const all = useMemo(() => tables ?? [], [tables])
  const busy = all.filter((t) => t.occupied).length
  const serving = all.filter((t) => t.status !== 'INACTIVE').length
  const areas = useMemo(() => {
    const m = new Map<string, TableBoard[]>()
    for (const t of all) {
      if ((t.floor ?? NO_FLOOR) !== floor) continue
      const k = t.area ?? NO_AREA
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return [...m.entries()]
  }, [all, floor])
  const busyOn = (f: string) => all.filter((t) => (t.floor ?? NO_FLOOR) === f && t.occupied).length

  return (
    <>
      <div className="a-pos-quick">
        <button className="a-pos-quick-btn" onClick={() => onPick({ kind: 'TAKE_AWAY' })}>
          <ShoppingOutlined /><span><b>Mang về</b><small>Khách lấy tại quầy, thu tiền ngay</small></span>
        </button>
        <button className="a-pos-quick-btn" onClick={() => onPick({ kind: 'DELIVERY' })}>
          <CarOutlined /><span><b>Giao hàng</b><small>Tìm khách theo SĐT, giao tận nơi</small></span>
        </button>
      </div>

      <div className="a-floor-head">
        <h3>Sơ đồ bàn</h3>
        <span className="a-muted"><TeamOutlined /> {busy}/{serving} bàn có khách</span>
        <Button size="small" icon={<ScanOutlined />} onClick={() => setScanning(true)}>Quét mã bàn</Button>
        <span className="a-floor-legend">
          <i className="a-dot a-dot--free" /> Trống <i className="a-dot a-dot--busy" /> Có khách <i className="a-dot a-dot--off" /> Tạm ngưng
        </span>
      </div>

      {isLoading ? <Skeleton active /> : !all.length ? (
        <Empty description={<>Chưa có bàn nào{can(P.TABLES_EDIT) && <> — <Link to="/admin/tables">thêm bàn</Link></>}</>} />
      ) : <>
        {floors.length > 1 && (
          <Segmented value={floor} onChange={(v) => setFloor(v as string)} style={{ marginBottom: 12 }}
            options={floors.map((f) => ({ value: f, label: <>{f}{busyOn(f) > 0 && <span className="a-floor-count">{busyOn(f)}</span>}</> }))} />
        )}
        {areas.map(([area, list]) => (
          <section key={area} className="a-area">
            <div className="a-area-title">{area} <span className="a-muted">· {list.length} bàn</span></div>
            <div className="a-tbl-grid">
              {list.map((t) => (
                <TableTile key={t.id} t={t} onClick={() => onPick({ kind: 'TABLE', table: t })}
                  onStatus={(status) => setStatus.mutate({ id: t.id, status })} />
              ))}
            </div>
          </section>
        ))}
      </>}

      <QrScanModal open={scanning} onClose={() => setScanning(false)} onCode={onCode} />
      <Modal open={!!scanned} title={scanned && `Bàn ${scanned.tableNo}`} footer={null} onCancel={() => setScanned(undefined)} destroyOnHidden width={380}>
        {scanned && <>
          <p className="a-muted">{[scanned.floor, scanned.area].filter(Boolean).join(' · ')} · {scanned.status === 'INACTIVE' ? 'Tạm ngưng' : scanned.occupied ? `Có khách${scanned.unpaid ? ` · chưa thu ${money(scanned.unpaid)}` : ''}` : 'Trống'}</p>
          <TableStatusButtons table={scanned} onDone={() => setScanned(undefined)}
            onOrder={() => { setScanned(undefined); onPick({ kind: 'TABLE', table: scanned }) }} />
        </>}
      </Modal>
    </>
  )
}

function TableTile({ t, onClick, onStatus }: { t: TableBoard; onClick: () => void; onStatus: (s: TableBoard['status']) => void }) {
  const off = t.status === 'INACTIVE'
  const state = off ? 'off' : t.occupied ? 'busy' : 'free'
  const mins = t.since ? dayjs().diff(dayjs(t.since), 'minute') : undefined
  const items = statusActions(t).map((a) => ({
    key: a.status, icon: a.icon, disabled: a.disabled,
    label: a.hint ? <span title={a.hint}>{a.label}</span> : a.label,
  }))
  return (
    <div className="a-tbl-wrap">
      <button className={`a-tbl a-tbl--${state}`} disabled={off} onClick={onClick}
        title={off ? 'Bàn tạm ngưng phục vụ' : t.occupied ? 'Xem / gọi thêm / thanh toán' : 'Bắt đầu gọi món'}>
        <span className="a-tbl-no">{t.tableNo}</span>
        {t.capacity && <span className="a-tbl-cap">{t.capacity} chỗ</span>}
        {off ? <span className="a-tbl-info">Tạm ngưng</span>
          : t.occupied ? <>
            {(t.unpaid || t.total) > 0 && <span className="a-tbl-money">{money(t.unpaid || t.total)}</span>}
            <span className="a-tbl-info">{t.orderCount === 0 ? 'Có khách · chưa gọi'
              : mins != null ? (mins < 60 ? `${mins} phút` : mins < 1440 ? `${Math.floor(mins / 60)}g${String(mins % 60).padStart(2, '0')}` : `${Math.floor(mins / 1440)} ngày`) : 'Có khách'}</span>
          </>
          : <span className="a-tbl-info">Trống</span>}
        {t.waiting > 0 && <span className="a-tbl-badge" title="Đơn khách tự gọi qua QR chưa nhận pha">{t.waiting} chờ nhận</span>}
      </button>
      <Dropdown trigger={['click']} menu={{ items, onClick: ({ key }) => onStatus(key as TableBoard['status']) }}>
        <button className="a-tbl-more" aria-label={`Đổi trạng thái bàn ${t.tableNo}`}><MoreOutlined /></button>
      </Dropdown>
    </div>
  )
}
