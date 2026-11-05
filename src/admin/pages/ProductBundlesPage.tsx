import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, DatePicker, Empty } from 'antd'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import {
  merchandisingApi,
  type Bundle,
  type BundlePayload,
  type BundleItemPayload,
} from '../../api/merchandising'
import { money } from '@/lib/format'

type BundleForm = { name: string; description?: string; bundlePrice: number; startsAt?: dayjs.Dayjs; endsAt?: dayjs.Dayjs }
type ItemForm = BundleItemPayload
export function ProductBundlesPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['merch-bundles'], queryFn: merchandisingApi.bundles })
  const { data: coffees = [] } = useQuery({ queryKey: ['merch-coffees'], queryFn: coreApi.coffees })
  const [form] = Form.useForm<BundleForm>()
  const [itemForm] = Form.useForm<ItemForm>()
  const [analyticsId,setAnalyticsId] = useState<number | null>(null)
  const report=useQuery({queryKey:['combo-actual-analytics',analyticsId], queryFn:()=>merchandisingApi.bundleAnalytics(analyticsId!),enabled:analyticsId!==null})
  const [editing, setEditing] = useState<Bundle | null>(null)
  const [dialog, setDialog] = useState(false)
  const [itemBundle, setItemBundle] = useState<Bundle | null>(null)
  const [itemEditing, setItemEditing] = useState<number | null>(null)
  const pending = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merch-bundles'] }); qc.invalidateQueries({ queryKey: ['merch-public-bundles'] }); message.success('Đã lưu thay đổi') },
    onError: (e) => message.error(errorMessage(e)),
  })
  const run = (fn: () => Promise<unknown>) => pending.mutate(fn)
  const open = (b?: Bundle) => {
    setEditing(b || null)
    form.setFieldsValue(b ? { name: b.name, description: b.description ?? '', bundlePrice: b.bundlePrice,
      startsAt: b.startsAt ? dayjs(b.startsAt) : undefined, endsAt: b.endsAt ? dayjs(b.endsAt) : undefined }
      : { name: '', description: '', bundlePrice: undefined, startsAt: undefined, endsAt: undefined })
    setDialog(true)
  }
  const submit = async () => {
    const v = await form.validateFields()
    if (v.startsAt && v.endsAt && !v.endsAt.isAfter(v.startsAt)) { message.warning('Ngày kết thúc phải sau ngày bắt đầu'); return }
    const body: BundlePayload = { name: v.name.trim(), description: v.description?.trim(), bundlePrice: v.bundlePrice,
      startsAt: v.startsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
      endsAt: v.endsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null, status: editing?.status ?? 'DRAFT' }
    try {
      if (editing) await merchandisingApi.updateBundle(editing.id, body)
      else await merchandisingApi.createBundle(body)
      setDialog(false); message.success('Đã lưu combo'); qc.invalidateQueries({ queryKey: ['merch-bundles'] }); qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
    } catch (e) { message.error(errorMessage(e)) }
  }
  const saveItem = async () => {
    if (!itemBundle) return
    const v = await itemForm.validateFields()
    try {
      if (itemEditing) await merchandisingApi.updateBundleItem(itemBundle.id, itemEditing, v)
      else await merchandisingApi.addBundleItem(itemBundle.id, v)
      message.success('Đã lưu thành phần'); setItemEditing(null); itemForm.resetFields()
      const updated = await merchandisingApi.bundles()
      setItemBundle(updated.find((b) => b.id === itemBundle.id) ?? null)
      qc.setQueryData(['merch-bundles'], updated); void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
    } catch (e) { message.error(errorMessage(e)) }
  }
  return <div>
    <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div><Typography.Title level={3} style={{ margin: 0 }}>Combo sản phẩm</Typography.Title><Typography.Text type="secondary">Quản lý combo, thành phần và lịch bán</Typography.Text></div>
      <Button type="primary" onClick={() => open()}>+ Tạo combo</Button>
    </Space>
    {isError && <Card><Button onClick={() => refetch()}>Không tải được combo — Thử lại</Button></Card>}
    <Card><Table rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 950 }} pagination={{ pageSize: 10 }} columns={[
      { title: 'Tên combo', dataIndex: 'name', render: (v: string, b: Bundle) => <><strong>{v}</strong><br /><Typography.Text type="secondary">{b.items.length} món</Typography.Text></> },
      { title: 'Giá combo', dataIndex: 'bundlePrice', render: (v: number) => money(v) },
      { title: 'Tiết kiệm', dataIndex: 'savingAmount', render: (v: number) => money(v) },
      { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : v === 'PAUSED' ? 'orange' : 'default'}>{v}</Tag> },
      { title: 'Thao tác', width: 350, render: (_: unknown, b: Bundle) => <Space wrap>
        <Button size="small" onClick={() => setAnalyticsId(b.id)}>Doanh số</Button>
        <Button size="small" onClick={() => open(b)} disabled={b.status === 'ACTIVE'}>Sửa</Button>
        <Button size="small" onClick={() => { setItemBundle(b); setItemEditing(null); itemForm.resetFields() }} disabled={b.status === 'ACTIVE'}>Thành phần</Button>
        {b.status !== 'ACTIVE' ? <Button size="small" type="primary" loading={pending.isPending} onClick={() => run(() => merchandisingApi.activateBundle(b.id))}>Kích hoạt</Button>
          : <Button size="small" loading={pending.isPending} onClick={() => run(() => merchandisingApi.pauseBundle(b.id))}>Tạm dừng</Button>}
        <Popconfirm title="Xóa combo này?" onConfirm={() => run(() => merchandisingApi.deleteBundle(b.id))}><Button size="small" danger>Xóa</Button></Popconfirm>
      </Space> },
    ]} /></Card>
    <Modal title="Doanh thu combo thực tế (đơn hoàn tất)" open={analyticsId!==null} onCancel={()=>setAnalyticsId(null)} footer={null}>
      {report.isLoading ? <Typography.Text>Đang tải…</Typography.Text> : report.isError ? <Typography.Text type="danger">Không tải được báo cáo. Kiểm tra bảng order_bundle_sales và order_bundle_components.</Typography.Text> : report.data && <Space direction="vertical" style={{width:'100%'}}>
        <Typography.Text strong>{report.data.bundleName}</Typography.Text>
        <Typography.Text>Số combo thực bán: <b>{report.data.estimatedSoldQuantity}</b></Typography.Text>
        <Typography.Text>Doanh thu gộp combo (trước voucher/khuyến mãi toàn đơn): <b>{money(report.data.estimatedRevenue)}</b></Typography.Text>
        <Typography.Text>Ưu đãi giá combo: <b>{money(report.data.estimatedSavingGiven)}</b></Typography.Text>
        <Table size="small" rowKey="coffeeId" pagination={false} dataSource={report.data.components} columns={[{title:'Thành phần',dataIndex:'coffeeName'},{title:'SL bán',dataIndex:'soldQuantity'},{title:'Doanh thu phân bổ',dataIndex:'revenue',render:(v:number)=>money(v)}]} />
      </Space>}
    </Modal>
    <Modal title={editing ? 'Sửa combo' : 'Tạo combo'} open={dialog} onCancel={() => setDialog(false)} onOk={() => void submit()} okText="Lưu" destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên combo" rules={[{ required: true, whitespace: true, message: 'Nhập tên combo' }, { max: 150 }]}><Input maxLength={150} /></Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ max: 10000 }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="bundlePrice" label="Giá combo (đ)" rules={[{ required: true, message: 'Nhập giá' }, { type: 'number', min: 0.01 }]}><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="startsAt" label="Bắt đầu"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
        <Form.Item name="endsAt" label="Kết thúc"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
      </Form>
    </Modal>
    <Modal title={`Thành phần — ${itemBundle?.name ?? ''}`} open={!!itemBundle} onCancel={() => setItemBundle(null)} footer={null} width={750}>
      {itemBundle?.items.length ? <Table rowKey="id" size="small" pagination={false} dataSource={itemBundle.items} columns={[
        { title: 'Sản phẩm', render: (_: unknown, i) => i.coffee.name }, { title: 'SL', dataIndex: 'quantity' },
        { title: 'Tùy chọn', dataIndex: 'optional', render: (v: boolean) => v ? 'Có' : 'Không' },
        { title: '', render: (_: unknown, i) => <Space><Button size="small" onClick={() => { setItemEditing(i.id); itemForm.setFieldsValue({ coffeeId: i.coffee.id, quantity: i.quantity, optional: i.optional, displayOrder: i.displayOrder }) }}>Sửa</Button>
          <Popconfirm title="Xóa món này?" onConfirm={async () => { try { await merchandisingApi.deleteBundleItem(itemBundle.id, i.id); const updated = await merchandisingApi.bundles(); setItemBundle(updated.find((b) => b.id === itemBundle.id) ?? null); qc.setQueryData(['merch-bundles'], updated); void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] }); message.success('Đã xóa món') } catch (e) { message.error(errorMessage(e)) } }}><Button size="small" danger>Xóa</Button></Popconfirm></Space> },
      ]} /> : <Empty description="Chưa có món trong combo" />}
      <Form layout="inline" form={itemForm} initialValues={{ quantity: 1, optional: false, displayOrder: 0 }} style={{ marginTop: 20, gap: 8 }}>
        <Form.Item name="coffeeId" rules={[{ required: true, message: 'Chọn món' }]}><Select showSearch optionFilterProp="label" placeholder="Chọn món" style={{ width: 210 }} options={coffees.map((c) => ({ label: c.name, value: c.id }))} /></Form.Item>
        <Form.Item name="quantity" rules={[{ required: true, type: 'number', min: 1 }]}><InputNumber min={1} precision={0} placeholder="SL" /></Form.Item>
        <Form.Item name="optional" initialValue={false}><Select style={{ width: 120 }} options={[{ value: false, label: 'Bắt buộc' }, { value: true, label: 'Tùy chọn' }]} /></Form.Item>
        <Button type="primary" onClick={() => void saveItem()}>{itemEditing ? 'Lưu món' : 'Thêm món'}</Button>
        {itemEditing && <Button onClick={() => { setItemEditing(null); itemForm.resetFields() }}>Hủy sửa</Button>}
      </Form>
    </Modal>
  </div>
}
