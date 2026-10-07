import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Dropdown, Form, Input, Modal, Select, Space, Table } from 'antd'
import { PlusOutlined, DownOutlined, ExperimentOutlined, PrinterOutlined } from '@ant-design/icons'
import { coreApi, type CoffeePayload } from '@/api/core'
import type { Coffee, CoffeeStatus } from '@/api/types'
import { COFFEE_STATUS, imageSrc, money, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { useAction } from '../components/useCrud'
import { MoneyInput } from '../components/MoneyInput'
import { ImageUpload, type ImageValue } from '../components/ImageUpload'
import { RecipeDrawer } from '../components/RecipeDrawer'
import { ServingsCell } from '../components/ServingsCell'
import { PrintRecipesModal } from '../components/PrintRecipesModal'
import { P, usePerm } from '@/lib/perm'

export function CoffeesPage() {
  const { can } = usePerm()
  const isAdmin = can(P.MENU_EDIT)
  const canStatus = can(P.MENU)
  const { data = [], isLoading } = useQuery({ queryKey: ['coffees'], queryFn: coreApi.coffees })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: coreApi.categories })
  const [edit, setEdit] = useState<Partial<Coffee> | null>(null)
  const [recipeFor, setRecipeFor] = useState<{ coffee: Coffee; edit: boolean } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [cat, setCat] = useState<number>()
  const [q, setQ] = useState('')
  const save = useAction((v: CoffeePayload & { id?: number }) => (v.id ? coreApi.updateCoffee(v.id, v) : coreApi.createCoffee(v)), [['coffees'], ['menu']])
  const setStatus = useAction((v: { id: number; status: CoffeeStatus }) => coreApi.setCoffeeStatus(v.id, v.status), [['coffees'], ['menu']], 'Đã cập nhật')

  const rows = useMemo(() => data.filter((c) => (!cat || c.categoryId === cat) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))), [data, cat, q])

  return (
    <>
      <PageHeader
        title="Cà phê & công thức"
        subtitle="Thiết lập món, giá bán, khả năng bán và công thức pha chế"
        extra={(
          <Space>
            <Button icon={<PrinterOutlined />} onClick={() => setPrinting(true)}>In công thức</Button>
            {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({ status: 'AVAILABLE' })}>Tạo cà phê mới</Button>}
          </Space>
        )}
      />
      <Space style={{ marginBottom: 12 }} wrap>
        <Select allowClear placeholder="Danh mục" style={{ width: 180 }} value={cat} onChange={setCat} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Input.Search allowClear placeholder="Tìm món" onSearch={setQ} />
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        columns={[
          { title: '', dataIndex: 'imageUrl', width: 64, render: (v) => <Avatar shape="square" size={48} src={imageSrc(v)}>☕</Avatar> },
          { title: 'Tên', dataIndex: 'name', render: (v, c) => <><b>{v}</b><div className="a-muted small">{c.description}</div></> },
          { title: 'Danh mục', dataIndex: 'categoryName' },
          { title: 'Giá bán', dataIndex: 'price', render: money, align: 'right', sorter: (a, b) => a.price - b.price },
          { title: 'Còn pha được', width: 130, render: (_, c) => <ServingsCell coffee={c} />, sorter: (a, b) => (a.servings ?? Infinity) - (b.servings ?? Infinity) },
          {
            title: 'Trạng thái', render: (_, c) => <>
              {canStatus && (isAdmin || c.status !== 'DISCONTINUED') ? (
                <Dropdown menu={{ items: options(COFFEE_STATUS).filter((o) => isAdmin || o.value !== 'DISCONTINUED').map((o) => ({ key: o.value, label: o.label })), onClick: (e) => setStatus.mutate({ id: c.id, status: e.key as CoffeeStatus }) }}>
                  <a><StatusTag label={COFFEE_STATUS[c.status]} /> <DownOutlined /></a>
                </Dropdown>
              ) : <StatusTag label={COFFEE_STATUS[c.status]} />}
              {c.autoSoldOut && <div className="a-muted small">tự động · hết nguyên liệu</div>}
            </>,
          },
          {
            title: '', width: 180, render: (_, c) => (
              <Space>
                <Button size="small" icon={<ExperimentOutlined />} onClick={() => setRecipeFor({ coffee: c, edit: false })}>Công thức</Button>
                {isAdmin && <Button size="small" onClick={() => setEdit(c)}>Sửa</Button>}
              </Space>
            ),
          },
        ]}
      />
      <Modal open={!!edit} title={edit?.id ? `Sửa ${edit.name}` : 'Tạo cà phê mới'} footer={null} onCancel={() => setEdit(null)} destroyOnHidden width={720}>
        <Form layout="vertical" initialValues={{ ...edit, image: edit?.imageUrl ? { id: edit.imageId, url: edit.imageUrl } : undefined }}
          onFinish={({ image, ...v }: CoffeePayload & { image?: ImageValue }) => save.mutate({ ...v, imageId: image?.id, imageUrl: image?.id ? undefined : image?.url, id: edit?.id }, {
          onSuccess: (saved) => {
            setEdit(null)
            // every coffee must have a recipe: go straight to it after creating one
            if (!edit?.id) setRecipeFor({ coffee: saved, edit: true })
          },
        })}>
          <div className="a-coffee-form">
            <Form.Item name="image" label="Ảnh món"><ImageUpload /></Form.Item>
            <div>
              <Form.Item name="name" label="Tên cà phê" rules={[{ required: true }]}><Input maxLength={150} /></Form.Item>
              <div className="a-grid-2">
                <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true }]}>
                  <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
                <Form.Item name="price" label="Giá bán" rules={[{ required: true }]}><MoneyInput /></Form.Item>
              </div>
              <Form.Item name="status" label="Trạng thái"><Select options={options(COFFEE_STATUS)} /></Form.Item>
            </div>
          </div>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} placeholder="Hiển thị dưới tên món trên trang gọi món" /></Form.Item>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setEdit(null)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>
          </Space>
        </Form>
      </Modal>
      <PrintRecipesModal open={printing} onClose={() => setPrinting(false)} />
      <RecipeDrawer coffee={recipeFor?.coffee ?? null} startEditing={recipeFor?.edit} onClose={() => setRecipeFor(null)} editable={isAdmin} />
    </>
  )
}
