import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App, Avatar, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag,
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
  name: string
  description?: string
  image?: ImageValue
  bundlePrice: number
  startsAt?: dayjs.Dayjs
  endsAt?: dayjs.Dayjs
}
type ItemForm = BundleItemPayload

const isSellable = (coffee: { status: string; autoSoldOut?: boolean }) =>
  coffee.status === 'AVAILABLE' && !coffee.autoSoldOut

export function ProductBundlesPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['merch-bundles'], queryFn: merchandisingApi.bundles,
  })
  const { data: coffees = [] } = useQuery({ queryKey: ['merch-coffees'], queryFn: coreApi.coffees })
  const drinkCoffees = coffees.filter((coffee) => coffee.categoryType === 'DRINK')
  const [form] = Form.useForm<BundleForm>()
  const [itemForm] = Form.useForm<ItemForm>()
  const [analyticsId, setAnalyticsId] = useState<number | null>(null)
  const report = useQuery({
    queryKey: ['combo-actual-analytics', analyticsId],
    queryFn: () => merchandisingApi.bundleAnalytics(analyticsId!),
    enabled: analyticsId !== null,
  })
  const [editing, setEditing] = useState<Bundle | null>(null)
  const [dialog, setDialog] = useState(false)
  const [itemBundle, setItemBundle] = useState<Bundle | null>(null)
  const [itemEditing, setItemEditing] = useState<number | null>(null)

  const pending = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['merch-bundles'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
      message.success('Đã lưu thay đổi')
    },
    onError: (e) => message.error(errorMessage(e)),
  })
  const run = (fn: () => Promise<unknown>) => pending.mutate(fn)

  const open = (bundle?: Bundle) => {
    setEditing(bundle ?? null)
    form.setFieldsValue(bundle ? {
      name: bundle.name,
      description: bundle.description ?? '',
      image: bundle.imageUrl ? { id: bundle.imageId ?? undefined, url: bundle.imageUrl } : undefined,
      bundlePrice: bundle.bundlePrice,
      startsAt: bundle.startsAt ? dayjs(bundle.startsAt) : undefined,
      endsAt: bundle.endsAt ? dayjs(bundle.endsAt) : undefined,
    } : {
      name: '', description: '', image: undefined, bundlePrice: undefined,
      startsAt: undefined, endsAt: undefined,
    })
    setDialog(true)
  }

  const submit = async () => {
    try {
      const value = await form.validateFields()
      if (value.startsAt && value.endsAt && !value.endsAt.isAfter(value.startsAt)) {
        form.setFields([{ name: 'endsAt', errors: ['Ngày kết thúc phải sau ngày bắt đầu'] }])
        return
      }
      const body: BundlePayload = {
        name: value.name.trim(),
        description: value.description?.trim() || undefined,
        imageId: value.image?.id,
        imageUrl: value.image?.id ? undefined : value.image?.url?.trim() || undefined,
        bundlePrice: value.bundlePrice,
        startsAt: value.startsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        endsAt: value.endsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null,
        status: editing?.status ?? 'DRAFT',
      }
      if (editing) await merchandisingApi.updateBundle(editing.id, body)
      else await merchandisingApi.createBundle(body)
      setDialog(false)
      message.success('Đã lưu combo')
      void qc.invalidateQueries({ queryKey: ['merch-bundles'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(errorMessage(e))
    }
  }

  const refreshItemBundle = async (bundleId: number) => {
    const updated = await merchandisingApi.bundles()
    const current = updated.find((bundle) => bundle.id === bundleId) ?? null
    setItemBundle(current)
    qc.setQueryData(['merch-bundles'], updated)
    void qc.invalidateQueries({ queryKey: ['merch-public-bundles'] })
  }

  const saveItem = async () => {
    if (!itemBundle) return
    try {
      const value = await itemForm.validateFields()
      if (!itemEditing && itemBundle.items.length >= 2) {
        message.error('Mỗi combo chỉ gồm đúng 2 loại cà phê khác nhau')
        return
      }
      if (itemBundle.items.some((item) => item.coffee.id === value.coffeeId && item.id !== itemEditing)) {
        itemForm.setFields([{ name: 'coffeeId', errors: ['Hãy chọn loại cà phê khác với thành phần còn lại'] }])
        return
      }
      const body = { ...value, optional: false, choiceGroup: undefined }
      if (itemEditing) await merchandisingApi.updateBundleItem(itemBundle.id, itemEditing, body)
      else await merchandisingApi.addBundleItem(itemBundle.id, body)
      message.success('Đã lưu thành phần')
      setItemEditing(null)
      itemForm.resetFields()
      await refreshItemBundle(itemBundle.id)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(errorMessage(e))
    }
  }

  return <div>
    <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>Combo sản phẩm</Typography.Title>
        <Typography.Text type="secondary">Tạo combo gồm hai loại cà phê, thiết lập giá, lịch bán và xem doanh số</Typography.Text>
      </div>
      <Button type="primary" onClick={() => open()}>+ Tạo combo</Button>
    </Space>

    {isError && <Card><Button onClick={() => void refetch()}>Không tải được combo — Thử lại</Button></Card>}

    <Card>
      <Table rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} columns={[
        {
          title: 'Combo', dataIndex: 'name', render: (name: string, bundle: Bundle) => <Space>
            <Avatar shape="square" size={48} src={imageSrc(bundle.imageUrl)}>🎁</Avatar>
            <span><strong>{name}</strong><br /><Typography.Text type="secondary">{bundle.items.length} sản phẩm</Typography.Text></span>
          </Space>,
        },
        { title: 'Giá combo', dataIndex: 'bundlePrice', render: (value: number) => money(value) },
        { title: 'Tiết kiệm', dataIndex: 'savingAmount', render: (value: number) => money(Math.max(0, value)) },
        {
          title: 'Lịch bán', render: (_: unknown, bundle: Bundle) => <Typography.Text type="secondary">
            {bundle.startsAt ? dayjs(bundle.startsAt).format('DD/MM/YYYY HH:mm') : 'Từ bây giờ'}
            {' – '}{bundle.endsAt ? dayjs(bundle.endsAt).format('DD/MM/YYYY HH:mm') : 'Không giới hạn'}
          </Typography.Text>,
        },
        { title: 'Trạng thái', dataIndex: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : status === 'PAUSED' ? 'orange' : 'default'}>{status}</Tag> },
        {
          title: 'Thao tác', width: 380, render: (_: unknown, bundle: Bundle) => <Space wrap>
            <Button size="small" onClick={() => setAnalyticsId(bundle.id)}>Doanh số</Button>
            <Button size="small" onClick={() => open(bundle)} disabled={bundle.status === 'ACTIVE'}>Sửa</Button>
            <Button size="small" onClick={() => { setItemBundle(bundle); setItemEditing(null); itemForm.resetFields() }} disabled={bundle.status === 'ACTIVE'}>Thành phần</Button>
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
            <Typography.Text>Giá lẻ tham chiếu: {money(report.data.standalonePrice)} · Giá combo: {money(report.data.bundlePrice)}</Typography.Text>
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

    <Modal title={editing ? 'Sửa combo' : 'Tạo combo'} open={dialog} onCancel={() => setDialog(false)} onOk={() => void submit()} okText="Lưu nháp" destroyOnClose width={680}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên combo" rules={[{ required: true, whitespace: true, message: 'Nhập tên combo' }, { max: 150, message: 'Tên tối đa 150 ký tự' }]}>
          <Input maxLength={150} showCount />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ max: 10000, message: 'Mô tả tối đa 10.000 ký tự' }]}>
          <Input.TextArea rows={3} maxLength={10000} showCount />
        </Form.Item>
        <Form.Item name="image" label="Ảnh combo" rules={[{ required: true, message: 'Thêm ảnh combo trước khi lưu' }]}>
          <ImageUpload />
        </Form.Item>
        <Form.Item name="bundlePrice" label="Giá combo (đ)" rules={[{ required: true, message: 'Nhập giá combo' }, { type: 'number', min: 1, message: 'Giá combo phải lớn hơn 0' }]}>
          <InputNumber min={1} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Space size="middle" style={{ display: 'flex' }}>
          <Form.Item name="startsAt" label="Bắt đầu bán" style={{ flex: 1 }}>
            <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Form.Item name="endsAt" label="Kết thúc bán" style={{ flex: 1 }}>
            <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
        </Space>
        <Typography.Text type="secondary">Thời gian kết thúc phải sau thời gian bắt đầu. Combo được kích hoạt nhưng chưa đến giờ sẽ chưa hiển thị cho khách.</Typography.Text>
      </Form>
    </Modal>

    <Modal title={`Thành phần — ${itemBundle?.name ?? ''}`} open={!!itemBundle} onCancel={() => setItemBundle(null)} footer={null} width={850} destroyOnClose>
      {itemBundle?.items.length ? <Table rowKey="id" size="small" pagination={false} dataSource={itemBundle.items} columns={[
        { title: 'Cà phê', render: (_: unknown, item) => <><b>{item.coffee.name}</b><div><Typography.Text type="secondary">{money(item.coffee.price)}</Typography.Text></div></> },
        { title: 'Số lượng', dataIndex: 'quantity', width: 90 },
        { title: 'Cách tính', render: (_: unknown, item) => item.optional || item.choiceGroup
          ? <Tag color="orange">Combo cũ · cần sửa</Tag> : <Tag>Bắt buộc · đã gồm giá</Tag> },
        { title: 'Tình trạng', render: (_: unknown, item) => item.coffee.categoryType !== 'DRINK'
          ? <Tag color="red">Không phải đồ uống</Tag>
          : isSellable(item.coffee) ? <Tag color="green">Đang bán</Tag> : <Tag color="red">Không bán</Tag> },
        { title: '', width: 130, render: (_: unknown, item) => <Space>
          <Button size="small" disabled={item.coffee.categoryType !== 'DRINK'} onClick={() => {
            setItemEditing(item.id)
            itemForm.setFieldsValue({ coffeeId: item.coffee.id, quantity: item.quantity, optional: item.optional, choiceGroup: item.choiceGroup ?? '', displayOrder: item.displayOrder })
          }}>Sửa</Button>
          <Popconfirm title="Xóa sản phẩm này khỏi combo?" onConfirm={async () => {
            try {
              await merchandisingApi.deleteBundleItem(itemBundle!.id, item.id)
              await refreshItemBundle(itemBundle!.id)
              message.success('Đã xóa sản phẩm khỏi combo')
            } catch (e) { message.error(errorMessage(e)) }
          }}><Button size="small" danger>Xóa</Button></Popconfirm>
        </Space> },
      ]} /> : <Empty description="Chưa có sản phẩm trong combo" />}

      <Alert style={{ marginTop: 16 }} type="info" showIcon message="Mỗi combo gồm đúng 2 loại cà phê khác nhau"
        description="Thêm 2 món đồ uống bắt buộc; không chọn trùng cùng một loại. Bánh, món ăn, món thêm và lựa chọn thay thế không nằm trong combo. Nếu combo cũ có thành phần thừa, hãy xóa để còn đúng 2 món; nếu thành phần cũ có dấu cần sửa, bấm Sửa để chuyển thành món bắt buộc." />
      <Form layout="vertical" form={itemForm} initialValues={{ quantity: 1, displayOrder: 0 }} style={{ marginTop: 16 }}>
        <Space align="start" wrap style={{ width: '100%' }}>
          <Form.Item name="coffeeId" label="Cà phê / đồ uống" rules={[{ required: true, message: 'Chọn cà phê hoặc đồ uống' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn cà phê đang bán" style={{ width: 300 }} options={drinkCoffees.map((coffee) => ({
              label: `${coffee.name} · ${money(coffee.price)}${isSellable(coffee) ? '' : ' · Tạm hết/ẩn'}`,
              value: coffee.id,
              disabled: !isSellable(coffee),
            }))} />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, type: 'number', min: 1, max: 99, message: 'Số lượng từ 1 đến 99' }]}>
            <InputNumber min={1} max={99} precision={0} />
          </Form.Item>
          <Form.Item label=" ">
            <Space>
              <Button type="primary" disabled={!itemEditing && (itemBundle?.items.length ?? 0) >= 2} onClick={() => void saveItem()}>{itemEditing ? 'Lưu cà phê' : 'Thêm cà phê'}</Button>
              {itemEditing && <Button onClick={() => { setItemEditing(null); itemForm.resetFields() }}>Hủy sửa</Button>}
            </Space>
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  </div>
}
