import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import type { DeliveryZone } from '@/api/types'
import { money } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { MoneyInput } from '../components/MoneyInput'
import { useAction } from '../components/useCrud'

type Values = { name: string; districts: string[]; fee: number; freeShipThreshold?: number; minOrderAmount?: number; estimatedMinutes?: number; active: boolean; sortOrder?: number }

/**
 * Khu vực giao hàng: mỗi khu vực gồm các quận / phường, phí ship, miễn phí ship từ … đ, đơn tối thiểu để giao, thời gian
 * giao dự kiến. Khách chọn quận khi đặt giao hàng; quận không thuộc khu vực nào là ngoài vùng giao.
 */
export function DeliveryZonesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['delivery-zones'], queryFn: coreApi.deliveryZones })
  const [edit, setEdit] = useState<Partial<DeliveryZone> | null>(null)
  const [form] = Form.useForm<Values>()
  const save = useAction(coreApi.saveDeliveryZone, [['delivery-zones'], ['delivery-zones-public']], 'Đã lưu khu vực')
  const remove = useAction(coreApi.deleteDeliveryZone, [['delivery-zones'], ['delivery-zones-public']], 'Đã xóa khu vực')
  const open = (z: Partial<DeliveryZone>) => {
    setEdit(z)
    form.resetFields()
    form.setFieldsValue({ ...z, districts: z.districts ? z.districts.split(',').map((d) => d.trim()) : [], active: z.active ?? true } as Values)
  }

  return (
    <>
      <PageHeader title="Khu vực giao hàng" subtitle="Phí ship theo quận / phường · miễn phí ship từ · đơn tối thiểu"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open({ active: true })}>Thêm khu vực</Button>} />
      <Table<DeliveryZone> rowKey="id" loading={isLoading} dataSource={data} pagination={false}
        columns={[
          { title: 'Khu vực', dataIndex: 'name', render: (v) => <b>{v}</b> },
          { title: 'Quận / phường', dataIndex: 'districts', render: (v: string) => v.split(',').map((d) => <Tag key={d}>{d.trim()}</Tag>) },
          { title: 'Phí ship', dataIndex: 'fee', render: money, align: 'right' },
          { title: 'Miễn phí từ', dataIndex: 'freeShipThreshold', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
          { title: 'Đơn tối thiểu', dataIndex: 'minOrderAmount', render: (v) => (v == null ? '—' : money(v)), align: 'right' },
          { title: 'Dự kiến', dataIndex: 'estimatedMinutes', render: (v) => (v ? `${v} phút` : '—') },
          { title: 'Trạng thái', dataIndex: 'active', render: (v) => (v ? <Tag color="green">Đang giao</Tag> : <Tag>Tạm ngưng</Tag>) },
          {
            title: '', render: (_, z) => <Space>
              <Button size="small" onClick={() => open(z)}>Sửa</Button>
              <Popconfirm title="Xóa khu vực?" onConfirm={() => remove.mutate(z.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
            </Space>,
          },
        ]} />
      <Modal open={!!edit} title={edit?.id ? 'Sửa khu vực' : 'Thêm khu vực'} onCancel={() => setEdit(null)} destroyOnHidden
        footer={<Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Lưu</Button>}>
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên khu vực" rules={[{ required: true }]}><Input placeholder="Nội thành gần" /></Form.Item>
          <Form.Item name="districts" label="Quận / phường" rules={[{ required: true }]} extra="Gõ tên rồi Enter; mỗi quận chỉ thuộc 1 khu vực">
            <Select mode="tags" tokenSeparators={[',']} placeholder="Quận 1, Quận 3, Phú Nhuận" />
          </Form.Item>
          <div className="a-grid-3">
            <Form.Item name="fee" label="Phí ship" rules={[{ required: true }]}><MoneyInput /></Form.Item>
            <Form.Item name="freeShipThreshold" label="Miễn phí ship từ"><MoneyInput /></Form.Item>
            <Form.Item name="minOrderAmount" label="Đơn tối thiểu"><MoneyInput /></Form.Item>
          </div>
          <div className="a-grid-3">
            <Form.Item name="estimatedMinutes" label="Giao trong (phút)"><InputNumber min={5} max={240} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="sortOrder" label="Thứ tự"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="active" label="Đang giao" valuePropName="checked"><Switch /></Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}
