import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space } from 'antd'
import { PlusOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import { coreApi, type TablePayload } from '@/api/core'
import type { DiningTable } from '@/api/types'
import { TABLE_STATUS, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { P, usePerm } from '@/lib/perm'

const tableUrl = (qr: string) => `${window.location.origin}/t/${qr}`

export function TablesPage() {
  const isAdmin = usePerm().can(P.TABLES_EDIT)
  const { data = [] } = useQuery({ queryKey: ['tables'], queryFn: coreApi.tables, refetchInterval: 30000 })
  const [edit, setEdit] = useState<Partial<DiningTable> | null>(null)
  const [print, setPrint] = useState<DiningTable | null>(null)
  const save = useAction((v: TablePayload & { id?: number }) => (v.id ? coreApi.updateTable(v.id, v) : coreApi.createTable(v)), [['tables']])
  const regen = useAction(coreApi.regenerateQr, [['tables']], 'Đã tạo mã QR mới')
  const del = useAction(coreApi.deleteTable, [['tables']], 'Đã xóa')

  return (
    <>
      <PageHeader title="Bàn & mã QR" subtitle="Khách quét QR trên bàn để mở thực đơn và đặt món tại bàn"
        extra={isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ status: 'AVAILABLE', capacity: 4 })}>Thêm bàn</Button>} />
      <Row gutter={[16, 16]}>
        {data.map((t) => (
          <Col key={t.id} xs={12} md={8} xl={6}>
            <Card className="a-table-card"
              actions={[
                <PrinterOutlined key="p" onClick={() => setPrint(t)} />,
                ...(isAdmin ? [
                  <span key="e" onClick={() => setEdit(t)}>Sửa</span>,
                  <Popconfirm key="r" title="Tạo QR mới? Mã cũ sẽ không dùng được nữa." onConfirm={() => regen.mutate(t.id)}><ReloadOutlined /></Popconfirm>,
                ] : []),
              ]}>
              <div className="a-table-no">{t.tableNo}</div>
              <QRCodeSVG value={tableUrl(t.qrCode)} size={96} />
              <div className="a-muted">{t.area} · {t.capacity} chỗ</div>
              <StatusTag label={TABLE_STATUS[t.status]} />
            </Card>
          </Col>
        ))}
      </Row>
      <Modal open={!!edit} title={edit?.id ? `Sửa bàn ${edit.tableNo}` : 'Thêm bàn'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={edit ?? {}} onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <div className="a-grid-2">
            <Form.Item name="tableNo" label="Số bàn" rules={[{ required: true }]}><Input maxLength={10} /></Form.Item>
            <Form.Item name="capacity" label="Sức chứa"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="area" label="Khu vực"><Input /></Form.Item>
          <Form.Item name="status" label="Trạng thái"><Select options={options(TABLE_STATUS)} /></Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            {edit?.id ? <Popconfirm title="Xóa bàn?" onConfirm={() => del.mutate(edit.id!, { onSuccess: () => setEdit(null) })}><Button danger>Xóa</Button></Popconfirm> : <span />}
            <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
          </Space>
        </Form>
      </Modal>
      <Modal open={!!print} footer={<Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>} onCancel={() => setPrint(null)} width={380}>
        {print && (
          <div className="a-qr-print">
            <div className="a-qr-brand">☕ Coffeeholic</div>
            <QRCodeSVG value={tableUrl(print.qrCode)} size={240} />
            <div className="a-qr-table">Bàn {print.tableNo}</div>
            <p>Quét mã để xem thực đơn & gọi món</p>
            <small>{tableUrl(print.qrCode)}</small>
          </div>
        )}
      </Modal>
    </>
  )
}
