import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App, Avatar, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag,
  Typography, DatePicker, Empty, Alert,
} from 'antd'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import {
  merchandisingApi,
  type Bundle,
  type BundlePayload,
  type BundleItemPayload,
} from '@/api/merchandising'
import { ImageUpload, type ImageValue } from '../components/ImageUpload'
import { imageSrc, money } from '@/lib/format'

type BundleForm = {
  name?: string
  description?: string
  image?: ImageValue
  bundlePrice?: number
  startsAt?: dayjs.Dayjs
  endsAt?: dayjs.Dayjs
  items: { coffeeId?: number; quantity?: number }[]
}

const isSellable = (coffee: { status: string; autoSoldOut?: boolean }) =>
  coffee.status === 'AVAILABLE' && !coffee.autoSoldOut

const discountPercent = (saving: number, original: number) =>
  original > 0 ? Math.round((Math.max(0, saving) / original) * 100) : 0
const MAX_BUNDLE_COMPONENTS = 5

export function ProductBundlesPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['merch-bundles'], queryFn: merchandisingApi.bundles,
  })
  const { data: coffees = [], isLoading: coffeesLoading, isError: coffeesError } = useQuery({
    queryKey: ['merch-coffees'], queryFn: coreApi.coffees,
  })
  const drinkCoffees = coffees.filter((coffee) => coffee.categoryType === 'DRINK')
  const coffeeById = useMemo(() => new Map(coffees.map((coffee) => [coffee.id, coffee])), [coffees])
  const [form] = Form.useForm<BundleForm>()
  const watchedItems = Form.useWatch('items', form) ?? []
  const watchedBundlePrice = Form.useWatch('bundlePrice', form) ?? 0
  const [analyticsId, setAnalyticsId] = useState<number | null>(null)
  const report = useQuery({
    queryKey: ['combo-actual-analytics', analyticsId],
    queryFn: () => merchandisingApi.bundleAnalytics(analyticsId!),
    enabled: analyticsId !== null,
  })
  const [editing, setEditing] = useState<Bundle | null>(null)
  const [dialog, setDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [priceNeedsReentry, setPriceNeedsReentry] = useState(false)

  const standalonePrice = watchedItems.reduce((total, item) => {
    const coffee = coffeeById.get(Number(item.coffeeId))
    const quantity = Number(item.quantity) || 0
    return total + (coffee ? Number(coffee.price) * quantity : 0)
  }, 0)
  const savingAmount = Math.max(0, standalonePrice - Number(watchedBundlePrice || 0))
  const savingPercent = discountPercent(savingAmount, standalonePrice)
  const priceOverLimit = standalonePrice > 0 && Number(watchedBundlePrice) > standalonePrice

  const pending = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merch-bundles'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
      message.success('Đã cập nhật combo')
    },
    onError: (e) => message.error(errorMessage(e)),
  })
  const run = (fn: () => Promise<unknown>) => pending.mutate(fn)

  const open = (bundle?: Bundle) => {
    setEditing(bundle ?? null)
    setPriceNeedsReentry(false)
    const items: { coffeeId?: number; quantity: number }[] = bundle?.items.map((item) => ({ coffeeId: item.coffee.id, quantity: item.quantity })) ?? []
    while (items.length < 2) items.push({ quantity: 1 })

    form.resetFields()
    form.setFieldsValue(bundle ? {
      name: bundle.name,
      description: bundle.description ?? '',
      image: bundle.imageUrl ? { id: bundle.imageId ?? undefined, url: bundle.imageUrl } : undefined,
      bundlePrice: bundle.bundlePrice,
      startsAt: bundle.startsAt ? dayjs(bundle.startsAt) : undefined,
      endsAt: bundle.endsAt ? dayjs(bundle.endsAt) : undefined,
      items,
    } : {
      name: '', description: '', image: undefined, bundlePrice: undefined,
      startsAt: undefined, endsAt: undefined, items,
    })
    setDialog(true)
  }

  const submit = async () => {
    try {
      const value = await form.validateFields()
      const items = value.items ?? []
      if (items.length < 2 || items.length > MAX_BUNDLE_COMPONENTS) {
        message.error(`Combo cần từ 2 đến ${MAX_BUNDLE_COMPONENTS} loại cà phê khác nhau`)
        return
      }
      const duplicateIndex = items.findIndex((item, index) =>
        item.coffeeId != null && items.some((other, otherIndex) => otherIndex !== index && other.coffeeId === item.coffeeId))
      if (duplicateIndex >= 0) {
        form.setFields([{ name: ['items', duplicateIndex, 'coffeeId'], errors: ['Mỗi loại cà phê chỉ thêm một lần; hãy tăng số lượng nếu cần'] }])
        return
      }
      const selected = items.map((item) => ({
        coffee: item.coffeeId == null ? undefined : coffeeById.get(Number(item.coffeeId)),
        quantity: Number(item.quantity),
      }))
      const invalidIndex = selected.findIndex((item) => !item.coffee || item.coffee.categoryType !== 'DRINK' || !item.coffee.hasRecipe)
      if (invalidIndex >= 0) {
        form.setFields([{ name: ['items', invalidIndex, 'coffeeId'], errors: ['Chọn cà phê/đồ uống có công thức đang áp dụng'] }])
        return
      }
      const calculatedStandalone = selected.reduce((total, item) =>
        total + Number(item.coffee!.price) * item.quantity, 0)
      if (Number(value.bundlePrice) > calculatedStandalone) {
        form.setFields([{
          name: 'bundlePrice',
          errors: [`Giá combo không được vượt tổng giá lẻ ${money(calculatedStandalone)}`],
        }])
        return
      }
      if (value.startsAt && value.endsAt && !value.endsAt.isAfter(value.startsAt)) {
        form.setFields([{ name: 'endsAt', errors: ['Ngày kết thúc phải sau ngày bắt đầu'] }])
        return
      }

      const body: BundlePayload = {
        name: (value.name ?? '').trim(),
        description: value.description?.trim() || undefined,
        imageId: value.image?.id,
        imageUrl: value.image?.id ? undefined : value.image?.url?.trim() || undefined,
        bundlePrice: Number(value.bundlePrice),
        startsAt: value.startsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        endsAt: value.endsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        status: editing?.status ?? 'DRAFT',
        items: items.map((item, index): BundleItemPayload => ({
          coffeeId: Number(item.coffeeId),
          quantity: Number(item.quantity),
          optional: false,
          displayOrder: index,
        })),
      }
      setSaving(true)
      if (editing) await merchandisingApi.updateBundle(editing.id, body)
      else await merchandisingApi.createBundle(body)
      setDialog(false)
      message.success(editing ? 'Đã cập nhật combo' : `Đã tạo combo với ${items.length} loại cà phê`)
      void qc.invalidateQueries({ queryKey: ['merch-bundles'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const coffeeOptions = [
    ...((editing?.items ?? [])
      .filter((item) => item.coffee.categoryType !== 'DRINK')
      .map((item) => ({
        label: `${item.coffee.name} · Không phải đồ uống, hãy thay món này`,
        value: item.coffee.id,
        disabled: true,
      }))),
    ...drinkCoffees.map((coffee) => ({
      label: `${coffee.name} · ${money(coffee.price)}${coffee.hasRecipe ? '' : ' · Chưa có công thức'}${isSellable(coffee) ? '' : ' · Hết hàng/ẩn'}`,
      value: coffee.id,
      disabled: !isSellable(coffee) || !coffee.hasRecipe,
    })),
  ]

  return <div>
    <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>Combo sản phẩm</Typography.Title>
        <Typography.Text type="secondary">Kết hợp từ 2 đến {MAX_BUNDLE_COMPONENTS} loại cà phê có công thức, thiết lập số lượng và giá combo</Typography.Text>
      </div>
      <Button type="primary" onClick={() => open()}>+ Tạo combo</Button>
    </Space>

    {isError && <Card><Button onClick={() => void refetch()}>Không tải được combo — Thử lại</Button></Card>}

    <Card>
      <Table rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 1280 }} pagination={{ pageSize: 10 }} columns={[
        {
          title: 'Combo', dataIndex: 'name', render: (name: string, bundle: Bundle) => <Space>
            <Avatar shape="square" size={48} src={imageSrc(bundle.imageUrl)}>🎁</Avatar>
            <span><strong>{name}</strong><br /><Typography.Text type="secondary">{bundle.items.length} sản phẩm</Typography.Text></span>
          </Space>,
        },
        { title: 'Giá lẻ trước', dataIndex: 'standalonePrice', render: (value: number) => <Typography.Text delete>{money(value)}</Typography.Text> },
        { title: 'Giá combo sau', dataIndex: 'bundlePrice', render: (value: number) => <Typography.Text strong style={{ color: '#8b4d20' }}>{money(value)}</Typography.Text> },
        {
          title: 'Khách tiết kiệm', render: (_: unknown, bundle: Bundle) => {
            const amount = Math.max(0, Number(bundle.savingAmount))
            return <Space direction="vertical" size={0}>
              <Typography.Text strong style={{ color: amount > 0 ? '#4c8452' : undefined }}>{money(amount)} ({discountPercent(amount, Number(bundle.standalonePrice))}%)</Typography.Text>
              <Typography.Text type="secondary">so với mua lẻ</Typography.Text>
            </Space>
          },
        },
        {
          title: 'Lịch bán', render: (_: unknown, bundle: Bundle) => <Typography.Text type="secondary">
            {bundle.startsAt ? dayjs(bundle.startsAt).format('DD/MM/YYYY HH:mm') : 'Từ bây giờ'}
            {' – '}{bundle.endsAt ? dayjs(bundle.endsAt).format('DD/MM/YYYY HH:mm') : 'Không giới hạn'}
          </Typography.Text>,
        },
        { title: 'Trạng thái', dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : status === 'PAUSED' ? 'orange' : 'default'}>{status}</Tag> },
        {
          title: 'Thao tác', width: 330, render: (_: unknown, bundle: Bundle) => <Space wrap>
            <Button size="small" onClick={() => setAnalyticsId(bundle.id)}>Doanh số</Button>
            <Button size="small" onClick={() => open(bundle)} disabled={bundle.status === 'ACTIVE'}>Sửa combo & thành phần</Button>
            {bundle.status !== 'ACTIVE'
              ? <Button size="small" type="primary" loading={pending.isPending} onClick={() => run(() => merchandisingApi.activateBundle(bundle.id))}>Kích hoạt</Button>
              : <Button size="small" loading={pending.isPending} onClick={() => run(() => merchandisingApi.pauseBundle(bundle.id))}>Tạm dừng</Button>}
            <Popconfirm title="Xóa combo này? Dữ liệu đơn cũ vẫn được giữ." onConfirm={() => run(() => merchandisingApi.deleteBundle(bundle.id))}>
              <Button size="small" danger>Xóa</Button>
            </Popconfirm>
          </Space>,
        },
      ]} />
    </Card>

    <Modal title="Doanh số combo trong các đơn hoàn tất" open={analyticsId !== null} onCancel={() => setAnalyticsId(null)} footer={null} width={760}>
      {report.isLoading ? <Typography.Text>Đang tải…</Typography.Text>
        : report.isError ? <Alert type="error" showIcon message="Không tải được báo cáo doanh số combo" />
          : report.data && <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text strong>{report.data.bundleName}</Typography.Text>
            <Typography.Text>Số combo đã bán: <b>{report.data.estimatedSoldQuantity}</b></Typography.Text>
            <Typography.Text>Doanh thu combo: <b>{money(report.data.estimatedRevenue)}</b></Typography.Text>
            <Typography.Text>Giá lẻ trước: <Typography.Text delete>{money(report.data.standalonePrice)}</Typography.Text> · Giá combo sau: <b>{money(report.data.bundlePrice)}</b></Typography.Text>
            <Typography.Text>Ưu đãi giá combo ước tính: <b>{money(report.data.estimatedSavingGiven)}</b></Typography.Text>
            <Table size="small" rowKey="coffeeId" pagination={false} dataSource={report.data.components} columns={[
              { title: 'Cà phê', dataIndex: 'coffeeName' },
              { title: 'Loại', render: (_: unknown, item: { optional: boolean; choiceGroup?: string | null }) => item.optional || item.choiceGroup ? 'Combo cũ cần cập nhật' : 'Đã gồm trong combo' },
              { title: 'SL theo combo', dataIndex: 'requiredQuantity' },
              { title: 'SL đã bán', dataIndex: 'soldQuantity' },
              { title: 'Doanh thu phân bổ', dataIndex: 'revenue', render: (value: number) => money(value) },
            ]} />
          </Space>}
    </Modal>

    <Modal className="bundle-editor-modal" title={editing ? 'Sửa combo và thành phần' : 'Tạo combo'} open={dialog} onCancel={() => setDialog(false)} onOk={() => void submit()} confirmLoading={saving} okText={editing ? 'Lưu combo' : 'Lưu nháp'} destroyOnClose width={820}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, 'items')) {
            form.setFieldValue('bundlePrice', undefined)
            setPriceNeedsReentry(true)
          } else if (changed.bundlePrice != null) {
            setPriceNeedsReentry(false)
          }
        }}
      >
        <Form.Item name="name" label="Tên combo" rules={[{ required: true, whitespace: true, message: 'Nhập tên combo' }, { max: 150, message: 'Tên tối đa 150 ký tự' }]}>
          <Input maxLength={150} showCount />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ max: 10000, message: 'Mô tả tối đa 10.000 ký tự' }]}>
          <Input.TextArea rows={2} maxLength={10000} showCount />
        </Form.Item>
        <Form.Item name="image" label="Ảnh combo" rules={[{ required: true, message: 'Thêm ảnh combo trước khi lưu' }]}>
          <ImageUpload />
        </Form.Item>

        <Alert
          type="info"
          showIcon
          message={`Chọn từ 2 đến ${MAX_BUNDLE_COMPONENTS} cà phê khác nhau cho một combo`}
          description="Mỗi thành phần được liên kết với sản phẩm cà phê và công thức đang áp dụng. Khi khách đặt combo, đơn hàng tạo dòng cho từng cà phê để hệ thống tính nguyên liệu theo công thức. Mỗi loại chỉ chọn một lần; hãy chỉnh số lượng nếu cần nhiều ly cùng loại."
          style={{ marginBottom: 16 }}
        />
        {coffeesError && <Alert type="error" showIcon message="Không tải được danh sách cà phê. Hãy tải lại trang trước khi lưu combo." style={{ marginBottom: 16 }} />}
        <Form.List name="items">
          {(fields, { add, remove }) => <Space direction="vertical" style={{ display: 'flex', width: '100%' }} size={4}>
            {fields.map((field, index) => <Row key={field.key} gutter={12} align="top">
              <Col flex="auto">
                <Form.Item name={[field.name, 'coffeeId']} label={`Cà phê ${index + 1}`} rules={[{ required: true, message: 'Chọn cà phê cho thành phần này' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    loading={coffeesLoading}
                    disabled={coffeesError}
                    placeholder="Chọn cà phê đang bán, có công thức"
                    options={coffeeOptions.map((option) => ({
                      ...option,
                      disabled: option.disabled || (option.value !== watchedItems[field.name]?.coffeeId
                        && watchedItems.some((item, otherIndex) => otherIndex !== field.name && item.coffeeId === option.value)),
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col flex="150px">
                <Form.Item name={[field.name, 'quantity']} label="Số lượng" rules={[{ required: true, type: 'number', min: 1, max: 99, message: 'Nhập số lượng từ 1 đến 99' }]}>
                  <InputNumber min={1} max={99} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              {fields.length > 2 && <Col flex="80px"><Button danger style={{ marginTop: 30 }} onClick={() => remove(field.name)}>Bỏ món</Button></Col>}
            </Row>)}
            {fields.length < MAX_BUNDLE_COMPONENTS
              ? <Button onClick={() => add({ quantity: 1 })}>+ Thêm cà phê</Button>
              : <Typography.Text type="secondary">Đã đạt giới hạn {MAX_BUNDLE_COMPONENTS} loại cà phê cho mỗi combo.</Typography.Text>}
          </Space>}
        </Form.List>

        <Card size="small" style={{ marginBottom: 16, background: '#fffaf5' }}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text strong>Giá bán và mức tiết kiệm</Typography.Text>
            {watchedItems.map((item, index) => {
              const coffee = coffeeById.get(Number(item.coffeeId))
              if (!coffee) return null
              const quantity = Number(item.quantity) || 0
              return <Space key={`${coffee.id}-${index}`}>
                <Avatar shape="square" size={32} src={imageSrc(coffee.imageUrl)}>{index + 1}</Avatar>
                <Typography.Text>{quantity} × {coffee.name} · {money(Number(coffee.price) * quantity)}</Typography.Text>
              </Space>
            })}
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={8}><Typography.Text>Giá lẻ trước: <Typography.Text delete>{money(standalonePrice)}</Typography.Text></Typography.Text></Col>
              <Col xs={24} sm={8}><Typography.Text>Giá combo sau: <Typography.Text strong>{watchedBundlePrice ? money(Number(watchedBundlePrice)) : 'Chưa nhập'}</Typography.Text></Typography.Text></Col>
              <Col xs={24} sm={8}><Typography.Text type={savingAmount > 0 ? 'success' : undefined}>Tiết kiệm: {money(savingAmount)} ({savingPercent}%)</Typography.Text></Col>
            </Row>
            {priceOverLimit && <Typography.Text type="danger">Giá combo không được vượt tổng giá lẻ {money(standalonePrice)}.</Typography.Text>}
            {priceNeedsReentry && <Typography.Text type="warning">Thành phần đã thay đổi; hãy nhập lại giá combo để kiểm tra theo tổng giá lẻ mới.</Typography.Text>}
          </Space>
        </Card>

        <Form.Item name="bundlePrice" label="Giá combo (đ)" rules={[
          { required: true, message: 'Nhập giá bán combo sau ưu đãi' },
          { type: 'number', min: 1, message: 'Giá combo phải lớn hơn 0' },
          { validator: (_, value) => standalonePrice > 0 && Number(value) > standalonePrice
            ? Promise.reject(new Error(`Giá combo không được vượt tổng giá lẻ ${money(standalonePrice)}`))
            : Promise.resolve() },
        ]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="Nhập giá khách sẽ trả" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}><Form.Item name="startsAt" label="Bắt đầu bán"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item></Col>
          <Col span={12}><Form.Item name="endsAt" label="Kết thúc bán"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item></Col>
        </Row>
        <Typography.Text type="secondary">Giá combo phải nhỏ hơn hoặc bằng tổng giá bán lẻ của tất cả thành phần. Thời gian kết thúc phải sau thời gian bắt đầu.</Typography.Text>
      </Form>
    </Modal>
  </div>
}
