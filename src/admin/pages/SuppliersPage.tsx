import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Segmented, Select, Space, Table, Tag } from 'antd'
import { MinusCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { coreApi, type SupplierPayload } from '@/api/core'
import type { Supplier, SupplierStatus } from '@/api/types'
import { SUPPLIER_STATUS, money, num, options } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { MoneyInput } from '../components/MoneyInput'
import { useAction } from '../components/useCrud'

/** loose = bought in the material's own unit */
const LOOSE = 0

type Line = { materialId?: number; packageId?: number; price?: number }

/**
 * Nhà cung cấp + the materials each one sells (usual packaging, reference price). "Ngừng hợp tác" keeps the
 * supplier for old purchase orders and receipts, it just can no longer be picked for new ones.
 */
export function SuppliersPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: coreApi.suppliers })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const raws = materials.filter((m) => m.kind === 'RAW')
  const [status, setStatus] = useState<SupplierStatus | 'ALL'>('ACTIVE')
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const rows = data.filter((s) => (status === 'ALL' || s.status === status)
    && (!q || [s.name, s.contactName, s.phone].some((v) => v?.toLowerCase().includes(q))
      || s.materials.some((m) => m.materialName.toLowerCase().includes(q))))

  const [edit, setEdit] = useState<Partial<Supplier> | null>(null)
  const [form] = Form.useForm()
  const lines = (Form.useWatch('materials', form) ?? []) as Line[]
  const save = useAction((v: SupplierPayload & { id?: number }) => (v.id ? coreApi.updateSupplier(v.id, v) : coreApi.createSupplier(v)), [['suppliers']])
  const stop = useAction(coreApi.deleteSupplier, [['suppliers']], 'Đã ngừng hợp tác')

  const sizeOf = (materialId?: number, packageId?: number) =>
    raws.find((m) => m.id === materialId)?.packages?.find((p) => p.id === packageId)?.size
  const open = (s: Partial<Supplier>) => {
    setEdit(s)
    form.resetFields()
    form.setFieldsValue({
      ...s,
      // the form asks the price of one package (or one unit when loose); stored per unit of the material
      materials: s.materials?.map((m) => ({
        materialId: m.materialId, packageId: m.packageId ?? LOOSE,
        price: m.unitPrice == null ? undefined : Math.round(m.unitPrice * (m.packageSize ?? 1)),
      })) ?? [],
    })
  }
  const submit = (v: Omit<SupplierPayload, 'materials'> & { materials?: Line[] }) => save.mutate({
    ...v,
    id: edit?.id,
    materials: (v.materials ?? []).filter((l) => l.materialId).map((l) => {
      const pkg = l.packageId && l.packageId !== LOOSE ? l.packageId : undefined
      const size = sizeOf(l.materialId, pkg) ?? 1
      return { materialId: l.materialId!, packageId: pkg, unitPrice: l.price == null ? undefined : Math.round((l.price / size) * 100) / 100 }
    }),
  }, { onSuccess: () => setEdit(null) })

  return (
    <>
      <PageHeader title="Nhà cung cấp" subtitle="Nơi mua nguyên liệu · giá tham khảo dùng để gợi ý khi lập phiếu đặt hàng"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open({ status: 'ACTIVE', paymentTermDays: 0, materials: [] })}>Thêm nhà cung cấp</Button>} />
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear prefix={<SearchOutlined />} placeholder="Tên, SĐT, nguyên liệu" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} />
        <Segmented value={status} onChange={(v) => setStatus(v as SupplierStatus | 'ALL')} options={[
          { value: 'ACTIVE', label: `Đang hợp tác (${data.filter((s) => s.status === 'ACTIVE').length})` },
          { value: 'INACTIVE', label: 'Ngừng hợp tác' },
          { value: 'ALL', label: 'Tất cả' },
        ]} />
      </Space>
      <Table<Supplier> rowKey="id" loading={isLoading} dataSource={rows} scroll={{ x: 900 }}
        columns={[
          { title: 'Nhà cung cấp', dataIndex: 'name', render: (v, s) => <><b>{v}</b>{s.contactName && <div className="a-muted small">Liên hệ: {s.contactName}</div>}</> },
          { title: 'Điện thoại', dataIndex: 'phone', render: (v) => v ?? '—' },
          { title: 'Thanh toán', dataIndex: 'paymentTermDays', render: (v: number) => (v ? `Nợ ${v} ngày` : 'Trả ngay') },
          { title: 'Địa chỉ', dataIndex: 'address', render: (v) => v ?? '—' },
          {
            title: 'Nguyên liệu cung cấp', render: (_, s) => (s.materials.length
              ? <div className="a-used-in">{s.materials.map((m) => (
                <Tag key={m.materialId}>{m.materialName}{m.unitPrice != null && ` · ${money(m.unitPrice * (m.packageSize ?? 1))}/${m.packageName?.toLowerCase() ?? m.unit}`}</Tag>
              ))}</div>
              : <span className="a-muted">—</span>),
          },
          { title: 'Trạng thái', render: (_, s) => <StatusTag label={SUPPLIER_STATUS[s.status]} /> },
          {
            title: '', render: (_, s) => (
              <Space>
                <Button size="small" onClick={() => open(s)}>Sửa</Button>
                {s.status === 'ACTIVE' && (
                  <Popconfirm title="Ngừng hợp tác với nhà cung cấp này?" description="Phiếu cũ vẫn giữ nguyên; không chọn được khi lập phiếu mới."
                    onConfirm={() => stop.mutate(s.id)}>
                    <Button size="small" danger>Ngừng hợp tác</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]} />

      <Modal open={!!edit} width={820} title={edit?.id ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'} footer={null} onCancel={() => setEdit(null)} forceRender>
        <Form form={form} layout="vertical" onFinish={submit}>
          <div className="a-grid-2">
            <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="contactName" label="Người liên hệ"><Input /></Form.Item>
            <Form.Item name="phone" label="Điện thoại"><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item>
            <Form.Item name="taxCode" label="Mã số thuế"><Input /></Form.Item>
            <Form.Item name="paymentTermDays" label="Điều khoản thanh toán" tooltip="Số ngày được nợ kể từ ngày nhận hàng; 0 = trả ngay khi nhận">
              <InputNumber min={0} max={365} style={{ width: '100%' }} addonAfter="ngày" />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái"><Select options={options(SUPPLIER_STATUS)} /></Form.Item>
          </div>
          <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input placeholder="Lịch giao, điều kiện thanh toán…" /></Form.Item>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>Nguyên liệu cung cấp</div>
          <Form.List name="materials">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => {
                  const line = lines[f.name] ?? {}
                  const material = raws.find((m) => m.id === line.materialId)
                  const pkg = material?.packages?.find((p) => p.id === line.packageId)
                  return (
                    <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.4fr 32px', gap: 8, alignItems: 'start' }}>
                      <Form.Item name={[f.name, 'materialId']} rules={[{ required: true, message: 'Chọn nguyên liệu' }]}>
                        <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu"
                          onChange={(id) => form.setFieldValue(['materials', f.name, 'packageId'], raws.find((m) => m.id === id)?.packages?.[0]?.id ?? LOOSE)}
                          options={raws.map((m) => ({
                            value: m.id, label: m.name,
                            disabled: lines.some((l, i) => i !== f.name && l?.materialId === m.id),
                          }))} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'packageId']} initialValue={LOOSE}>
                        <Select options={[
                          ...(material?.packages ?? []).map((p) => ({ value: p.id, label: `${p.name} (${num(p.size)} ${material!.unit})` })),
                          { value: LOOSE, label: `Lẻ (${material?.unit ?? 'đơn vị gốc'})` },
                        ]} />
                      </Form.Item>
                      <Form.Item name={[f.name, 'price']}>
                        <MoneyInput placeholder={`Giá / ${pkg?.name.toLowerCase() ?? material?.unit ?? 'đơn vị'}`} />
                      </Form.Item>
                      <Button type="text" icon={<MinusCircleOutlined />} onClick={() => remove(f.name)} />
                    </div>
                  )
                })}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ packageId: LOOSE })} style={{ marginBottom: 16 }}>
                  Thêm nguyên liệu
                </Button>
              </>
            )}
          </Form.List>
          <Button type="primary" htmlType="submit" block loading={save.isPending}>Lưu</Button>
        </Form>
      </Modal>
    </>
  )
}
