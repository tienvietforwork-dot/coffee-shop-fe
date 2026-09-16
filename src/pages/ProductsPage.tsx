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
  Select,
  Switch,
  Popconfirm,
  message,
  Tag,
  Divider,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCategories } from '@/api/categories'
import { getMaterials } from '@/api/materials'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductMaterials,
  setProductMaterials,
  type ProductPayload,
} from '@/api/products'
import type { Product } from '@/types'

const { Title } = Typography

export function ProductsPage() {
  const queryClient = useQueryClient()
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm<ProductPayload>()

  const [recipeProduct, setRecipeProduct] = useState<Product | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] })

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      message.success('Product created')
      invalidate()
      setModalOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProductPayload }) => updateProduct(id, payload),
    onSuccess: () => {
      message.success('Product updated')
      invalidate()
      setModalOpen(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      message.success('Product deleted')
      invalidate()
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ active: true })
    setModalOpen(true)
  }
  const openEdit = (record: Product) => {
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

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Products</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New product
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={products}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Category',
            dataIndex: 'categoryId',
            render: (categoryId: number) =>
              categories?.find((c) => c.id === categoryId)?.name ?? categoryId,
          },
          {
            title: 'Price',
            dataIndex: 'price',
            render: (price: number) => price.toLocaleString('vi-VN') + ' ₫',
          },
          {
            title: 'Active',
            dataIndex: 'active',
            render: (active: boolean) => (
              <Tag color={active ? 'green' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
            ),
          },
          {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_, record: Product) => (
              <Space>
                <Button
                  icon={<ExperimentOutlined />}
                  size="small"
                  onClick={() => setRecipeProduct(record)}
                  title="Manage materials"
                />
                <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
                <Popconfirm
                  title="Delete this product?"
                  onConfirm={() => deleteMutation.mutate(record.id)}
                >
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Edit product' : 'New product'}
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
          <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
            <Select
              options={categories?.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select a category"
            />
          </Form.Item>
          <Form.Item name="price" label="Price (VND)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {recipeProduct && (
        <ProductRecipeModal product={recipeProduct} onClose={() => setRecipeProduct(null)} />
      )}
    </div>
  )
}

interface ProductRecipeModalProps {
  product: Product
  onClose: () => void
}

interface RecipeRow {
  key: string
  materialId?: number
  quantity: number
}

function ProductRecipeModal({ product, onClose }: ProductRecipeModalProps) {
  const queryClient = useQueryClient()
  const { data: materials } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['products', product.id, 'materials'],
    queryFn: () => getProductMaterials(product.id),
  })

  const [rows, setRows] = useState<RecipeRow[] | null>(null)

  const effectiveRows: RecipeRow[] =
    rows ??
    (recipe ?? []).map((r) => ({
      key: `${r.materialId}`,
      materialId: r.materialId,
      quantity: r.quantity,
    }))

  const saveMutation = useMutation({
    mutationFn: () =>
      setProductMaterials(
        product.id,
        effectiveRows
          .filter((r) => r.materialId)
          .map((r) => ({ materialId: r.materialId as number, quantity: r.quantity })),
      ),
    onSuccess: () => {
      message.success('Recipe saved')
      queryClient.invalidateQueries({ queryKey: ['products', product.id, 'materials'] })
      onClose()
    },
  })

  const updateRow = (key: string, patch: Partial<RecipeRow>) => {
    setRows(effectiveRows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  const addRow = () => {
    setRows([...effectiveRows, { key: `new-${Date.now()}`, quantity: 1 }])
  }
  const removeRow = (key: string) => {
    setRows(effectiveRows.filter((r) => r.key !== key))
  }

  return (
    <Modal
      title={`Materials recipe — ${product.name}`}
      open
      onCancel={onClose}
      onOk={() => saveMutation.mutate()}
      confirmLoading={saveMutation.isPending}
      width={600}
      destroyOnClose
    >
      <Table
        rowKey="key"
        loading={isLoading}
        dataSource={effectiveRows}
        pagination={false}
        columns={[
          {
            title: 'Material',
            dataIndex: 'materialId',
            render: (materialId: number, row) => (
              <Select
                style={{ width: '100%' }}
                value={materialId}
                placeholder="Select material"
                options={materials?.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))}
                onChange={(value) => updateRow(row.key, { materialId: value })}
              />
            ),
          },
          {
            title: 'Quantity used',
            dataIndex: 'quantity',
            width: 160,
            render: (quantity: number, row) => (
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                value={quantity}
                onChange={(value) => updateRow(row.key, { quantity: value ?? 0 })}
              />
            ),
          },
          {
            title: '',
            key: 'actions',
            width: 60,
            render: (_, row) => (
              <Button danger icon={<DeleteOutlined />} size="small" onClick={() => removeRow(row.key)} />
            ),
          },
        ]}
      />
      <Divider />
      <Button icon={<PlusOutlined />} onClick={addRow}>
        Add material
      </Button>
    </Modal>
  )
}
