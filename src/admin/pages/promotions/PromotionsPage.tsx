import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Dropdown, Form, Input, InputNumber, Modal, Segmented, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, MinusCircleOutlined, MoreOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { promotionsApi, type Promotion, type PromotionStatus } from '@/api/promotions'
import { coreApi } from '@/api/core'
import { date, money } from '@/lib/format'
import { PageHeader } from '../../components/PageHeader'
import { ServiceGate } from '../../components/ServiceGate'
import { useAction } from '../../components/useCrud'
import { MoneyInput } from '../../components/MoneyInput'

export const PROMO_STATUS: Record<PromotionStatus, { t: string; c: string }> = {
  DRAFT: { t: 'Nháp', c: 'default' }, ACTIVE: { t: 'Đang chạy', c: 'green' }, PAUSED: { t: 'Tạm dừng', c: 'gold' }, ENDED: { t: 'Đã kết thúc', c: 'red' },
}

export function PromotionsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['promotions'], queryFn: promotionsApi.list, retry: false })
  const { data: coffees = [] } = useQuery({ queryKey: ['coffees'], queryFn: coreApi.coffees })
  const [edit, setEdit] = useState<Partial<Promotion> | null>(null)
  const [form] = Form.useForm()
  const scope = Form.useWatch('applyScope', form)
  const keys = [['promotions'], ['menu']]
  const save = useAction(promotionsApi.save, keys)
  const act = useAction((v: { id: number; op: 'activate' | 'pause' | 'end' | 'clone' }) => promotionsApi[v.op](v.id), keys, 'Đã cập nhật')

  return (
    <>
      <PageHeader title="Đợt giảm giá" subtitle="Giảm cho hóa đơn (% và đơn tối thiểu) hoặc cho cà phê cụ thể (mức giảm riêng, số lượng tối đa)"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ applyScope: 'ORDER' })}>Tạo đợt giảm giá</Button>} />
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        <Table rowKey="id" dataSource={data}
          expandable={{
            rowExpandable: (p) => p.applyScope === 'COFFEE',
            expandedRowRender: (p) => (
              <Table size="small" rowKey="coffeeId" pagination={false} dataSource={p.items}
                columns={[
                  { title: 'Cà phê', dataIndex: 'coffeeName' },
                  { title: 'Giá sau giảm', dataIndex: 'salePrice', render: money },
                  { title: 'Mức giảm riêng', dataIndex: 'customDiscount', render: money },
                  { title: 'Đã bán / tối đa', render: (_, i) => `${i.soldQuantity ?? 0} / ${i.maxQuantity ?? '∞'}` },
                ]} />
            ),
          }}
          columns={[
            { title: 'Tên chương trình', dataIndex: 'name', render: (v, p) => <><b>{v}</b><div className="a-muted small">{p.description}</div></> },
            { title: 'Áp dụng cho', render: (_, p) => <Tag color={p.applyScope === 'ORDER' ? 'blue' : 'purple'}>{p.applyScope === 'ORDER' ? 'Hóa đơn' : `${p.items.length} cà phê`}</Tag> },
            { title: 'Mức giảm', render: (_, p) => <>{p.discountPercent ? `${p.discountPercent}%` : '—'}{p.minOrderAmount ? <div className="a-muted small">đơn từ {money(p.minOrderAmount)}</div> : null}</> },
            { title: 'Thời gian', render: (_, p) => `${date(p.startDate)} → ${date(p.endDate)}` },
            { title: 'Trạng thái', render: (_, p) => <Tag color={PROMO_STATUS[p.status].c}>{PROMO_STATUS[p.status].t}</Tag> },
            {
              title: '', render: (_, p) => (
                <Space>
                  {p.status !== 'ENDED' && <Button size="small" onClick={() => setEdit(p)}>Sửa</Button>}
                  <Dropdown menu={{
                    items: [
                      ...(p.status === 'DRAFT' || p.status === 'PAUSED' ? [{ key: 'activate', label: 'Kích hoạt' }] : []),
                      ...(p.status === 'ACTIVE' ? [{ key: 'pause', label: 'Tạm dừng' }] : []),
                      ...(p.status !== 'ENDED' ? [{ key: 'end', label: 'Kết thúc', danger: true }] : []),
                      { key: 'clone', label: 'Nhân bản' },
                    ],
                    onClick: (e) => act.mutate({ id: p.id, op: e.key as 'activate' }),
                  }}><Button size="small" icon={<MoreOutlined />} /></Dropdown>
                </Space>
              ),
            },
          ]} />
      </ServiceGate>
      <Modal open={!!edit} title={edit?.id ? 'Sửa đợt giảm giá' : 'Tạo đợt giảm giá'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden width={720}>
        <Form form={form} layout="vertical"
          initialValues={{ ...edit, period: edit?.startDate ? [dayjs(edit.startDate), dayjs(edit.endDate)] : undefined, items: edit?.items ?? [] }}
          onFinish={(v) => save.mutate({
            id: edit?.id, name: v.name, description: v.description, applyScope: v.applyScope, discountPercent: v.discountPercent,
            minOrderAmount: v.minOrderAmount, startDate: v.period[0].format('YYYY-MM-DDTHH:mm:ss'), endDate: v.period[1].format('YYYY-MM-DDTHH:mm:ss'),
            items: v.applyScope === 'COFFEE' ? v.items : [],
          }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên chương trình" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="applyScope" label="Áp dụng cho">
            <Segmented options={[{ value: 'ORDER', label: 'Hóa đơn' }, { value: 'COFFEE', label: 'Cà phê cụ thể' }]} />
          </Form.Item>
          <div className="a-grid-3">
            <Form.Item name="discountPercent" label="% giảm" rules={[{ required: scope === 'ORDER' }]}><InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} /></Form.Item>
            {scope === 'ORDER' && <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>}
            <Form.Item name="period" label="Thời gian áp dụng" rules={[{ required: true }]}><DatePicker.RangePicker showTime format="DD/MM HH:mm" /></Form.Item>
          </div>
          {scope === 'COFFEE' && (
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((f) => (
                    <Space key={f.key} align="baseline" wrap>
                      <Form.Item name={[f.name, 'coffeeId']} rules={[{ required: true }]} style={{ width: 200 }}>
                        <Select showSearch optionFilterProp="label" placeholder="Cà phê" options={coffees.map((c) => ({ value: c.id, label: `${c.name} (${money(c.price)})` }))} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'salePrice']}><MoneyInput placeholder="Giá sau giảm" style={{ width: 150 }} /></Form.Item>
                      <Form.Item name={[f.name, 'customDiscount']}><MoneyInput placeholder="hoặc giảm" style={{ width: 150 }} /></Form.Item>
                      <Form.Item name={[f.name, 'maxQuantity']}><InputNumber min={1} placeholder="SL tối đa" /></Form.Item>
                      <MinusCircleOutlined onClick={() => remove(f.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Thêm cà phê</Button>
                </>
              )}
            </Form.List>
          )}
          <Button type="primary" htmlType="submit" block loading={save.isPending} style={{ marginTop: 16 }}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
