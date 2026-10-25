import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import {
  merchandisingApi,
  sectionLabels,
  type Placement,
  type PlacementPayload,
  type PlacementSection,
  type PlacementSuggestion,
} from '../../api/merchandising'

type Values = { coffeeId: number; section: PlacementSection; title?: string; displayOrder?: number; active: boolean; startsAt?: dayjs.Dayjs; endsAt?: dayjs.Dayjs }
export function ProductPlacementPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<Placement | null>(null)
  const [open, setOpen] = useState(false)
  const [suggestionSection, setSuggestionSection] = useState<PlacementSection>('BEST_SELLER')
  const { data: suggestions = [], isFetching: suggestionsLoading } = useQuery({
    queryKey: ['merch-placement-suggestions', suggestionSection],
    queryFn: () => merchandisingApi.placementSuggestions(suggestionSection),
  })
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['merch-placements'], queryFn: merchandisingApi.placements })
  const { data: overview } = useQuery({ queryKey: ['merch-placement-overview'], queryFn: merchandisingApi.placementOverview })
  const { data: coffees = [] } = useQuery({ queryKey: ['merch-coffees'], queryFn: coreApi.coffees })
  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['merch-placement-overview'] }); void qc.invalidateQueries({ queryKey: ['merch-placements'] }); void qc.invalidateQueries({ queryKey: ['merch-public-placements'] }); message.success('Thành công') },
    onError: (e) => message.error(errorMessage(e)),
  })
  const edit = (p?: Placement) => {
    setEditing(p ?? null)
    form.setFieldsValue(p ? { coffeeId: p.coffee.id, section: p.section, title: p.title ?? '', displayOrder: p.displayOrder,
      active: p.active, startsAt: p.startsAt ? dayjs(p.startsAt) : undefined, endsAt: p.endsAt ? dayjs(p.endsAt) : undefined }
      : { coffeeId: undefined, section: 'FEATURED', title: '', displayOrder: 0, active: true, startsAt: undefined, endsAt: undefined })
    setOpen(true)
  }
  const save = async () => {
    const v = await form.validateFields()
    if (v.startsAt && v.endsAt && !v.endsAt.isAfter(v.startsAt)) { message.error('Ngày kết thúc phải sau ngày bắt đầu'); return }
    const body: PlacementPayload = { coffeeId: v.coffeeId, section: v.section, title: v.title?.trim(), displayOrder: v.displayOrder ?? 0,
      active: v.active, publicationStatus: 'DRAFT',
      startsAt: v.startsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null, endsAt: v.endsAt?.format('YYYY-MM-DDTHH:mm:ss') ?? null }
    try {
      if (editing) await merchandisingApi.updatePlacement(editing.id, body)
      else await merchandisingApi.createPlacement(body)
      setOpen(false); message.success('Đã lưu cấu hình')
      void qc.invalidateQueries({ queryKey: ['merch-placements'] }); void qc.invalidateQueries({ queryKey: ['merch-public-placements'] })
    } catch (e) { message.error(errorMessage(e)) }
  }
  return <div>
    <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
      <div><Typography.Title level={3} style={{ margin: 0 }}>Trưng bày sản phẩm</Typography.Title><Typography.Text type="secondary">Cấu hình vị trí, lịch và trạng thái công bố</Typography.Text></div>
      <Button type="primary" onClick={() => edit()}>+ Tạo cấu hình</Button>
    </Space>
    {isError && <Button onClick={() => refetch()}>Không tải được dữ liệu — Thử lại</Button>}
    <Card><Table rowKey="id" loading={isLoading} dataSource={data} scroll={{ x: 950 }} pagination={{ pageSize: 10 }} columns={[
      { title: 'Sản phẩm', render: (_: unknown, p: Placement) => p.coffee.name },
      { title: 'Khu vực', dataIndex: 'section', render: (v: PlacementSection) => sectionLabels[v] },
      { title: 'Thứ tự', dataIndex: 'displayOrder' },
      { title: 'Công bố', dataIndex: 'publicationStatus', render: (v: string) => <Tag color={v === 'PUBLISHED' ? 'green' : 'default'}>{v}</Tag> },
      { title: 'Hiển thị', dataIndex: 'visibleNow', render: (v: boolean) => <Tag color={v ? 'green' : 'orange'}>{v ? 'Đang hiện' : 'Chưa hiện'}</Tag> },
      { title: 'Thao tác', width: 245, render: (_: unknown, p: Placement) => <Space wrap>
        <Button size="small" disabled={p.publicationStatus === 'PUBLISHED'} onClick={() => edit(p)}>Sửa</Button>
        {p.publicationStatus !== 'PUBLISHED' && <Button size="small" type="primary" loading={action.isPending} onClick={() => action.mutate(() => merchandisingApi.publishPlacement(p.id))}>Công bố</Button>}
        {p.publicationStatus === 'PUBLISHED' && <Button size="small" onClick={() => action.mutate(() => merchandisingApi.unpublishPlacement(p.id))}>Thu hồi</Button>}
        <Popconfirm title="Xóa quy tắc trưng bày?" onConfirm={() => action.mutate(() => merchandisingApi.deletePlacement(p.id))}><Button size="small" danger>Xóa</Button></Popconfirm>
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
        { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => v },
        { title: 'Ẩn / hiện', render: (_: unknown, c: { id: number; status: string }) => <Select style={{ minWidth: 145 }} value={c.status} disabled={c.status === 'DISCONTINUED' || action.isPending} options={[{ value: 'AVAILABLE', label: 'Đang bán' }, { value: 'HIDDEN', label: 'Ẩn khỏi bán hàng' }, { value: 'SOLD_OUT', label: 'Hết hàng' }]} onChange={(status) => action.mutate(() => merchandisingApi.updateCoffeeVisibility(c.id, status))} /> },
      ]} />
    </Card>
    <Card title="Thứ tự ưu tiên danh mục" style={{ marginTop: 18 }}>
      <Table rowKey="id" size="small" dataSource={overview?.categories ?? []} pagination={false} columns={[
        { title: 'Danh mục', dataIndex: 'name' },
        { title: 'Thứ tự (nhỏ xuất hiện trước)', render: (_: unknown, category: { id: number; displayOrder: number }) => <InputNumber min={0} precision={0} disabled={action.isPending} defaultValue={category.displayOrder} key={`${category.id}-${category.displayOrder}`} onPressEnter={(e) => e.currentTarget.blur()} onBlur={(e) => { const next = Number(e.target.value); if (Number.isInteger(next) && next >= 0 && next !== category.displayOrder) action.mutate(() => merchandisingApi.updateCategoryPriority(category.id, next)) }} /> },
      ]} />
    </Card>
    <Modal title={editing ? 'Sửa cấu hình'  : 'Tạo cấu hình'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} okText="Lưu" destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item label="Sản phẩm" name="coffeeId" rules={[{ required: true, message: 'Chọn sản phẩm' }]}><Select showSearch optionFilterProp="label" options={coffees.map((c) => ({ value: c.id, label: c.name }))} /></Form.Item>
        <Form.Item label="Vị trí trưng bày" name="section" rules={[{ required: true }]}><Select options={Object.entries(sectionLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
        <Form.Item label="Tiêu đề" name="title" rules={[{ max: 150 }]}><Input maxLength={150} /></Form.Item>
        <Form.Item label="Thứ tự ưu tiên" name="displayOrder"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Đang bật" name="active" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item label="Hiển thị từ" name="startsAt"><DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Hiển thị đến" name="endsAt"><DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </div>
}
