import { useState } from 'react'
import {
  Table,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  message,
  Tabs,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined, HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialTransactions,
  stockInMaterial,
  type MaterialPayload,
} from '@/api/materials'
import type { Material } from '@/types'

const { Title } = Typography

export function MaterialsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [form] = Form.useForm<MaterialPayload>()

  const [stockInTarget, setStockInTarget] = useState<Material | null>(null)
  const [stockForm] = Form.useForm<{ quantity: number; note?: string }>()

  const [historyTarget, setHistoryTarget] = useState<Material | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['materials'] })

  const createMutation = useMutation({
    mutationFn: createMaterial,
    onSuccess: () => {
      message.success('Material created')
      invalidate()
      setModalOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MaterialPayload }) => updateMaterial(id, payload),
    onSuccess: () => {
      message.success('Material updated')
      invalidate()
      setModalOpen(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      message.success('Material deleted')
      invalidate()
    },
  })
  const stockInMutation = useMutation({
    mutationFn: ({ id, quantity, note }: { id: number; quantity: number; note?: string }) =>
      stockInMaterial(id, { quantity, note }),
    onSuccess: () => {
      message.success('Stock updated')
      invalidate()
      setStockInTarget(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (record: Material) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }
  const handleSubmit = async () => {
    const values = await form.validateFields()
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const openStockIn = (record: Material) => {
    setStockInTarget(record)
    stockForm.resetFields()
  }
  const handleStockIn = async () => {
    const values = await stockForm.validateFields()
    if (stockInTarget) {
      stockInMutation.mutate({ id: stockInTarget.id, ...values })
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Materials & Inventory</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New material
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        rowClassName={(record) => (record.stockQuantity < record.minThreshold ? 'low-stock-row' : '')}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Unit', dataIndex: 'unit' },
          {
            title: 'Stock',
            dataIndex: 'stockQuantity',
            render: (qty: number, record: Material) => (
              <span style={{ color: qty < record.minThreshold ? '#cf1322' : undefined, fontWeight: qty < record.minThreshold ? 600 : 400 }}>
                {qty}
              </span>
            ),
          },
          { title: 'Min threshold', dataIndex: 'minThreshold' },
          {
            title: 'Unit price',
            dataIndex: 'unitPrice',
            render: (price: number) => price.toLocaleString('vi-VN') + ' ₫',
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 220,
            render: (_, record: Material) => (
              <Space>
                <Button icon={<InboxOutlined />} size="small" onClick={() => openStockIn(record)} title="Stock in" />
                <Button icon={<HistoryOutlined />} size="small" onClick={() => setHistoryTarget(record)} title="History" />
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                <Popconfirm title="Delete this material?" onConfirm={() => deleteMutation.mutate(record.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit material' : 'New material'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="Unit (e.g. kg, l, pcs)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="stockQuantity" label="Current stock" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="minThreshold" label="Minimum threshold" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="unitPrice" label="Unit price (VND)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Stock in — ${stockInTarget?.name ?? ''}`}
        open={!!stockInTarget}
        onCancel={() => setStockInTarget(null)}
        onOk={handleStockIn}
        confirmLoading={stockInMutation.isPending}
        destroyOnClose
      >
        <Form form={stockForm} layout="vertical">
          <Form.Item name="quantity" label="Quantity to add" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} placeholder="e.g. purchase order #123" />
          </Form.Item>
        </Form>
      </Modal>

      {historyTarget && (
        <MaterialHistoryModal material={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  )
}

function MaterialHistoryModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['materials', material.id, 'transactions'],
    queryFn: () => getMaterialTransactions(material.id),
  })

  return (
    <Modal title={`Transaction history — ${material.name}`} open onCancel={onClose} footer={null} width={600}>
      <Tabs
        items={[
          {
            key: 'history',
            label: 'History',
            children: (
              <Table
                rowKey="id"
                loading={isLoading}
                dataSource={data}
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: 'Type', dataIndex: 'type' },
                  { title: 'Quantity', dataIndex: 'quantity' },
                  { title: 'Note', dataIndex: 'note' },
                  {
                    title: 'Date',
                    dataIndex: 'createdAt',
                    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </Modal>
  )
}
