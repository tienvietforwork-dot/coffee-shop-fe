import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { App, Button, Input, Modal, Space } from 'antd'
import { CheckCircleOutlined, PauseCircleOutlined, ShoppingCartOutlined, TeamOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import type { TableBoard, TableStatus } from '@/api/types'

/** Đổi trạng thái bàn bằng tay; sơ đồ bàn các máy khác tải lại qua /topic/tables. */
export function useSetTableStatus(onDone?: (t: TableBoard) => void) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TableStatus }) => coreApi.setTableStatus(id, status),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tables'] })
      message.success(`Bàn ${t.tableNo}: ${t.status === 'INACTIVE' ? 'tạm ngưng' : t.occupied ? 'có khách' : 'trống'}`)
      onDone?.(t)
    },
    onError: (e) => message.error(errorMessage(e)),
  })
}

/** Các thao tác đổi trạng thái hợp lệ cho bàn ở trạng thái hiện tại. */
export interface StatusAction { status: TableStatus; label: string; icon: ReactNode; disabled?: boolean; hint?: string }

export function statusActions(t: TableBoard): StatusAction[] {
  if (t.status === 'INACTIVE') return [{ status: 'AVAILABLE', label: 'Mở lại phục vụ', icon: <CheckCircleOutlined /> }]
  const locked = t.orderCount > 0 ? { disabled: true, hint: 'Còn đơn chưa thanh toán' } : {}
  return [
    t.occupied
      ? { status: 'AVAILABLE', label: 'Trả bàn (trống)', icon: <CheckCircleOutlined />, ...locked }
      : { status: 'OCCUPIED', label: 'Khách vào ngồi', icon: <TeamOutlined /> },
    { status: 'INACTIVE', label: 'Tạm ngưng bàn', icon: <PauseCircleOutlined />, ...locked },
  ]
}

/** Khối nút đổi trạng thái (dùng ở màn quét QR bàn trên điện thoại). */
export function TableStatusButtons({ table, onOrder, onDone }: { table: TableBoard; onOrder?: () => void; onDone?: (t: TableBoard) => void }) {
  const set = useSetTableStatus(onDone)
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {onOrder && table.status !== 'INACTIVE' && (
        <Button type="primary" size="large" block icon={<ShoppingCartOutlined />} onClick={onOrder}>
          {table.orderCount ? 'Gọi thêm / thanh toán' : 'Gọi món cho bàn này'}
        </Button>
      )}
      {statusActions(table).map((a) => (
        <Button key={a.status} size="large" block icon={a.icon} disabled={a.disabled} loading={set.isPending && set.variables?.status === a.status}
          onClick={() => set.mutate({ id: table.id, status: a.status })}>
          {a.label}{a.hint ? ` — ${a.hint}` : ''}
        </Button>
      ))}
    </Space>
  )
}

/** Lấy mã bàn từ nội dung QR: link /t/{mã} in trên bàn, hoặc chính mã. */
export const qrFromText = (text: string) => {
  const m = text.trim().match(/\/t\/([^/?#\s]+)/)
  return decodeURIComponent(m ? m[1] : text.trim())
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/**
 * Quét QR bàn bằng camera ngay trong app (Chrome / Edge trên Android có BarcodeDetector). Máy không hỗ trợ: dùng app
 * camera của điện thoại quét mã trên bàn — trình duyệt đang đăng nhập nhân viên sẽ mở màn đổi trạng thái — hoặc gõ mã.
 */
export function QrScanModal({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (qr: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>()
  const [typed, setTyped] = useState('')
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!open || !supported) return
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    let stopped = false
    setError(undefined)
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    const detector = new Ctor({ formats: ['qr_code'] })
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s
        if (stopped || !video.current) return
        video.current.srcObject = s
        void video.current.play()
        timer = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return
          const [hit] = await detector.detect(video.current).catch(() => [])
          if (hit?.rawValue && !stopped) { stopped = true; onCode(qrFromText(hit.rawValue)) }
        }, 300)
      })
      .catch(() => setError('Không mở được camera — cho phép quyền camera hoặc nhập mã bên dưới.'))
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, supported, onCode])

  return (
    <Modal open={open} title="Quét mã QR trên bàn" footer={null} onCancel={onClose} destroyOnHidden width={420}>
      {supported && !error
        ? <video ref={video} className="a-qr-video" muted playsInline />
        : <p className="a-muted">{error ?? 'Trình duyệt này không quét được trong app. Dùng app camera của điện thoại quét mã trên bàn (trình duyệt đã đăng nhập tài khoản nhân viên), hoặc nhập mã bàn:'}</p>}
      <Input.Search style={{ marginTop: 12 }} placeholder="Mã QR / link in trên bàn" value={typed} onChange={(e) => setTyped(e.target.value)}
        enterButton="Mở" onSearch={(v) => v.trim() && onCode(qrFromText(v))} />
    </Modal>
  )
}
