import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { upsellApi, type UpsellPayload, type UpsellRule, type UpsellType } from '@/api/upsell'
import { merchandisingApi } from '@/api/merchandising'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'

type ProductUpsellForm = {
  name?: string
  anchorCoffeeId?: number
  upgradeCoffeeId?: number
  priority?: number
}

const type: UpsellType = 'PREMIUM_VERSION'

export function UpsellProductsSection() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<ProductUpsellForm>()
  const [edit, setEdit] = useState<UpsellRule | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const list = useQuery({ queryKey: ['upsell-product-rules'], queryFn: upsellApi.rules })
  const menu = useQuery({ queryKey: ['upsell-menu'], queryFn: merchandisingApi.placementOverview })
  const recipes = useQuery({ queryKey: ['upsell-active-recipes'], queryFn: coreApi.activeRecipes })
  const allCoffees = (menu.data?.coffees || []).filter(coffee => coffee.categoryType === 'DRINK')
  const isSellable = (coffee: typeof allCoffees[number]) => coffee.status === 'AVAILABLE' && !coffee.autoSoldOut
  const coffees = allCoffees.filter(isSellable)
  const activeRecipeCoffeeIds = new Set((recipes.data || []).map(recipe => recipe.coffeeId))
  const anchorId = Form.useWatch('anchorCoffeeId', form)
  const duplicateTargetIds = new Set((list.data || [])
    .filter(rule => rule.anchorCoffeeId === anchorId && rule.id !== edit?.id)
    .map(rule => rule.upgradeCoffeeId))
  const targetOptions = coffees
    .filter(c => c.id !== anchorId && activeRecipeCoffeeIds.has(c.id)
      && ((edit !== null && edit.anchorCoffeeId === anchorId && c.id === edit.upgradeCoffeeId) || !duplicateTargetIds.has(c.id)))
    .map(c => ({ value: c.id, label: c.name }))

  function start(rule: UpsellRule | null) {
    setEdit(rule)
    form.resetFields()
    form.setFieldsValue(rule ? {
      name: rule.name,
      anchorCoffeeId: rule.anchorCoffeeId,
      upgradeCoffeeId: rule.upgradeCoffeeId,
      priority: rule.priority,
    } : {
      priority: 100,
    })
    setOpen(true)
  }

  async function save() {
    try {
      const values = await form.validateFields()
      const base = coffees.find(c => c.id === values.anchorCoffeeId)
      const suggestion = coffees.find(c => c.id === values.upgradeCoffeeId)
      if (!base || !suggestion || !isSellable(base) || !isSellable(suggestion) || !activeRecipeCoffeeIds.has(suggestion.id)) {
        message.error('Sản phẩm đang xem và sản phẩm gợi ý phải đang bán, còn hàng; sản phẩm gợi ý cần có công thức đang áp dụng')
        return
      }
      if (base.id === suggestion.id) {
        message.error('Sản phẩm gợi ý phải khác sản phẩm khách đang xem')
        return
      }
      const duplicate = (list.data || []).find(rule => rule.id !== edit?.id
        && rule.anchorCoffeeId === base.id
        && rule.upgradeCoffeeId === suggestion.id
        && rule.upgradeType === type)
      if (duplicate) {
        message.error('Cặp sản phẩm này đã có quy tắc gợi ý. Hãy sửa quy tắc hiện có hoặc chọn sản phẩm khác.')
        return
      }
      setSaving(true)
      await upsellApi.registerVariant({
        baseCoffeeId: base.id,
        variantCoffeeId: suggestion.id,
        upgradeType: type,
      })
      const payload: UpsellPayload = {
        name: (values.name || '').trim() || ('Gợi ý ' + base.name + ' → ' + suggestion.name),
        anchorCoffeeId: base.id,
        upgradeCoffeeId: suggestion.id,
        upgradeType: type,
        priority: values.priority ?? 100,
        minCartAmount: 0,
        startsAt: null,
        endsAt: null,
      }
      if (edit) await upsellApi.update(edit.id, payload)
      else await upsellApi.create(payload)
      setOpen(false)
      message.success(edit ? 'Đã cập nhật gợi ý sản phẩm' : 'Đã lưu nháp. Bấm Kích hoạt để hiển thị gợi ý cho khách.')
      await qc.invalidateQueries({ queryKey: ['upsell-product-rules'] })
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function action(fn: () => Promise<unknown>) {
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['upsell-product-rules'] })
      message.success('Đã cập nhật quy tắc')
    } catch (e) {
      message.error(errorMessage(e))
    }
  }

  const columns = [
    { title: 'Sản phẩm khách đang xem', dataIndex: 'anchorName', key: 'anchor' },
    { title: 'Sản phẩm gợi ý', dataIndex: 'upgradeName', key: 'upgrade' },
    { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string, r: UpsellRule) => {
      const duplicate = (list.data || []).some(other => other.id !== r.id
        && other.anchorCoffeeId === r.anchorCoffeeId
        && other.upgradeCoffeeId === r.upgradeCoffeeId
        && other.upgradeType === r.upgradeType)
      return <Space><Tag color={v === 'ACTIVE' ? 'green' : v === 'DRAFT' ? 'default' : 'orange'}>{v}</Tag>{duplicate && <Tag color="red">Trùng cặp</Tag>}</Space>
    } },
    {
      title: 'Thao tác', key: 'actions', render: (_: unknown, r: UpsellRule) => <Space wrap>
        <Button size="small" disabled={r.status === 'ACTIVE'} onClick={() => start(r)}>Sửa</Button>
        <Button size="small" onClick={() => action(() => r.status === 'ACTIVE' ? upsellApi.pause(r.id) : upsellApi.activate(r.id))}>
          {r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
        </Button>
        <Button size="small" danger disabled={r.status === 'ACTIVE'} onClick={() => Modal.confirm({
          title: 'Xóa gợi ý sản phẩm này?',
          content: r.anchorName + ' → ' + r.upgradeName,
          okType: 'danger',
          onOk: () => action(() => upsellApi.remove(r.id)),
        })}>Xóa</Button>
      </Space>,
    },
  ]

  return <>
    <Card
      style={{ marginTop: 16 }}
      title="Sản phẩm gợi ý cho khách hàng"
      extra={<Button type="primary" onClick={() => start(null)}>+ Tạo gợi ý</Button>}
    >
      <Typography.Paragraph type="secondary">
        Chọn sản phẩm khách đang xem và sản phẩm sẽ được giới thiệu trong cửa sổ chi tiết. Mỗi cặp sản phẩm chỉ tạo một quy tắc gợi ý.
      </Typography.Paragraph>
      {recipes.isError && <Typography.Paragraph type="danger">Không tải được danh sách công thức đang áp dụng. Hãy thử tải lại trang trước khi tạo quy tắc.</Typography.Paragraph>}
      <Table<UpsellRule>
        rowKey="id"
        loading={list.isLoading || menu.isLoading || recipes.isLoading}
        dataSource={(list.data || []).filter(r => r.upgradeType === 'PREMIUM_VERSION')}
        columns={columns}
        scroll={{ x: 960 }}
        pagination={{ pageSize: 8 }}
      />
    </Card>
    <Modal
      title={edit ? 'Sửa gợi ý sản phẩm' : 'Tạo gợi ý sản phẩm'}
      open={open}
      onCancel={() => setOpen(false)}
      onOk={save}
      confirmLoading={saving}
      okText="Lưu nháp"
      destroyOnHidden
      width={620}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên gợi ý">
          <Input maxLength={150} placeholder="Tự tạo theo tên hai sản phẩm nếu để trống" />
        </Form.Item>
        <Form.Item name="anchorCoffeeId" label="Sản phẩm khách đang xem" rules={[{ required: true, message: 'Chọn sản phẩm khách đang xem' }]}>
          <Select showSearch optionFilterProp="label" options={coffees.map(c => ({ value: c.id, label: c.name }))} onChange={() => form.setFieldValue('upgradeCoffeeId', undefined)} />
        </Form.Item>
        <Form.Item name="upgradeCoffeeId" label="Sản phẩm gợi ý" rules={[{ required: true, message: 'Chọn sản phẩm gợi ý có công thức đang áp dụng' }]}>
          <Select showSearch optionFilterProp="label" loading={recipes.isLoading} disabled={recipes.isError} options={targetOptions} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginTop: -16 }}>
          Sản phẩm đang xem cần đang bán và còn hàng; sản phẩm gợi ý cần có công thức đang áp dụng.
        </Typography.Paragraph>
        <Form.Item name="priority" label="Ưu tiên" rules={[{ required: true }]}>
          <InputNumber min={0} max={10000} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">Quy tắc được lưu ở trạng thái nháp. Sau khi lưu, bấm Kích hoạt để khách nhìn thấy gợi ý.</Typography.Text>
    </Modal>
  </>
}
