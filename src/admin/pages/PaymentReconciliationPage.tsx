import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Form, Input, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { PaymentTransaction } from '@/api/types'
import { PAYMENT_METHOD, PAYMENT_STATUS, dateTime, money } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

const TX_STATUS: Record<PaymentTransaction['status'], { text: string; color: string }> = {
  PENDING: { text: 'Chờ thanh toán', color: 'gold' }, SUCCESS: { text: 'Thành công', color: 'green' },
  FAILED: { text: 'Thất bại', color: 'red' }, EXPIRED: { text: 'Hết hạn', color: 'default' },
}

/**
 * Đối soát giao dịch VNPAY: mỗi lần khách mở link thanh toán / mỗi lần hoàn tiền là 1 giao dịch; kết quả do IPN hoặc
 * truy vấn (querydr) ghi về. Lệch giữa cổng và đơn được đánh dấu; kế toán đối chiếu với file đối soát / sao kê của VNPAY
 * rồi đánh dấu "đã đối soát".
 */
export function PaymentReconciliationPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day'), dayjs()])
  const [status, setStatus] = useState<PaymentTransaction['status']>()
  const [mismatch, setMismatch] = useState(false)
  const params = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), status, mismatch }
  const { data = [], isLoading } = useQuery({ queryKey: ['payment-transactions', params], queryFn: () => coreApi.paymentTransactions(params) })
  const keys = [['payment-transactions']]
  const requery = useAction(coreApi.requeryTransaction, keys, 'Đã truy vấn VNPAY')
  const reconcile = useAction((v: { id: number; note?: string }) => coreApi.reconcileTransaction(v.id, v.note), keys, 'Đã đánh dấu đối soát')
  const [marking, setMarking] = useState<PaymentTransaction | null>(null)

  const pays = data.filter((t) => t.type === 'PAY')
  const collected = pays.filter((t) => t.status === 'SUCCESS').reduce((s, t) => s + t.amount, 0)
  const refunded = data.filter((t) => t.type === 'REFUND' && t.status === 'SUCCESS').reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <PageHeader title="Đối soát thanh toán online" subtitle="Giao dịch VNPAY · kết quả từ IPN / truy vấn · đối chiếu với file đối soát của cổng" />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Thu qua VNPAY" value={collected} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Hoàn qua VNPAY" value={refunded} formatter={(v) => money(Number(v))} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Tỷ lệ thành công" value={pays.length ? Math.round(pays.filter((t) => t.status === 'SUCCESS').length / pays.length * 100) : 0} suffix="%" /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Cần xem lại" value={data.filter((t) => t.mismatch).length} valueStyle={{ color: data.some((t) => t.mismatch) ? '#cf1322' : undefined }} /></Card></Col>
      </Row>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" allowClear={false} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 160 }} value={status} onChange={setStatus}
          options={Object.entries(TX_STATUS).map(([k, v]) => ({ value: k, label: v.text }))} />
        <Segmented value={mismatch ? 'diff' : 'all'} onChange={(v) => setMismatch(v === 'diff')} options={[{ value: 'all', label: 'Tất cả' }, { value: 'diff', label: 'Chỉ giao dịch lệch' }]} />
      </Space>
      <Table<PaymentTransaction> rowKey="id" size="small" loading={isLoading} dataSource={data} scroll={{ x: 1200 }}
        columns={[
          { title: 'Mã GD (TxnRef)', dataIndex: 'txnRef', render: (v, t) => <><b>{v}</b><div className="a-muted small">{t.type === 'PAY' ? 'Thanh toán' : 'Hoàn tiền'} · {dateTime(t.createdAt)}</div></> },
          { title: 'Đơn', dataIndex: 'orderCode' },
          { title: 'Số tiền', dataIndex: 'amount', render: money, align: 'right' },
          { title: 'Kênh', render: (_, t) => <>{t.bankCode ?? '—'}<div className="a-muted small">{PAYMENT_METHOD[t.paymentMethod]}</div></> },
          { title: 'Mã GD VNPAY', dataIndex: 'providerTxnNo', render: (v) => v ?? '—' },
          { title: 'Kết quả cổng', render: (_, t) => <><Tag color={TX_STATUS[t.status].color}>{TX_STATUS[t.status].text}</Tag>{t.responseText && <div className="a-muted small">{t.responseCode} · {t.responseText}</div>}</> },
          { title: 'Đơn ghi nhận', render: (_, t) => <Tag color={PAYMENT_STATUS[t.paymentStatus].color}>{PAYMENT_STATUS[t.paymentStatus].text}</Tag> },
          { title: 'IPN', dataIndex: 'ipnCount', align: 'center' },
          {
            title: 'Đối soát', render: (_, t) => (t.mismatch ? <Tooltip title={t.mismatch}><Tag color="red">Lệch</Tag><div className="small a-limit">{t.mismatch}</div></Tooltip>
              : t.reconciled ? <Tooltip title={`${t.reconciledBy} · ${dateTime(t.reconciledAt)}${t.reconcileNote ? ` · ${t.reconcileNote}` : ''}`}><Tag color="green">Đã đối soát</Tag></Tooltip>
                : <Tag>Chưa</Tag>),
          },
          {
            title: '', render: (_, t) => <Space>
              {t.type === 'PAY' && <Button size="small" icon={<ReloadOutlined />} loading={requery.isPending} onClick={() => requery.mutate(t.id)}>Truy vấn</Button>}
              {!t.reconciled && t.status !== 'PENDING' && <Button size="small" onClick={() => setMarking(t)}>Đã đối soát</Button>}
            </Space>,
          },
        ]} />
      <Modal open={!!marking} title={`Đối soát ${marking?.txnRef}`} onCancel={() => setMarking(null)} footer={null} destroyOnHidden>
        <Form layout="vertical" onFinish={(v: { note?: string }) => reconcile.mutate({ id: marking!.id, note: v.note }, { onSuccess: () => setMarking(null) })}>
          <p>{money(marking?.amount)} · {marking && TX_STATUS[marking.status].text}{marking?.mismatch && <> · <b className="a-limit">{marking.mismatch}</b></>}</p>
          <Form.Item name="note" label="Ghi chú đối soát"><Input placeholder="Khớp file đối soát ngày …, đã hoàn tay…" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={reconcile.isPending}>Đánh dấu đã đối soát</Button>
        </Form>
      </Modal>
    </>
  )
}
