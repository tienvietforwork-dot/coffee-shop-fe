import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, DatePicker, Form, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import { crossSellApi, type CrossSellPayload, type CrossSellRule } from '@/api/crossSell'
import type { CategoryProductType, Coffee } from '@/api/types'
import { errorMessage } from '@/api/client'

const { Title, Text } = Typography
const typeLabel: Record<CategoryProductType, string> = {
  DRINK: 'Đồ uống',
  FOOD: 'Đồ ăn / bánh',
  ADD_ON: 'Món thêm',
}
const sellable = (coffee: Coffee) => coffee.status === 'AVAILABLE' && !coffee.autoSoldOut
const isAddOn = (coffee: Coffee) => coffee.categoryType === 'FOOD' || coffee.categoryType === 'ADD_ON'

export function CrossSellPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm<CrossSellPayload & { related: number[]; start?: dayjs.Dayjs; end?: dayjs.Dayjs }>()
  const [edit, setEdit] = useState<CrossSellRule | null>(null)
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string[] | null>(null)
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const list = useQuery({ queryKey: ['cross-sell-rules'], queryFn: crossSellApi.rules })
  const products = useQuery({ queryKey: ['cross-sell-products'], queryFn: coreApi.coffees })
  const catalog = products.data ?? []
  const currentRelatedIds = useMemo(() => new Set(edit?.items.map((item) => item.coffeeId) ?? []), [edit])
  const currentAnchorId = edit?.anchor_coffee_id
  const anchorOptions = catalog
    .filter((coffee) => sellable(coffee) || coffee.id === currentAnchorId)
    .map((coffee) => ({
      value: coffee.id,
      disabled: !sellable(coffee),
      label: `${coffee.name} · ${coffee.categoryName} · ${typeLabel[coffee.categoryType]}`,
    }))
  // Keep legacy drink recommendations visible but disabled while editing so admins can remove them.
  const relatedOptions = catalog
    .filter((coffee) => (isAddOn(coffee) && sellable(coffee)) || currentRelatedIds.has(coffee.id))
    .map((coffee) => ({
      value: coffee.id,
      disabled: !isAddOn(coffee) || !sellable(coffee),
      label: `${coffee.name} · ${coffee.categoryName} · ${typeLabel[coffee.categoryType]}${!sellable(coffee) ? ' · Tạm hết/ẩn' : ''}`,
    }))

  function start(rule: CrossSellRule | null) {
    setEdit(rule)
    form.resetFields()
    form.setFieldsValue(rule ? {
      anchorCoffeeId: rule.anchor_coffee_id,
      priority: rule.priority,
      minCartAmount: rule.min_cart_amount,
      related: rule.items.map((item) => item.coffeeId),
      start: rule.starts_at ? dayjs(rule.starts_at) : undefined,
      end: rule.ends_at ? dayjs(rule.ends_at) : undefined,
    } : {
      anchorCoffeeId: undefined,
      priority: 0,
      minCartAmount: 0,
      related: [],
      start: undefined,
      end: undefined,
    })
    setOpen(true)
  }

  async function save() {
    try {
      const values = await form.validateFields()
      if (values.related.includes(values.anchorCoffeeId)) {
        message.error('Món bán kèm không được trùng món gốc')
        return
      }
      const selected = values.related.map((id) => catalog.find((coffee) => coffee.id === id))
      if (selected.some((coffee) => !coffee || !isAddOn(coffee) || !sellable(coffee))) {
        message.error('Chỉ chọn món bán kèm thuộc danh mục Đồ ăn / bánh hoặc Món thêm và đang bán')
        return
      }
      if (values.start && values.end && !values.end.isAfter(values.start)) {
        form.setFields([{ name: 'end', errors: ['Ngày kết thúc phải sau ngày bắt đầu'] }])
        return
      }
      const payload: CrossSellPayload = {
        anchorCoffeeId: values.anchorCoffeeId,
        priority: values.priority ?? 0,
        minCartAmount: values.minCartAmount ?? 0,
        startsAt: values.start?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        endsAt: values.end?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        items: values.related.map((coffeeId, position) => ({ coffeeId, position })),
      }
      setSaving(true)
      if (edit) await crossSellApi.update(edit.id, payload)
      else await crossSellApi.create(payload)
      setOpen(false)
      message.success('Đã lưu quy tắc bán kèm')
      void qc.invalidateQueries({ queryKey: ['cross-sell-rules'] })
    } catch (error) {
      if ((error as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function action(fn: () => Promise<unknown>) {
    try {
      await fn()
      void qc.invalidateQueries({ queryKey: ['cross-sell-rules'] })
      message.success('Đã cập nhật')
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const columns = [
    { title: 'Món gốc', dataIndex: 'anchor_name', key: 'name' },
    {
      title: 'Món bán kèm', key: 'items', render: (_: unknown, rule: CrossSellRule) => <Space wrap>
        {rule.items.map((item) => <Tag key={item.coffeeId} color={item.categoryType === 'DRINK' ? 'red' : 'green'}>
          {item.coffeeName}{item.categoryType === 'DRINK' ? ' · cần sửa: đồ uống' : ''}
        </Tag>)}
      </Space>,
    },
    { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority' },
    { title: 'Giỏ tối thiểu', dataIndex: 'min_cart_amount', key: 'cart', render: (value: number) => `${Number(value).toLocaleString('vi-VN')}đ` },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={value === 'ACTIVE' ? 'green' : value === 'DRAFT' ? 'default' : 'orange'}>{value}</Tag> },
    { title: 'Tương tác', key: 'track', render: (_: unknown, rule: CrossSellRule) => `${rule.impressions} xem / ${rule.clicks} click` },
    {
      title: 'Thao tác', key: 'actions', render: (_: unknown, rule: CrossSellRule) => <Space wrap>
        <Button size="small" disabled={rule.status === 'ACTIVE'} onClick={() => start(rule)}>Sửa</Button>
        <Button size="small" onClick={() => action(() => rule.status === 'ACTIVE' ? crossSellApi.pause(rule.id) : crossSellApi.activate(rule.id))}>
          {rule.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
        </Button>
        <Button size="small" onClick={async () => {
          try { setPreview((await crossSellApi.preview(rule.id)).map((item) => item.coffeeName)) }
          catch (error) { message.error(errorMessage(error)) }
        }}>Xem trước</Button>
        <Button size="small" onClick={async () => {
          try { setAnalytics(await crossSellApi.analytics(rule.id) as Record<string, unknown>) }
          catch (error) { message.error(errorMessage(error)) }
        }}>Hiệu quả</Button>
        <Button size="small" danger onClick={() => Modal.confirm({ title: 'Xóa quy tắc này?', onOk: () => action(() => crossSellApi.remove(rule.id)) })}>Xóa</Button>
      </Space>,
    },
  ]

  return <div style={{ padding: 24 }}>
    <Row justify="space-between" align="middle">
      <Col><Title level={3} style={{ marginBottom: 0 }}>Cross-sell · Bán kèm</Title><Text type="secondary">Gợi ý món bổ sung như bánh, đồ ăn hoặc món thêm</Text></Col>
      <Col><Button type="primary" onClick={() => start(null)}>+ Tạo quy tắc</Button></Col>
    </Row>
    <Alert style={{ marginTop: 16 }} type="info" showIcon
      message="Cross-sell dành cho món mua thêm, không dùng để đổi sang ly cà phê khác."
      description="Hãy phân loại danh mục ở Thực đơn → Danh mục sản phẩm thành Đồ ăn / bánh hoặc Món thêm. Các món thuộc danh mục Đồ uống sẽ không được đề xuất hoặc kích hoạt trong quy tắc bán kèm." />
    <Card style={{ marginTop: 20 }}>
      <Table<CrossSellRule> rowKey="id" dataSource={list.data ?? []} loading={list.isLoading || products.isLoading} columns={columns} scroll={{ x: 1100 }} pagination={{ pageSize: 8 }} />
    </Card>

    <Modal title={edit ? 'Sửa quy tắc bán kèm' : 'Tạo quy tắc bán kèm'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} okText="Lưu nháp" destroyOnHidden width={650}>
      <Form form={form} layout="vertical">
        <Form.Item name="anchorCoffeeId" label="Món gốc (khách đang xem)" rules={[{ required: true, message: 'Chọn món gốc' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Chọn món gốc" options={anchorOptions} loading={products.isLoading} />
        </Form.Item>
        <Form.Item name="related" label="Món mua thêm (bánh, đồ ăn, món thêm)" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một món mua thêm' }]}>
          <Select mode="multiple" showSearch optionFilterProp="label" maxTagCount="responsive" placeholder="Chọn sản phẩm thuộc danh mục Đồ ăn hoặc Món thêm" options={relatedOptions} loading={products.isLoading} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="priority" label="Ưu tiên quy tắc" rules={[{ required: true }]}><InputNumber min={0} max={10000} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="minCartAmount" label="Giá trị giỏ tối thiểu (đ)" rules={[{ required: true, type: 'number', min: 0 }]}><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="start" label="Bắt đầu"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="end" label="Kết thúc"><DatePicker showTime style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
      </Form>
      <Text type="secondary">Sau khi lưu nháp, bấm Kích hoạt. Hệ thống kiểm tra lại loại danh mục và tình trạng bán trước khi áp dụng.</Text>
    </Modal>

    <Modal title="Xem trước món bán kèm" open={!!preview} onCancel={() => setPreview(null)} footer={null}>
      <p>Khách xem món gốc sẽ thấy các món bổ sung sau khi quy tắc được kích hoạt:</p>
      {preview?.map((name, index) => <p key={`${name}-${index}`}>{index + 1}. {name}</p>)}
    </Modal>
    <Modal title="Hiệu quả quy tắc" open={!!analytics} onCancel={() => setAnalytics(null)} footer={null}>
      {analytics && <>
        <Row gutter={16}><Col span={12}><Statistic title="Lượt hiển thị" value={Number(analytics.impressions ?? 0)} /></Col><Col span={12}><Statistic title="Lượt click" value={Number(analytics.clicks ?? 0)} /></Col></Row>
        <p>CTR: {(Number(analytics.clickThroughRate ?? 0) * 100).toFixed(1)}%</p>
        <Text type="secondary">{String(analytics.note ?? '')}</Text>
      </>}
    </Modal>
  </div>
}
