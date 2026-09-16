import { useMemo, useState } from 'react'
import {
  Table,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tag,
  Segmented,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getProducts } from '@/api/products'
import { getOrders, createOrder, updateOrderStatus, type CreateOrderPayload } from '@/api/orders'
import type { Order, OrderStatus } from '@/types'

const { Title } = Typography

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'default',
  CONFIRMED: 'blue',
  PREPARING: 'gold',
  READY: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirm',
  PREPARING: 'Start preparing',
  READY: 'Mark ready',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancelled',
}

export function OrdersPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => getOrders(statusFilter === 'ALL' ? undefined : statusFilter),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      message.success('Order status updated')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })

  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Orders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New order
        </Button>
      </Space>

      <Segmented
        style={{ marginBottom: 16 }}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as OrderStatus | 'ALL')}
        options={[
          { label: 'All', value: 'ALL' },
          { label: 'Pending', value: 'PENDING' },
          { label: 'Confirmed', value: 'CONFIRMED' },
          { label: 'Preparing', value: 'PREPARING' },
          { label: 'Ready', value: 'READY' },
          { label: 'Completed', value: 'COMPLETED' },
          { label: 'Cancelled', value: 'CANCELLED' },
        ]}
      />

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={orders}
        columns={[
          { title: 'Code', dataIndex: 'code', render: (v, r: Order) => v ?? `#${r.id}` },
          { title: 'Customer', dataIndex: 'customerName', render: (v) => v ?? '—' },
          {
            title: 'Total',
            dataIndex: 'totalAmount',
            render: (v: number) => v.toLocaleString('vi-VN') + ' ₫',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (status: OrderStatus) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 260,
            render: (_, record: Order) => {
              const next = STATUS_FLOW[record.status]
              return (
                <Space>
                  {next && (
                    <Button
                      size="small"
                      type="primary"
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: record.id, status: next })}
                    >
                      {STATUS_LABELS[next]}
                    </Button>
                  )}
                  {record.status !== 'CANCELLED' && record.status !== 'COMPLETED' && (
                    <Button
                      size="small"
                      danger
                      loading={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: record.id, status: 'CANCELLED' })}
                    >
                      Cancel
                    </Button>
                  )}
                </Space>
              )
            },
          },
        ]}
        expandable={{
          expandedRowRender: (record: Order) => (
            <Table
              rowKey={(item, idx) => item.id ?? idx ?? 0}
              dataSource={record.items}
              pagination={false}
              columns={[
                { title: 'Product', dataIndex: 'productName' },
                { title: 'Quantity', dataIndex: 'quantity' },
                {
                  title: 'Unit price',
                  dataIndex: 'unitPrice',
                  render: (v: number) => v.toLocaleString('vi-VN') + ' ₫',
                },
                {
                  title: 'Line total',
                  key: 'lineTotal',
                  render: (_, item) => (item.quantity * item.unitPrice).toLocaleString('vi-VN') + ' ₫',
                },
              ]}
            />
          ),
        }}
      />

      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

interface DraftItem {
  key: string
  productId?: number
  quantity: number
}

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const [form] = Form.useForm<{ customerName?: string; customerPhone?: string }>()
  const [items, setItems] = useState<DraftItem[]>([{ key: 'item-0', quantity: 1 }])

  const createMutation = useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: () => {
      message.success('Order created')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    },
  })

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products?.find((p) => p.id === item.productId)
      return sum + (product ? product.price * item.quantity : 0)
    }, 0)
  }, [items, products])

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }
  const addItem = () => setItems((prev) => [...prev, { key: `item-${prev.length}-${Date.now()}`, quantity: 1 }])
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key))

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const validItems = items.filter((i) => i.productId && i.quantity > 0)
    if (validItems.length === 0) {
      message.error('Add at least one product')
      return
    }
    createMutation.mutate({
      ...values,
      items: validItems.map((i) => ({ productId: i.productId as number, quantity: i.quantity })),
    })
  }

  return (
    <Modal
      title="New order"
      open
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Space style={{ width: '100%' }}>
          <Form.Item name="customerName" label="Customer name" style={{ flex: 1, minWidth: 200 }}>
            <Input />
          </Form.Item>
          <Form.Item name="customerPhone" label="Phone" style={{ flex: 1, minWidth: 200 }}>
            <Input />
          </Form.Item>
        </Space>
      </Form>

      <Table
        rowKey="key"
        dataSource={items}
        pagination={false}
        columns={[
          {
            title: 'Product',
            dataIndex: 'productId',
            render: (productId: number, row) => (
              <Select
                style={{ width: '100%' }}
                placeholder="Select product"
                value={productId}
                options={products
                  ?.filter((p) => p.active)
                  .map((p) => ({ value: p.id, label: `${p.name} (${p.price.toLocaleString('vi-VN')} ₫)` }))}
                onChange={(value) => updateItem(row.key, { productId: value })}
              />
            ),
          },
          {
            title: 'Qty',
            dataIndex: 'quantity',
            width: 100,
            render: (quantity: number, row) => (
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                value={quantity}
                onChange={(value) => updateItem(row.key, { quantity: value ?? 1 })}
              />
            ),
          },
          {
            title: '',
            key: 'actions',
            width: 50,
            render: (_, row) => (
              <Button danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(row.key)} />
            ),
          },
        ]}
      />
      <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={addItem}>
        Add product
      </Button>

      <div style={{ marginTop: 16, textAlign: 'right', fontSize: 16 }}>
        <strong>Total: {total.toLocaleString('vi-VN')} ₫</strong>
      </div>
    </Modal>
  )
}
