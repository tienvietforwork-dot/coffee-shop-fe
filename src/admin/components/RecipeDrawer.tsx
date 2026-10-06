import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Drawer, Empty, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Tag } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { coreApi, type RecipePayload } from '@/api/core'
import type { Coffee, Recipe } from '@/api/types'
import { useAction } from './useCrud'

const BREW = [{ value: 'PHIN', label: 'Phin' }, { value: 'MACHINE', label: 'Máy espresso' }, { value: 'COLD_BREW', label: 'Cold brew' }, { value: 'POUR_OVER', label: 'Pour over' }]

export function RecipeDrawer({ coffee, onClose, editable }: { coffee: Coffee | null; onClose: () => void; editable: boolean }) {
  const { data: recipes = [] } = useQuery({ queryKey: ['recipes', coffee?.id], queryFn: () => coreApi.recipes(coffee!.id), enabled: !!coffee })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials, enabled: !!coffee })
  const [edit, setEdit] = useState<Recipe | 'new' | null>(null)
  const keys = [['recipes', coffee?.id], ['coffees']]
  const save = useAction((v: RecipePayload & { id?: number }) => (v.id ? coreApi.updateRecipe(v.id, v) : coreApi.createRecipe(coffee!.id, v)), keys)
  const activate = useAction(coreApi.activateRecipe, keys, 'Đã áp dụng công thức')
  const remove = useAction(coreApi.deleteRecipe, keys, 'Đã xóa')

  const initial = edit && edit !== 'new'
    ? { ...edit, materials: edit.materials.map((m) => ({ materialId: m.materialId, quantity: m.quantity, note: m.note })), steps: edit.steps.map((s) => s.instruction) }
    : { brewMethod: 'PHIN', activate: true, materials: [{}], steps: [''] }

  return (
    <Drawer open={!!coffee} onClose={() => { setEdit(null); onClose() }} width={620} title={`Công thức · ${coffee?.name ?? ''}`}
      extra={editable && !edit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit('new')}>Phiên bản mới</Button>}>
      {edit ? (
        <Form layout="vertical" initialValues={initial} onFinish={(v) => save.mutate({ ...v, id: edit === 'new' ? undefined : edit.id }, { onSuccess: () => setEdit(null) })}>
          <div className="a-grid-2">
            <Form.Item name="brewMethod" label="Cách pha"><Select options={BREW} /></Form.Item>
            <Form.Item name="brewTimeMin" label="Thời gian pha (phút)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          <h4>Định lượng nguyên liệu (cho 1 ly)</h4>
          <Form.List name="materials">
            {(fields, { add, remove: rm }) => (
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
              </>
            )}
          </Form.List>
          <h4 style={{ marginTop: 16 }}>Các bước pha chế</h4>
          <Form.List name="steps">
            {(fields, { add, remove: rm }) => (
              <>
                {fields.map((f, i) => (
                  <Space key={f.key} align="baseline" style={{ display: 'flex' }}>
                    <b>{i + 1}.</b>
                    <Form.Item name={f.name} style={{ width: 480 }}><Input.TextArea autoSize placeholder="Mô tả thao tác" /></Form.Item>
                    <MinusCircleOutlined onClick={() => rm(f.name)} />
                  </Space>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add('')}>Thêm bước</Button>
              </>
            )}
          </Form.List>
          {edit === 'new' && <Form.Item name="activate" label="Áp dụng ngay" valuePropName="checked" style={{ marginTop: 16 }}><Switch /></Form.Item>}
          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => setEdit(null)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu công thức</Button>
          </Space>
        </Form>
      ) : recipes.length === 0 ? (
        <Empty description="Chưa có công thức — món sẽ không trừ kho khi bán" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {recipes.map((r) => (
            <Card key={r.id} size="small"
              title={<Space>v{r.version} · {BREW.find((b) => b.value === r.brewMethod)?.label ?? r.brewMethod} {r.brewTimeMin && `· ${r.brewTimeMin} phút`} {r.active && <Tag color="green">Đang áp dụng</Tag>}</Space>}
              extra={editable && (
                <Space>
                  {!r.active && <Button size="small" onClick={() => activate.mutate(r.id)}>Áp dụng</Button>}
                  <Button size="small" onClick={() => setEdit(r)}>Sửa</Button>
                  {!r.active && <Popconfirm title="Xóa phiên bản này?" onConfirm={() => remove.mutate(r.id)}><Button size="small" danger>Xóa</Button></Popconfirm>}
                </Space>
              )}>
              {r.description && <p>{r.description}</p>}
              <div className="a-recipe-mats">
                {r.materials.map((m) => <Tag key={m.materialId}>{m.materialName}: {m.quantity} {m.unit}</Tag>)}
              </div>
              <ol className="a-steps">{r.steps.map((s) => <li key={s.stepNo}>{s.instruction}</li>)}</ol>
            </Card>
          ))}
        </Space>
      )}
    </Drawer>
  )
}
