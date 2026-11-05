import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { upsellApi, type UpsellPayload, type UpsellRule, type UpsellType } from '@/api/upsell'
import { merchandisingApi } from '@/api/merchandising'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'

type ProductUpsellForm = {
  name?: string
  anchorCoffeeId?: number
  upgradeCoffeeId?: number
  priority?: number
  minCartAmount?: number
  experienceNote?: string
  experienceConfirmed?: boolean
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
  const allCoffees = menu.data?.coffees || []
  const isSellable = (coffee: typeof allCoffees[number]) => coffee.status === 'AVAILABLE' && !coffee.autoSoldOut
  const coffees = allCoffees.filter(isSellable)
  const activeRecipeCoffeeIds = new Set((recipes.data || []).map(recipe => recipe.coffeeId))
  const anchorId = Form.useWatch('anchorCoffeeId', form)
  const anchor = coffees.find(c => c.id === anchorId)
  const targetOptions = coffees
    .filter(c => c.id !== anchorId && activeRecipeCoffeeIds.has(c.id) && (!anchor || Number(c.price) > Number(anchor.price)))
    .map(c => ({ value: c.id, label: c.name + ' (' + money(c.price) + ')' }))

  function start(rule: UpsellRule | null) {
    setEdit(rule)
    form.resetFields()
    form.setFieldsValue(rule ? {
      name: rule.name,
      anchorCoffeeId: rule.anchorCoffeeId,
      upgradeCoffeeId: rule.upgradeCoffeeId,
      priority: rule.priority,
      minCartAmount: Number(rule.minCartAmount),
      experienceNote: rule.experienceNote || '',
      experienceConfirmed: false,
    } : {
      priority: 100,
      minCartAmount: 0,
      experienceConfirmed: false,
    })
    setOpen(true)
  }

  async function save() {
    try {
      const values = await form.validateFields()
      const base = coffees.find(c => c.id === values.anchorCoffeeId)
      const upgrade = coffees.find(c => c.id === values.upgradeCoffeeId)
      if (!base || !upgrade || !isSellable(base) || !isSellable(upgrade) || !activeRecipeCoffeeIds.has(upgrade.id)) {
        message.error('Món gốc và món nâng cấp phải đang bán, còn hàng; món nâng cấp cần có công thức đang áp dụng')
        return
      }
      if (base.id === upgrade.id || Number(upgrade.price) <= Number(base.price)) {
        message.error('Món nâng cấp phải là món khác và có giá cao hơn')
        return
      }
      if (values.experienceConfirmed !== true) {
        message.error('Hãy xác nhận hai món có cùng gu trải nghiệm')
        return
      }
      setSaving(true)
      await upsellApi.registerVariant({
        baseCoffeeId: base.id,
        variantCoffeeId: upgrade.id,
        upgradeType: type,
        recipeConfirmed: true,
        experienceConfirmed: true,
        experienceNote: (values.experienceNote || '').trim(),
      })
      const payload: UpsellPayload = {
        name: (values.name || '').trim() || ('Nâng cấp ' + base.name + ' → ' + upgrade.name),
        anchorCoffeeId: base.id,
        upgradeCoffeeId: upgrade.id,
        upgradeType: type,
        priority: values.priority ?? 100,
        minCartAmount: values.minCartAmount ?? 0,
        startsAt: null,
        endsAt: null,
      }
      if (edit) await upsellApi.update(edit.id, payload)
      else await upsellApi.create(payload)
      setOpen(false)
      message.success(edit ? 'Đã cập nhật quy tắc nâng cấp' : 'Đã lưu nháp. Hãy kích hoạt để hiển thị cho khách.')
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
    { title: 'Món nâng cấp', dataIndex: 'upgradeName', key: 'upgrade' },
    { title: 'Chênh lệch', key: 'difference', render: (_: unknown, r: UpsellRule) => '+' + money(Number(r.upgradePrice) - Number(r.basePrice)) },
    { title: 'Vì sao cùng gu', dataIndex: 'experienceNote', key: 'experience', render: (v?: string | null) => v || 'Cần bổ sung ghi chú' },
    { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : v === 'DRAFT' ? 'default' : 'orange'}>{v}</Tag> },
    {
      title: 'Thao tác', key: 'actions', render: (_: unknown, r: UpsellRule) => <Space wrap>
        <Button size="small" disabled={r.status === 'ACTIVE'} onClick={() => start(r)}>Sửa</Button>
        <Button size="small" onClick={() => action(() => r.status === 'ACTIVE' ? upsellApi.pause(r.id) : upsellApi.activate(r.id))}>
          {r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt'}
        </Button>
        <Button size="small" danger disabled={r.status === 'ACTIVE'} onClick={() => Modal.confirm({
          title: 'Xóa quy tắc nâng cấp này?',
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
      title="Gợi ý nâng cấp sang một món cà phê khác"
      extra={<Button type="primary" onClick={() => start(null)}>+ Tạo gợi ý</Button>}
    >
      <Typography.Paragraph type="secondary">
        Chọn món khác có giá cao hơn và cùng trải nghiệm vị. Ví dụ: Americano → Cold Brew truyền thống giữ gu cà phê đen không sữa, nhưng đổi sang cách ủ lạnh và hậu vị chocolate.
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
      title={edit ? 'Sửa gợi ý nâng cấp' : 'Tạo gợi ý nâng cấp'}
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
        <Form.Item name="upgradeCoffeeId" label="Món nâng cấp (giá cao hơn, có công thức)" rules={[{ required: true, message: 'Chọn món nâng cấp có công thức đang áp dụng' }]}>
          <Select showSearch optionFilterProp="label" loading={recipes.isLoading} disabled={recipes.isError} options={targetOptions} />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginTop: -16 }}>
          Chỉ hiển thị món đang bán và còn hàng. Món nâng cấp cần có công thức đang áp dụng và giá cao hơn món gốc.
        </Typography.Paragraph>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="priority" label="Ưu tiên" rules={[{ required: true }]}><InputNumber min={0} max={10000} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="minCartAmount" label="Giỏ tối thiểu (đ)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item
          name="experienceNote"
          label="Điểm chung về trải nghiệm vị"
          rules={[
            { required: true, message: 'Mô tả lý do hai món hợp cùng một gu' },
            { min: 12, max: 500, message: 'Nhập từ 12 đến 500 ký tự' },
          ]}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Ví dụ: Cùng gu cà phê đen, không sữa; cold brew ủ lạnh cho hậu vị chocolate và cảm giác êm dịu."
          />
        </Form.Item>
        <Form.Item
          name="experienceConfirmed"
          valuePropName="checked"
          rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Cần xác nhận cặp món phù hợp')) }]}
        >
          <Checkbox>Xác nhận món nâng cấp là SKU khác, có công thức riêng, giá cao hơn và cùng gu trải nghiệm với món gốc.</Checkbox>
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">Quy tắc được lưu ở trạng thái nháp. Sau khi lưu, bấm Kích hoạt để khách nhìn thấy gợi ý.</Typography.Text>
    </Modal>
  </>
}
