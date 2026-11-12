import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { errorMessage } from '@/api/client'
import {
  merchandisingApi,
  sectionLabels,
  type Placement,
  type PlacementPayload,
  type PlacementSection,
  type PlacementSuggestion,
  type MerchCoffee,
} from '../../api/merchandising'

type Values = { coffeeId: number; section: PlacementSection; targetCategoryId?: number; title?: string; displayOrder?: number; active: boolean; startsAt?: dayjs.Dayjs; endsAt?: dayjs.Dayjs }
type AdminAction = { run: () => Promise<unknown>; successMessage: string; onSuccess?: () => void }
export function ProductPlacementPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<Values>()
  const selectedSection = Form.useWatch('section', form)
  const [editing, setEditing] = useState<Placement | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [priorityDrafts, setPriorityDrafts] = useState<Record<number, number | null>>({})
  const [suggestionSection, setSuggestionSection] = useState<PlacementSection>('BEST_SELLER')
  const { data: suggestions = [], isFetching: suggestionsLoading } = useQuery({
    queryKey: ['merch-placement-suggestions', suggestionSection],
    queryFn: () => merchandisingApi.placementSuggestions(suggestionSection),
  })
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['merch-placements'], queryFn: merchandisingApi.placements })
  const { data: overview } = useQuery({ queryKey: ['merch-placement-overview'], queryFn: merchandisingApi.placementOverview })
  const coffees = overview?.coffees ?? []
  const editableCoffeeId = editing?.coffee.id
  const coffeeOptions = coffees
    .filter(c => (c.status === 'AVAILABLE' && !c.autoSoldOut) || c.id === editableCoffeeId)
    .map(c => ({
      value: c.id,
      label: c.status === 'AVAILABLE' && !c.autoSoldOut
        ? c.name
        : `${c.name} · ${c.autoSoldOut || c.status === 'SOLD_OUT' ? 'Hết hàng' : c.status === 'HIDDEN' ? 'Đang ẩn' : 'Ngừng bán'}`,
      disabled: !(c.status === 'AVAILABLE' && !c.autoSoldOut),
    }))
  const action = useMutation({
    mutationFn: (task: AdminAction) => task.run(),
    onSuccess: (_result, task) => {
      void qc.invalidateQueries({ queryKey: ['merch-placement-overview'] })
      void qc.invalidateQueries({ queryKey: ['merch-placements'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-placements'] })
      void qc.invalidateQueries({ queryKey: ['merch-coffees'] })
      void qc.invalidateQueries({ queryKey: ['menu'] })
      task.onSuccess?.()
      message.success(task.successMessage)
    },
    onError: (e) => message.error(errorMessage(e)),
  })
  const edit = (p?: Placement) => {
    setEditing(p ?? null)
    form.resetFields()
    form.setFieldsValue(p ? { coffeeId: p.coffee.id, section: p.section, targetCategoryId: p.targetCategoryId ?? undefined, title: p.title ?? '', displayOrder: p.displayOrder,
      active: p.active, startsAt: p.startsAt ? dayjs(p.startsAt) : undefined, endsAt: p.endsAt ? dayjs(p.endsAt) : undefined }
      : { coffeeId: undefined, section: 'FEATURED', targetCategoryId: undefined, title: '', displayOrder: 0, active: true, startsAt: undefined, endsAt: undefined })
    setOpen(true)
  }
  const save = async () => {
    let v: Values
    try {
      v = await form.validateFields()
    } catch {
      return
    }
    if (v.startsAt && v.endsAt && !v.endsAt.isAfter(v.startsAt)) {
      form.setFields([{ name: 'endsAt', errors: ['Ngày kết thúc phải sau ngày bắt đầu'] }])
      message.error('Ngày kết thúc phải sau ngày bắt đầu')
      return
    }
    if (v.endsAt && !v.endsAt.isAfter(dayjs())) {
      form.setFields([{ name: 'endsAt', errors: ['Ngày kết thúc phải ở tương lai'] }])
      message.error('Không thể lưu lịch đã kết thúc')
      return
    }
    if (v.section === 'CATEGORY' && !v.targetCategoryId) {
      form.setFields([{ name: 'targetCategoryId', errors: ['Chọn danh mục cần trưng bày'] }])
      message.error('Chọn danh mục cần trưng bày')
      return
    }
    const selectedCoffee = coffees.find(c => c.id === v.coffeeId)
    const isCurrentUnavailableCoffee = editing?.coffee.id === v.coffeeId
      && (!selectedCoffee || selectedCoffee.status !== 'AVAILABLE' || selectedCoffee.autoSoldOut)
    if ((!selectedCoffee || selectedCoffee.status !== 'AVAILABLE' || selectedCoffee.autoSoldOut)
      && !isCurrentUnavailableCoffee) {
      const reason = selectedCoffee?.autoSoldOut || selectedCoffee?.status === 'SOLD_OUT'
        ? 'Món đã hết hàng' : selectedCoffee?.status === 'HIDDEN' ? 'Món đang bị ẩn' : 'Chỉ có thể chọn món đang bán và còn hàng'
      form.setFields([{ name: 'coffeeId', errors: [reason] }])
      message.error(reason)
      return
    }
    const targetCategoryId = v.section === 'CATEGORY' ? v.targetCategoryId : undefined
    const duplicate = data.find(p => p.id !== editing?.id && p.coffee.id === v.coffeeId && p.section === v.section
      && (v.section === 'CATEGORY' ? p.targetCategoryId === targetCategoryId : !p.targetCategoryId))
    if (duplicate) {
      const location = v.section === 'CATEGORY' ? `${sectionLabels[v.section]} ${duplicate.targetCategoryName ?? ''}` : sectionLabels[v.section]
      const reason = `${duplicate.coffee.name} đã có cấu hình trong khu vực ${location}`
      form.setFields([{ name: 'coffeeId', errors: [reason] }])
      message.error(reason)
      return
    }
    const body: PlacementPayload = { coffeeId: v.coffeeId, section: v.section, targetCategoryId,
      title: v.title?.trim(), displayOrder: v.displayOrder ?? 0,
      active: v.active, publicationStatus: 'DRAFT',
      startsAt: v.startsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null, endsAt: v.endsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null }
    setSaving(true)
    try {
      if (editing) await merchandisingApi.updatePlacement(editing.id, body)
      else await merchandisingApi.createPlacement(body)
      setOpen(false); message.success('Đã lưu cấu hình')
      void qc.invalidateQueries({ queryKey: ['merch-placement-overview'] })
      void qc.invalidateQueries({ queryKey: ['merch-placements'] })
      void qc.invalidateQueries({ queryKey: ['merch-public-placements'] })
    } catch (e) { message.error(errorMessage(e)) }
    finally { setSaving(false) }
  }
  const publish = (placement: Placement) => {
    const coffee = placement.coffee
    if (coffee.autoSoldOut || coffee.status === 'SOLD_OUT') {
      message.error(`${coffee.name} đã hết hàng. Hãy bổ sung nguyên liệu hoặc tồn kho rồi thử công bố lại.`)
      return
    }
    if (coffee.status === 'HIDDEN') {
      message.error(`${coffee.name} đang bị ẩn. Hãy chuyển sang Đang bán trước khi công bố.`)
      return
    }
    if (coffee.status === 'DISCONTINUED') {
      message.error(`${coffee.name} đã ngừng bán và không thể công bố.`)
      return
    }
    if (!placement.active) {
      message.error('Cấu hình đang tắt. Hãy bật cấu hình trước khi công bố.')
      return
    }
    if (placement.endsAt && !dayjs(placement.endsAt).isAfter(dayjs())) {
      message.error('Cấu hình đã hết hạn. Hãy sửa thời gian kết thúc rồi thử lại.')
      return
    }
    action.mutate({ run: () => merchandisingApi.publishPlacement(placement.id), successMessage: `Đã công bố ${coffee.name}` })
  }
  const changeVisibility = (coffee: MerchCoffee, status: string) => {
    if (status === 'AVAILABLE' && coffee.autoSoldOut) {
      message.error(`${coffee.name} đã hết nguyên liệu nên chưa thể chuyển sang Đang bán.`)
      return
    }
    const statusLabel = status === 'AVAILABLE' ? 'Đang bán' : status === 'HIDDEN' ? 'Đang ẩn' : 'Hết hàng'
    action.mutate({ run: () => merchandisingApi.updateCoffeeVisibility(coffee.id, status), successMessage: `Đã chuyển ${coffee.name} sang ${statusLabel.toLowerCase()}` })
  }
  const saveCategoryPriority = (category: NonNullable<typeof overview>['categories'][number]) => {
    const hasDraft = Object.prototype.hasOwnProperty.call(priorityDrafts, category.id)
    const next = hasDraft ? priorityDrafts[category.id] : category.displayOrder
    if (next == null || !Number.isSafeInteger(next) || next < 0 || next > 2147483647) {
      message.error('Thứ tự ưu tiên phải là số nguyên từ 0 đến 2.147.483.647')
      setPriorityDrafts(current => ({ ...current, [category.id]: category.displayOrder }))
      return
    }
    if (next === category.displayOrder) {
      setPriorityDrafts(current => { const copy = { ...current }; delete copy[category.id]; return copy })
      return
    }
    action.mutate({
      run: () => merchandisingApi.updateCategoryPriority(category.id, next),
      successMessage: `Đã cập nhật thứ tự danh mục ${category.name}`,
      onSuccess: () => setPriorityDrafts(current => { const copy = { ...current }; delete copy[category.id]; return copy }),
    })
  }
  return <div>
    <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div><Typography.Title level={3} style={{ margin: 0 }}>Trưng bày sản phẩm</Typography.Title><Typography.Text type="secondary">Cấu hình vị trí, lịch và trạng thái công bố</Typography.Text></div>
      <Button type="primary" onClick={() => edit()}>+ Tạo cấu hình</Button>
    </Space>
    {isError && <Button onClick={() => refetch()}>Không tải được dữ liệu — Thử lại</Button>}
    <Card><Table rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 950 }} pagination={{ pageSize: 10 }} columns={[
      { title: 'Sản phẩm', render: (_: unknown, p: Placement) => p.coffee.name },
      { title: 'Khu vực', dataIndex: 'section', render: (v: PlacementSection, p: Placement) =>
        v === 'CATEGORY' ? `${sectionLabels[v]} · ${p.targetCategoryName ?? 'Chưa chọn danh mục'}` : sectionLabels[v] },
      { title: 'Thứ tự', dataIndex: 'displayOrder' },
      { title: 'Công bố', dataIndex: 'publicationStatus', render: (v: string) => <Tag color={v === 'PUBLISHED' ? 'green' : 'default'}>{v}</Tag> },
      { title: 'Hiển thị thực tế', dataIndex: 'visibleNow', render: (v: boolean, p: Placement) =>
        <Tag color={v ? 'green' : 'orange'}>{p.visibilityReason || (v ? 'Đang hiển thị' : 'Chưa hiển thị')}</Tag> },
      { title: 'Thao tác', width: 245, render: (_: unknown, p: Placement) => <Space wrap>
        <Button size="small" disabled={p.publicationStatus === 'PUBLISHED' || p.coffee.status === 'DISCONTINUED'} onClick={() => edit(p)}>Sửa</Button>
        {p.publicationStatus !== 'PUBLISHED' && <Button size="small" type="primary" loading={action.isPending} disabled={action.isPending} onClick={() => publish(p)}>Công bố</Button>}
        {p.publicationStatus === 'PUBLISHED' && <Button size="small" loading={action.isPending} disabled={action.isPending} onClick={() => action.mutate({ run: () => merchandisingApi.unpublishPlacement(p.id), successMessage: `Đã thu hồi ${p.coffee.name}` })}>Thu hồi</Button>}
        <Popconfirm title="Xóa quy tắc trưng bày?" description={`Cấu hình ${p.coffee.name} sẽ bị xóa khỏi khu vực ${sectionLabels[p.section]}.`} okText="Xóa cấu hình" cancelText="Giữ lại" onConfirm={() => action.mutate({ run: () => merchandisingApi.deletePlacement(p.id), successMessage: `Đã xóa cấu hình ${p.coffee.name}` })}><Button size="small" danger disabled={action.isPending}>Xóa</Button></Popconfirm>
      </Space> },
    ]} /></Card>
    <Card title="Gợi ý trưng bày từ dữ liệu thực" style={{ marginTop: 18 }} extra={
      <Select value={suggestionSection} style={{ width: 185 }} onChange={setSuggestionSection} options={[
        { value: 'BEST_SELLER', label: 'Bán chạy 30 ngày' },
        { value: 'NEW_ARRIVAL', label: 'Mới trong 30 ngày' },
        { value: 'RECOMMENDED', label: 'Đề xuất phổ biến' },
      ]} />
    }>
      <Typography.Paragraph type="secondary">Dữ liệu tham khảo từ đơn hàng hoàn tất; chưa tự công bố. Chọn “Tạo nháp” để thiết lập lịch và thứ tự trước khi xuất bản.</Typography.Paragraph>
      <Table size="small" rowKey={(s: PlacementSuggestion) => s.coffee.id} loading={suggestionsLoading}
        dataSource={suggestions} pagination={false} columns={[
          { title: 'Sản phẩm', render: (_: unknown, s: PlacementSuggestion) => s.coffee.name },
          { title: 'Đã bán (30 ngày)', dataIndex: 'completedUnitsLast30Days' },
          { title: 'Cơ sở', dataIndex: 'reason' },
          { title: 'Thao tác', render: (_: unknown, s: PlacementSuggestion) =>
            <Button size="small" onClick={() => { edit(); form.setFieldsValue({ coffeeId: s.coffee.id, section: suggestionSection }) }}>Tạo nháp</Button> },
        ]} />
    </Card>
    <Card title="Ẩn / hiện sản phẩm" style={{ marginTop: 18 }}>
      <Table rowKey="id" size="small" dataSource={overview?.coffees ?? []} pagination={{ pageSize: 8 }} columns={[
        { title: 'Tên sản phẩm', dataIndex: 'name' },
        { title: 'Trạng thái', render: (_: unknown, c: MerchCoffee) => c.autoSoldOut ? 'Hết hàng · thiếu nguyên liệu' : c.status === 'AVAILABLE' ? 'Đang bán' : c.status === 'SOLD_OUT' ? 'Hết hàng' : c.status === 'HIDDEN' ? 'Đang ẩn' : 'Ngừng bán' },
        { title: 'Ẩn / hiện', render: (_: unknown, c: MerchCoffee) => <Select style={{ minWidth: 145 }} value={c.status} disabled={c.status === 'DISCONTINUED' || action.isPending} options={[{ value: 'AVAILABLE', label: 'Đang bán' }, { value: 'HIDDEN', label: 'Ẩn khỏi bán hàng' }, { value: 'SOLD_OUT', label: 'Hết hàng' }]} onChange={(status) => changeVisibility(c, status)} /> },
      ]} />
    </Card>
    <Card title="Thứ tự ưu tiên danh mục" style={{ marginTop: 18 }}>
      <Table rowKey="id" size="small" dataSource={overview?.categories ?? []} pagination={false} columns={[
        { title: 'Danh mục', dataIndex: 'name' },
        { title: 'Thứ tự (số nguyên không âm; nhỏ xuất hiện trước)', render: (_: unknown, category: NonNullable<typeof overview>['categories'][number]) => <InputNumber min={0} precision={0} disabled={action.isPending} value={Object.prototype.hasOwnProperty.call(priorityDrafts, category.id) ? priorityDrafts[category.id] : category.displayOrder} onChange={(value) => setPriorityDrafts(current => ({ ...current, [category.id]: value }))} onPressEnter={(e) => e.currentTarget.blur()} onBlur={() => saveCategoryPriority(category)} /> },
      ]} />
    </Card>
    <Modal title={editing ? 'Sửa cấu hình'  : 'Tạo cấu hình'} open={open} onCancel={() => { if (!saving) setOpen(false) }} onOk={() => void save()} confirmLoading={saving} okText="Lưu nháp" cancelText="Hủy" destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item label="Sản phẩm" name="coffeeId" rules={[{ required: true, message: 'Chọn sản phẩm' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Chọn món còn hàng và đang bán" options={coffeeOptions} />
        </Form.Item>
        <Form.Item label="Vị trí trưng bày" name="section" rules={[{ required: true, message: 'Chọn khu vực trưng bày' }]}>
          <Select placeholder="Chọn khu vực" options={Object.entries(sectionLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => { if (value !== 'CATEGORY') form.setFieldValue('targetCategoryId', undefined) }} />
        </Form.Item>
        {selectedSection === 'CATEGORY' && <Form.Item label="Danh mục được đặt ở đầu" name="targetCategoryId" rules={[{ required: true, message: 'Chọn danh mục cần trưng bày' }]}>
          <Select showSearch optionFilterProp="label" placeholder="Chọn danh mục" options={(overview?.categories ?? []).map(c => ({ value: c.id, label: c.name }))} />
        </Form.Item>}
        <Form.Item label="Tiêu đề" name="title" rules={[{ max: 150, message: 'Tiêu đề không được quá 150 ký tự' }]}><Input maxLength={150} showCount placeholder="Không bắt buộc" /></Form.Item>
        <Form.Item label="Thứ tự ưu tiên" name="displayOrder" rules={[{ type: 'integer', min: 0, max: 2147483647, message: 'Thứ tự phải là số nguyên từ 0 đến 2.147.483.647' }]}><InputNumber min={0} max={2147483647} precision={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Đang bật" name="active" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item label="Hiển thị từ" name="startsAt"><DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Bắt đầu ngay nếu để trống" /></Form.Item>
        <Form.Item label="Hiển thị đến" name="endsAt" dependencies={['startsAt']} rules={[{ validator: async (_, end?: dayjs.Dayjs) => {
          const start = form.getFieldValue('startsAt') as dayjs.Dayjs | undefined
          if (start && end && !end.isAfter(start)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu')
          if (end && !end.isAfter(dayjs())) throw new Error('Ngày kết thúc phải ở tương lai')
        } }]}><DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} placeholder="Không bắt buộc" /></Form.Item>
      </Form>
    </Modal>
  </div>
}
