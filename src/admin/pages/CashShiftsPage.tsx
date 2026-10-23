import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Radio, Row, Space, Statistic, Table, Tag } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { CashShift } from '@/api/types'
import { dateTime, money, num } from '@/lib/format'
import { printCashShift } from '@/lib/purchase'
import { PageHeader } from '../components/PageHeader'
import { MoneyInput } from '../components/MoneyInput'
import { useAction } from '../components/useCrud'

/** tiền Việt Nam đang lưu hành, lớn → nhỏ */
const NOTES = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500]

/**
 * Ca thu ngân: mở ca (đếm tiền đầu ca, mặc định = tiền ca trước để lại) → thu / chi ngoài bán hàng → chốt ca: đếm tiền
 * theo mệnh giá, so với tiền mặt lý thuyết, ghi lý do chênh lệch, để lại két / nộp lại → in biên bản bàn giao ca.
 * Ca đã chốt không sửa, không mở lại.
 */
export function CashShiftsPage() {
  const { data: current, isLoading } = useQuery({ queryKey: ['cash-shift'], queryFn: coreApi.currentShift, refetchInterval: 30_000 })
  const { data: suggested } = useQuery({ queryKey: ['cash-shift-suggested'], queryFn: coreApi.suggestedOpening, enabled: !current })
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
  const { data: history = [] } = useQuery({ queryKey: ['cash-shifts', params], queryFn: () => coreApi.cashShifts(params) })
  const keys = [['cash-shift'], ['cash-shifts'], ['cash-shift-suggested']]
  const open = useAction(coreApi.openShift, keys, 'Đã mở ca')
  const move = useAction(coreApi.shiftMovement, keys, 'Đã ghi')
  const close = useAction(coreApi.closeShift, keys, 'Đã chốt ca')
  const [opening, setOpening] = useState(false)
  const [moving, setMoving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [counts, setCounts] = useState<Record<number, number>>({})
  const counted = NOTES.reduce((s, v) => s + v * (counts[v] ?? 0), 0)
  const diff = current ? counted - current.expectedCash : 0
  const [closeForm] = Form.useForm()

  return (
    <>
      <PageHeader title="Ca thu ngân" subtitle="Mở ca · thu / chi trong ca · chốt ca đếm tiền theo mệnh giá · bàn giao ca" />
      {!isLoading && !current && (
        <Card style={{ marginBottom: 16 }}>
          <Alert type="warning" showIcon message="Chưa mở ca" description="Mở ca trước khi bán hàng tại quầy để tiền thu được tính vào ca." style={{ marginBottom: 12 }} />
          <Button type="primary" onClick={() => setOpening(true)}>Mở ca</Button>
        </Card>
      )}
      {current && (
        <Card title={<>Ca đang mở <Tag color="green">{current.code}</Tag></>} style={{ marginBottom: 16 }}
          extra={<Space>
            <Button onClick={() => setMoving(true)}>Thu / chi trong ca</Button>
            <Button type="primary" danger onClick={() => { setCounts({}); closeForm.resetFields(); closeForm.setFieldsValue({ nextOpeningCash: current.openingCash }); setClosing(true) }}>Chốt ca</Button>
          </Space>}>
          <Row gutter={16}>
            <Col xs={12} md={4}><Statistic title="Thu ngân" value={current.staffName ?? '—'} /></Col>
            <Col xs={12} md={4}><Statistic title="Mở lúc" value={dateTime(current.openedAt)} /></Col>
            <Col xs={12} md={4}><Statistic title="Tiền đầu ca" value={current.openingCash} formatter={(v) => money(Number(v))} /></Col>
            <Col xs={12} md={4}><Statistic title="Doanh thu trong ca" value={current.totalSales} formatter={(v) => money(Number(v))} /></Col>
            <Col xs={12} md={4}><Statistic title="Trong đó tiền mặt" value={current.cashSales} formatter={(v) => money(Number(v))} /></Col>
            <Col xs={12} md={4}><Statistic title="Tiền mặt lý thuyết" value={current.expectedCash} formatter={(v) => <b>{money(Number(v))}</b>} /></Col>
          </Row>
          {current.movements.length > 0 && (
            <Table rowKey="id" size="small" pagination={false} style={{ marginTop: 12 }} dataSource={current.movements}
              columns={[
                { title: 'Lúc', dataIndex: 'at', render: dateTime },
                { title: 'Loại', dataIndex: 'type', render: (t) => (t === 'IN' ? <Tag color="green">Thu</Tag> : <Tag color="red">Chi</Tag>) },
                { title: 'Lý do', dataIndex: 'reason' },
                { title: 'Người ghi', dataIndex: 'staffName' },
                { title: 'Số tiền', dataIndex: 'amount', render: money, align: 'right' },
              ]} />
          )}
        </Card>
      )}

      <Card title="Lịch sử ca" extra={<DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />}>
        <Table<CashShift> rowKey="id" size="small" dataSource={history} scroll={{ x: 1000 }}
          columns={[
            { title: 'Ca', render: (_, s) => <><b>{s.code}</b>{s.open && <Tag color="green" style={{ marginLeft: 6 }}>Đang mở</Tag>}</> },
            { title: 'Thu ngân', dataIndex: 'staffName' },
            { title: 'Thời gian', render: (_, s) => <>{dateTime(s.openedAt)}<div className="a-muted small">→ {dateTime(s.closedAt)}</div></> },
            { title: 'Doanh thu', dataIndex: 'totalSales', render: money, align: 'right' },
            { title: 'Tiền mặt LT', dataIndex: 'expectedCash', render: money, align: 'right' },
            { title: 'Thực đếm', dataIndex: 'countedCash', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
            {
              title: 'Chênh lệch', render: (_, s) => (s.difference == null ? '—'
                : s.difference === 0 ? <Tag color="green">Khớp</Tag>
                  : <><Tag color={s.difference < 0 ? 'red' : 'blue'}>{s.difference < 0 ? 'Thiếu' : 'Thừa'} {money(Math.abs(s.difference))}</Tag><div className="a-muted small">{s.differenceReason}</div></>),
            },
            { title: 'Nộp lại', dataIndex: 'handoverCash', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
            { title: '', render: (_, s) => !s.open && <Button size="small" icon={<PrinterOutlined />} onClick={() => printCashShift(s)}>In</Button> },
          ]} />
      </Card>

      <Modal open={opening} title="Mở ca" onCancel={() => setOpening(false)} footer={null} destroyOnHidden>
        <Form layout="vertical" initialValues={{ openingCash: suggested?.openingCash ?? 0 }}
          onFinish={(v: { openingCash: number; note?: string }) => open.mutate(v, { onSuccess: () => setOpening(false) })}>
          <Form.Item name="openingCash" label="Tiền đầu ca (đếm thực tế trong két)" rules={[{ required: true }]}
            extra={suggested && `Ca trước để lại ${money(suggested.openingCash)}`}><MoneyInput /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={open.isPending}>Mở ca</Button>
        </Form>
      </Modal>

      <Modal open={moving} title="Thu / chi tiền mặt trong ca" onCancel={() => setMoving(false)} footer={null} destroyOnHidden>
        <Form layout="vertical" initialValues={{ type: 'OUT' }}
          onFinish={(v: { type: 'IN' | 'OUT'; amount: number; reason: string }) => move.mutate(v, { onSuccess: () => setMoving(false) })}>
          <Form.Item name="type"><Radio.Group options={[{ value: 'OUT', label: 'Chi (mua đá, trả ship…)' }, { value: 'IN', label: 'Thu (nạp tiền lẻ…)' }]} /></Form.Item>
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}><MoneyInput min={1} /></Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true }]}><Input /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={move.isPending}>Ghi</Button>
        </Form>
      </Modal>

      <Modal open={closing} width={760} title={`Chốt ca ${current?.code ?? ''}`} onCancel={() => setClosing(false)} destroyOnHidden
        footer={<Button type="primary" danger loading={close.isPending} onClick={() => closeForm.submit()}>Chốt ca</Button>}>
        {current && <Form form={closeForm} layout="vertical" onFinish={(v: { nextOpeningCash?: number; receivedBy?: string; differenceReason?: string; note?: string }) =>
          close.mutate({ ...v, denominations: counts }, { onSuccess: (s) => { setClosing(false); printCashShift(s) } })}>
          <Row gutter={16}>
            <Col md={12}>
              <b>Đếm tiền trong két theo mệnh giá</b>
              <Table rowKey={(v) => v} size="small" pagination={false} dataSource={NOTES} style={{ marginTop: 8 }}
                columns={[
                  { title: 'Mệnh giá', render: (v: number) => num(v) },
                  { title: 'Số tờ', render: (v: number) => <InputNumber min={0} value={counts[v]} onChange={(n) => setCounts({ ...counts, [v]: n ?? 0 })} style={{ width: 90 }} /> },
                  { title: 'Thành tiền', render: (v: number) => money(v * (counts[v] ?? 0)), align: 'right' },
                ]} />
            </Col>
            <Col md={12}>
              <Descriptions size="small" column={1} bordered items={[
                { label: 'Tiền đầu ca', children: money(current.openingCash) },
                { label: 'Bán tiền mặt', children: money(current.cashSales) },
                { label: 'Thu / chi trong ca', children: `+${money(current.cashIn)} / −${money(current.cashOut)}` },
                { label: <b>Tiền mặt lý thuyết</b>, children: <b>{money(current.expectedCash)}</b> },
                { label: <b>Thực đếm</b>, children: <b>{money(counted)}</b> },
                { label: 'Chênh lệch', children: diff === 0 ? <Tag color="green">Khớp</Tag> : <Tag color={diff < 0 ? 'red' : 'blue'}>{diff < 0 ? 'Thiếu' : 'Thừa'} {money(Math.abs(diff))}</Tag> },
                { label: 'Chuyển khoản / thẻ / ví', children: money(current.transferSales + current.cardSales + current.ewalletSales) },
              ]} />
              {diff !== 0 && (
                <Form.Item name="differenceReason" label="Lý do chênh lệch" rules={[{ required: true }]} style={{ marginTop: 12 }}>
                  <Input placeholder="Thối nhầm, quên ghi chi…" />
                </Form.Item>
              )}
              <Form.Item name="nextOpeningCash" label="Để lại két cho ca sau" style={{ marginTop: 12 }}><MoneyInput max={counted} /></Form.Item>
              <Form.Item name="receivedBy" label="Người nhận ca / quản lý"><Input /></Form.Item>
              <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
            </Col>
          </Row>
          <Alert type="info" showIcon message="Sau khi chốt, đối chiếu tiền chuyển khoản với sao kê ngân hàng. Ca đã chốt không sửa được." />
        </Form>}
      </Modal>
    </>
  )
}
