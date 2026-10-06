import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi, type MaterialPayload } from '@/api/core'
import type { Material } from '@/api/types'
import { BATCH_STATUS, date, money, num } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { P, usePerm } from '@/lib/perm'

const UNITS = ['g', 'kg', 'ml', 'l', 'quả', 'gói', 'hộp', 'chai']

export function MaterialsPage() {
  const isAdmin = usePerm().can(P.MATERIALS_EDIT)
  const { data = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: coreApi.alerts })
  const [edit, setEdit] = useState<Partial<Material> | null>(null)
  const [batchesOf, setBatchesOf] = useState<Material | null>(null)
  const { data: batches = [], isLoading: bLoading } = useQuery({
    queryKey: ['batches', batchesOf?.id], queryFn: () => coreApi.batches(batchesOf!.id), enabled: !!batchesOf,
  })
  const save = useAction((v: MaterialPayload & { id?: number }) => (v.id ? coreApi.updateMaterial(v.id, v) : coreApi.createMaterial(v)), [['materials']])

  return (
    <>
      <PageHeader title="Nguyên liệu & lô" subtitle="Tồn kho = tổng số lượng còn lại của các lô"
        extra={isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ unit: 'g', status: 'ACTIVE' })}>Thêm nguyên liệu</Button>} />
      {!!alerts?.expiringBatches.length && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`${alerts.expiringBatches.length} lô sắp hết hạn trong 7 ngày: ${alerts.expiringBatches.map((b) => `${b.materialName} (${date(b.expiryDate)})`).join(', ')}`} />
      )}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        rowClassName={(m) => (m.lowStock ? 'a-row-warn' : '')}
        columns={[
          { title: 'Nguyên liệu', dataIndex: 'name', render: (v, m) => <>{v} {m.lowStock && <Tag color="red" icon={<WarningOutlined />}>Sắp hết</Tag>} {m.status === 'INACTIVE' && <Tag>Ngưng dùng</Tag>}</> },
          { title: 'Tồn kho', render: (_, m) => <b>{num(m.stockQuantity)} {m.unit}</b>, sorter: (a, b) => a.stockQuantity / Math.max(a.minStock, 1) - b.stockQuantity / Math.max(b.minStock, 1) },
          { title: 'Tồn tối thiểu', render: (_, m) => `${num(m.minStock)} ${m.unit}` },
          {
            title: '', width: 160, render: (_, m) => (
              <Space>
                <Button size="small" onClick={() => setBatchesOf(m)}>Các lô</Button>
                {isAdmin && <Button size="small" onClick={() => setEdit(m)}>Sửa</Button>}
              </Space>
            ),
          },
        ]}
      />
      <Modal open={!!edit} title={edit?.id ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden>
        <Form layout="vertical" initialValues={edit ?? {}} onFinish={(v) => save.mutate({ ...v, id: edit?.id }, { onSuccess: () => setEdit(null) })}>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true }]}><Select options={UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item>
            <Form.Item name="minStock" label="Mức tồn tối thiểu"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="status" label="Trạng thái"><Select options={[{ value: 'ACTIVE', label: 'Đang dùng' }, { value: 'INACTIVE', label: 'Ngưng dùng' }]} /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
      <Drawer open={!!batchesOf} onClose={() => setBatchesOf(null)} width={720} title={`Các lô · ${batchesOf?.name ?? ''}`}>
        <Table rowKey="id" size="small" loading={bLoading} dataSource={batches} pagination={false}
          columns={[
            { title: 'Lô', dataIndex: 'id', render: (v) => `#${v}` },
            { title: 'Nhập', render: (_, b) => `${num(b.importQuantity)} ${b.unit}` },
            { title: 'Còn lại', render: (_, b) => <b>{num(b.remainingQuantity)} {b.unit}</b> },
            { title: 'Đơn giá nhập', dataIndex: 'unitCost', render: money },
            { title: 'Hạn dùng', dataIndex: 'expiryDate', render: (v) => <span style={{ color: v && dayjs(v).diff(dayjs(), 'day') <= 7 ? '#cf1322' : undefined }}>{date(v)}</span> },
            { title: 'Trạng thái', render: (_, b) => <StatusTag label={BATCH_STATUS[b.status]} /> },
          ]} />
      </Drawer>
    </>
  )
}
