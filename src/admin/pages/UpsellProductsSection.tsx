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
const money = (value: number) => Number(value || 0).toLocaleString('vi-VN') + 'đ'

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
    .map(c => ({ value: c.id, label: c.name + ' (' + money(c.price) + ')' }))

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
        message.error('Món gốc phải đang bán, còn hàng; món được đề xuất cần đang bán, còn hàng và có công thức đang áp dụng')
        return
      }
      if (base.id === suggestion.id) {
        message.error('Món được đề xuất phải khác món khách đang chọn')
        return
      }
      const duplicate = (list.data || []).find(rule => rule.id !== edit?.id
        && rule.anchorCoffeeId === base.id
        && rule.upgradeCoffeeId === suggestion.id
        && rule.upgradeType === type)
      if (duplicate) {
        message.error('Cặp món này đã có quy tắc đề xuất. Hãy sửa quy tắc hiện có hoặc chọn món khác.')
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
      message.success(edit ? 'Đã cập nhật gợi ý món' : 'Đã lưu nháp. Hãy kích hoạt để hiển thị cho khách.')
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
    { title: 'Món gốc', dataIndex: 'anchorName', key: 'anchor' },
    { title: 'Món được đề xuất', dataIndex: 'upgradeName', key: 'upgrade' },
    { title: 'Chênh lệch giá', key: 'difference', render: (_: unknown, r: UpsellRule) => {
      const difference = Number(r.upgradePrice) - Number(r.basePrice)
      return difference > 0 ? `Tăng ${money(difference)}` : difference < 0 ? `Giảm ${money(Math.abs(difference))}` : 'Không đổi'
    } },
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
          title: 'Xóa gợi ý món này?',
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
      title="Đề xuất món phù hợp cho khách"
      extra={<Button type="primary" onClick={() => start(null)}>+ Tạo đề xuất</Button>}
    >
      <Typography.Paragraph type="secondary">
        Chọn một món khác phù hợp với gu của món khách đang xem. Món được đề xuất có thể có giá cao hơn, thấp hơn hoặc bằng giá món hiện tại; giá không đại diện cho chất lượng nguyên liệu.
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
      title={edit ? 'Sửa đề xuất món' : 'Tạo đề xuất món'}
      open={open}
      onCancel={() => setOpen(false)}
      onOk={save}
      confirmLoading={saving}
      okText="Lưu nháp"
      destroyOnHidden
      width={620}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên quy tắc">
          <Input maxLength={150} placeholder="Tự tạo theo tên hai món nếu để trống" />
        </Form.Item>
        <Form.Item name="anchorCoffeeId" label="Món khách đang chọn" rules={[{ required: true, message: 'Chọn món gốc' }]}>
          <Select showSearch optionFilterProp="label" options={coffees.map(c => ({ value: c.id, label: c.name + ' (' + money(c.price) + ')' }))} onChange={() => form.setFieldValue('upgradeCoffeeId', undefined)} />
        </Form.Item>
        <Form.Item name="upgradeCoffeeId" label="Món được đề xuất (có công thức)" rules={[{ required: true, message: 'Chọn món được đề xuất có công thức đang áp dụng' }]}>
          <Select showSearch optionFilterProp="label" loading={recipes.isLoading} disabled={recipes.isError} options={targetOptions} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginTop: -16 }}>
          Món gốc cần đang bán và còn hàng; món được đề xuất cần có công thức đang áp dụng.
        </Typography.Paragraph>
        <Form.Item name="priority" label="Ưu tiên" rules={[{ required: true }]}>
          <InputNumber min={0} max={10000} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">Quy tắc được lưu ở trạng thái nháp. Sau khi lưu, bấm Kích hoạt để khách nhìn thấy gợi ý.</Typography.Text>
    </Modal>
  </>
}
