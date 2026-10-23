import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Descriptions, Drawer, Empty, Form, Input, InputNumber, Popconfirm, Select, Space, Spin, Tag } from 'antd'
import { EditOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { coreApi, type RecipePayload } from '@/api/core'
import type { Coffee, Recipe } from '@/api/types'
import { useAction } from './useCrud'
import { SortableSteps } from './SortableSteps'
import { BREW_METHOD, dateTime } from '@/lib/format'


/**
 * One recipe is in use per coffee (pha chế and trừ kho follow it). A new formula can be tried as a bản nháp first:
 * saved beside the active one, then "Áp dụng" swaps it in, or "Xóa nháp" drops it. Opens in view mode.
 */
export function RecipeDrawer({ coffee, onClose, editable, startEditing = false }: {
  coffee: Coffee | null; onClose: () => void; editable: boolean; startEditing?: boolean
}) {
  const { data: recipes = [], isLoading } = useQuery({ queryKey: ['recipes', coffee?.id], queryFn: () => coreApi.recipes(coffee!.id), enabled: !!coffee })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials, enabled: !!coffee })
  const [editing, setEditing] = useState(false)
  const [viewId, setViewId] = useState<number>()
  const active = recipes.find((r) => r.active)
  const drafts = recipes.filter((r) => !r.active)
  const recipe = recipes.find((r) => r.id === viewId) ?? active ?? recipes[0]
  // not in use: older than the active one = a replaced recipe (bản cũ), newer = a draft being tried
  const isOld = (r: Recipe) => !r.active && !!active && r.version < active.version
  const label = (r: Recipe) => (r.active ? 'Đang áp dụng' : isOld(r) ? 'Bản cũ' : 'Bản nháp')
  const keys = [['recipes'], ['coffees']]
  // activate=true: the edited recipe is (or becomes) the one in use; false: kept as a draft
  const save = useAction((v: RecipePayload) => (recipe ? coreApi.updateRecipe(recipe.id, v) : coreApi.createRecipe(coffee!.id, v)), keys, 'Đã lưu công thức')
  const saveDraft = useAction((v: RecipePayload) => coreApi.createRecipe(coffee!.id, { ...v, activate: false }), keys, 'Đã lưu bản nháp')
  const apply = useAction(coreApi.activateRecipe, keys, 'Đã áp dụng công thức')
  const remove = useAction(coreApi.deleteRecipe, keys, 'Đã xóa')
  const [form] = Form.useForm()

  useEffect(() => { setEditing(!!coffee && startEditing); setViewId(undefined) }, [coffee, startEditing])

  const initial = recipe
    ? { ...recipe, materials: recipe.materials.map((m) => ({ materialId: m.materialId, quantity: m.quantity, note: m.note })), steps: recipe.steps.map((s) => s.instruction) }
    : { brewMethod: 'PHIN', materials: [{}], steps: [''] }

  const close = () => { setEditing(false); onClose() }

  return (
    <Drawer open={!!coffee} onClose={close} width={640} title={`Công thức · ${coffee?.name ?? ''}`} destroyOnHidden
      extra={editable && !editing && !isLoading && (
        <Button type="primary" icon={recipe ? <EditOutlined /> : <PlusOutlined />} onClick={() => setEditing(true)}>
          {!recipe ? 'Tạo công thức' : recipe.active ? 'Sửa công thức' : `Sửa ${label(recipe).toLowerCase()}`}
        </Button>
      )}>
      {isLoading ? <Spin /> : editing ? (
        <Form form={form} key={recipe?.id ?? 'new'} layout="vertical" initialValues={initial}
          onFinish={(v) => save.mutate({ ...v, activate: true }, { onSuccess: () => { setEditing(false); setViewId(undefined) } })}>
          <div className="a-grid-2">
            <Form.Item name="brewMethod" label="Cách pha"><Select options={BREW_METHOD} /></Form.Item>
            <Form.Item name="brewTimeMin" label="Thời gian pha (phút)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <h4>Định lượng nguyên liệu (cho 1 ly)</h4>
          <Form.List name="materials" rules={[{ validator: async (_, v) => { if (!v?.length) throw new Error('Cần ít nhất 1 nguyên liệu') } }]}>
            {(fields, { add, remove: rm }, { errors }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} align="baseline" style={{ display: 'flex' }}>
                    <Form.Item name={[f.name, 'materialId']} rules={[{ required: true, message: 'Chọn' }]} style={{ width: 220 }}>
                      <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu" options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'quantity']} rules={[{ required: true, message: 'Nhập' }]}>
                      <InputNumber min={0.01} placeholder="Số lượng" />
                    </Form.Item>
                    <Form.Item name={[f.name, 'note']}><Input placeholder="Ghi chú" /></Form.Item>
                    <MinusCircleOutlined onClick={() => rm(f.name)} />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Thêm nguyên liệu</Button>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
          <h4 style={{ marginTop: 16 }}>Các bước pha chế</h4>
          <SortableSteps name="steps" />
          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => (recipe ? setEditing(false) : close())}>Hủy</Button>
            {recipe?.active && (
              <Button loading={saveDraft.isPending} onClick={() => form.validateFields().then((v: RecipePayload) =>
                saveDraft.mutate(v, { onSuccess: (r) => { setEditing(false); setViewId(r.id) } }))}>Lưu thành bản nháp</Button>
            )}
            {recipe && !recipe.active && (
              <Button loading={save.isPending} onClick={() => form.validateFields().then((v: RecipePayload) =>
                save.mutate({ ...v, activate: false }, { onSuccess: () => setEditing(false) }))}>Lưu nháp</Button>
            )}
            <Button type="primary" htmlType="submit" loading={save.isPending}>{recipe && !recipe.active ? 'Lưu & áp dụng' : 'Lưu công thức'}</Button>
          </Space>
        </Form>
      ) : !recipe ? (
        <Empty description="Món chưa có công thức — cần tạo công thức để pha chế và trừ kho khi bán" />
      ) : (
        <>
          {drafts.length > 0 && (
            <Space wrap style={{ marginBottom: 12 }}>
              {[...(active ? [active] : []), ...drafts].map((r: Recipe) => (
                <Button key={r.id} size="small" type={r.id === recipe.id ? 'primary' : 'default'} onClick={() => setViewId(r.id)}>
                  {label(r)} · v{r.version}
                </Button>
              ))}
            </Space>
          )}
          {!recipe.active && editable && (
            <Space wrap style={{ marginBottom: 12 }}>
              <Popconfirm title="Áp dụng công thức này?" description="Món sẽ pha và trừ kho theo bản này; công thức đang dùng thành bản cũ."
                onConfirm={() => apply.mutate(recipe.id, { onSuccess: () => setViewId(undefined) })}>
                <Button type="primary" loading={apply.isPending}>{isOld(recipe) ? 'Áp dụng lại' : 'Áp dụng'}</Button>
              </Popconfirm>
              <Popconfirm title={isOld(recipe) ? 'Xóa bản cũ?' : 'Xóa bản nháp?'} onConfirm={() => remove.mutate(recipe.id, { onSuccess: () => setViewId(undefined) })}>
                <Button danger loading={remove.isPending}>{isOld(recipe) ? 'Xóa bản cũ' : 'Xóa nháp'}</Button>
              </Popconfirm>
              {recipe.updatedAt && <span className="a-muted small">Sửa lần cuối {dateTime(recipe.updatedAt)}</span>}
            </Space>
          )}
          <Descriptions size="small" column={2} items={[
            { key: 'm', label: 'Cách pha', children: BREW_METHOD.find((b) => b.value === recipe.brewMethod)?.label ?? recipe.brewMethod ?? '—' },
            { key: 't', label: 'Thời gian pha', children: recipe.brewTimeMin ? `${recipe.brewTimeMin} phút` : '—' },
          ]} />
          {recipe.description && <p>{recipe.description}</p>}
          <h4>Định lượng nguyên liệu (cho 1 ly)</h4>
          <div className="a-recipe-mats">
            {recipe.materials.map((m) => <Tag key={m.materialId}>{m.materialName}: {m.quantity} {m.unit}{m.note && ` · ${m.note}`}</Tag>)}
          </div>
          <h4 style={{ marginTop: 16 }}>Các bước pha chế</h4>
          {recipe.steps.length ? <ol className="a-steps">{recipe.steps.map((s) => <li key={s.stepNo}>{s.instruction}</li>)}</ol> : <span className="a-muted">Chưa có bước nào</span>}
        </>
      )}
    </Drawer>
  )
}
