import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, AutoComplete, Button, Checkbox, Form, Input, Modal, Popconfirm, Radio, Tag, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, EnvironmentFilled, PlusOutlined } from '@ant-design/icons'
import { accountApi, type SavedAddress } from '@/api/auth'
import { publicApi } from '@/api/public'
import { useDebounced } from '@/lib/useDebounced'
import { errorMessage } from '@/api/client'
import { VnAddressInput } from '@/components/VnAddressInput'
import { isCompleteVnAddress, vnAddressRule } from '@/lib/vnAddress'
import { useDeliveryArea } from '@/lib/useDeliveryArea'

/** địa chỉ giao của đơn: từ sổ địa chỉ ({@code id}) hoặc nhập cho riêng đơn này */
export interface DeliveryPick { id?: number; label?: string; recipientName: string; recipientPhone: string; address: string; isDefault?: boolean }

type FormValues = { recipientName: string; recipientPhone: string; address: string; label?: string; isDefault?: boolean }

/**
 * Địa chỉ nhận hàng kiểu Shopee: một khối tóm tắt + "Thay đổi" → danh sách địa chỉ đã lưu (chọn, sửa, xóa, thêm mới).
 * Khách chưa đăng nhập: chỉ nhập địa chỉ cho đơn này (không lưu sổ).
 */
export function AddressBook({ value, onChange, loggedIn, prefill }: {
  value?: DeliveryPick; onChange: (v?: DeliveryPick) => void; loggedIn: boolean; prefill?: { recipientName?: string; recipientPhone?: string }
}) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const { data: saved = [] } = useQuery({ queryKey: ['account-addresses'], queryFn: accountApi.addresses, enabled: loggedIn, staleTime: 60_000 })
  const [listOpen, setListOpen] = useState(false)
  const [choice, setChoice] = useState<number>()
  const [editing, setEditing] = useState<Partial<DeliveryPick> | null>(null)
  const [form] = Form.useForm<FormValues>()
  const { data: shop } = useQuery({ queryKey: ['delivery-settings-public'], queryFn: publicApi.deliverySettings, staleTime: 5 * 60_000 })

  // chưa chọn gì: lấy địa chỉ mặc định
  const filled = useRef(false)
  useEffect(() => {
    if (filled.current || value || !saved.length) return
    filled.current = true
    onChange(saved.find((a) => a.isDefault) ?? saved[0])
  }, [saved, value, onChange])

  const save = useMutation({
    mutationFn: (v: FormValues & { id?: number }) => accountApi.saveAddress({ ...v, isDefault: !!v.isDefault }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['account-addresses'] })
      setChoice(a.id)
      // mở từ danh sách: chỉ đánh dấu chọn (bấm Xác nhận); mở từ khối tóm tắt hoặc sửa địa chỉ đang dùng: áp dụng luôn
      if (!listOpen || value?.id === a.id) onChange(a)
      setEditing(null)
    },
    onError: (e) => message.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: accountApi.deleteAddress,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['account-addresses'] })
      if (value?.id === id) onChange(undefined)
    },
    onError: (e) => message.error(errorMessage(e)),
  })

  const openForm = (a?: Partial<DeliveryPick>) => {
    setEditing(a ?? {})
    form.resetFields()
    form.setFieldsValue(a?.address != null ? { ...a } as FormValues
      : { recipientName: prefill?.recipientName, recipientPhone: prefill?.recipientPhone, isDefault: !saved.length } as FormValues)
  }
  const change = () => {
    if (loggedIn && saved.length) {
      setChoice(value?.id)
      setListOpen(true)
    } else openForm(value)
  }
  const submitForm = (v: FormValues) => {
    if (loggedIn) save.mutate({ ...v, id: editing?.id })
    else {
      onChange({ ...v })
      setEditing(null)
    }
  }

  return (
    <>
      {value ? (
        <Summary value={value} onChange={change} />
      ) : (
        <button type="button" className="g-btn-ghost" style={{ width: '100%' }} onClick={change}>
          <PlusOutlined style={{ marginRight: 6 }} /> {loggedIn && saved.length ? 'Chọn địa chỉ giao hàng' : 'Thêm địa chỉ giao hàng'}
        </button>
      )}

      <Modal open={listOpen} title="Địa chỉ của tôi" onCancel={() => setListOpen(false)} width={560} destroyOnHidden
        footer={<>
          <Button icon={<PlusOutlined />} style={{ float: 'left' }} onClick={() => openForm()}>Thêm địa chỉ mới</Button>
          <Button onClick={() => setListOpen(false)}>Hủy</Button>
          <Button type="primary" disabled={!choice} onClick={() => {
            const a = saved.find((x) => x.id === choice)
            if (a) onChange(a)
            setListOpen(false)
          }}>Xác nhận</Button>
        </>}>
        <Radio.Group value={choice} onChange={(e) => setChoice(e.target.value)} style={{ width: '100%' }}>
          {saved.map((a) => (
            <Row key={a.id} a={a} onEdit={() => openForm(a)} onDelete={() => remove.mutate(a.id)} />
          ))}
        </Radio.Group>
      </Modal>

      <Modal open={!!editing} title={editing?.id ? 'Cập nhật địa chỉ' : 'Địa chỉ mới'} onCancel={() => setEditing(null)} destroyOnHidden
        footer={<>
          <Button onClick={() => setEditing(null)}>Trở lại</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Hoàn thành</Button>
        </>}>
        <Form form={form} layout="vertical" onFinish={submitForm} requiredMark={false}>
          <div className="g-form-row">
            <Form.Item name="recipientName" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}><Input maxLength={100} /></Form.Item>
            <Form.Item name="recipientPhone" label="Số điện thoại"
              rules={[{ required: true, message: 'Nhập số điện thoại' }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
              <Input inputMode="tel" maxLength={15} />
            </Form.Item>
          </div>
          {shop?.shopAddress && <div className="g-muted" style={{ marginBottom: 8, fontSize: 13 }}>Quán: {shop.shopAddress}</div>}
          <Form.Item name="address" label="Địa chỉ" rules={[vnAddressRule('nơi nhận')]} style={{ marginBottom: 4 }}><VnAddressInput /></Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.address !== b.address}>
            {({ getFieldValue }) => <DistanceHint address={getFieldValue('address')} />}
          </Form.Item>
          {loggedIn && <>
            <Form.Item name="label" label="Loại địa chỉ">
              <AutoComplete options={['Nhà riêng', 'Văn phòng', 'Nhà bố mẹ'].map((x) => ({ value: x }))} placeholder="Nhà riêng" />
            </Form.Item>
            <Form.Item name="isDefault" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox disabled={!!editing?.isDefault}>Đặt làm địa chỉ mặc định</Checkbox>
            </Form.Item>
          </>}
        </Form>
      </Modal>
    </>
  )
}

/** dưới ô địa chỉ trong form: ngoài khu vực giao (biết ngay khi chọn phường) hoặc cách quán bao nhiêu km */
function DistanceHint({ address }: { address?: string }) {
  const area = useDeliveryArea(address)
  const full = useDebounced(isCompleteVnAddress(address) ? address : undefined, 600)
  const { data, isFetching, error } = useQuery({
    queryKey: ['delivery-distance', full], queryFn: () => publicApi.deliveryDistance(full!), enabled: !!full && !area?.outside,
    staleTime: 10 * 60_000, retry: false,
  })
  const red = { color: '#cf1322' }
  const max = data?.maxKm ?? area?.maxKm
  let text: React.ReactNode = null
  if (area?.outside || data?.outside) text = <span style={red}>Ngoài khu vực giao hàng{data ? ` (cách quán ${vn(data.km)} km` : ' ('}{data ? ', ' : ''}tối đa {vn(max ?? 0)} km)</span>
  else if (error) text = <span style={red}>{errorMessage(error)}</span>
  else if (data) text = <span className="g-muted">Cách quán {vn(data.km)} km</span>
  else if (isFetching) text = <span className="g-muted">Đang đo quãng đường…</span>
  return <div style={{ minHeight: 20, marginBottom: 16, fontSize: 13 }}>{text}</div>
}

const vn = (v: number) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/** khối tóm tắt ngoài trang đặt hàng */
function Summary({ value, onChange }: { value: DeliveryPick; onChange: () => void }) {
  const complete = isCompleteVnAddress(value.address)
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <EnvironmentFilled style={{ color: '#d4380d', marginTop: 4 }} />
      <div style={{ flex: 1 }}>
        <div><b>{value.recipientName}</b> <span className="g-muted">| {value.recipientPhone}</span></div>
        <div>{value.address}</div>
        <div style={{ marginTop: 4 }}>
          {value.label && <Tag>{value.label}</Tag>}
          {value.isDefault && <Tag color="volcano">Mặc định</Tag>}
          {!complete && <Tag color="red">Cần cập nhật tỉnh / phường</Tag>}
        </div>
      </div>
      <button type="button" onClick={onChange} style={{ border: 0, background: 'none', color: '#1677ff', cursor: 'pointer', font: 'inherit' }}>Thay đổi</button>
    </div>
  )
}

/** một dòng trong danh sách "Địa chỉ của tôi" */
function Row({ a, onEdit, onDelete }: { a: SavedAddress; onEdit: () => void; onDelete: () => void }) {
  const complete = isCompleteVnAddress(a.address)
  const area = useDeliveryArea(complete ? a.address : undefined)
  const out = !!area?.outside
  return (
    // Radio.Group sets font-size 0 on its content: give the row its own size
    <div style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14, lineHeight: 1.5 }}>
      <Radio value={a.id} disabled={out || !complete} style={{ marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ opacity: out ? 0.55 : 1 }}>
            <div><b>{a.recipientName}</b> <span className="g-muted">| {a.recipientPhone}</span></div>
            <div style={{ fontSize: 13, color: '#595959' }}>{a.address}</div>
          </div>
          <span style={{ whiteSpace: 'nowrap', display: 'flex', gap: 2 }}>
            <Tooltip title="Sửa"><Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} /></Tooltip>
            {!a.isDefault && (
              <Popconfirm title="Xóa địa chỉ này?" onConfirm={onDelete}>
                <Tooltip title="Xóa"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
              </Popconfirm>
            )}
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          {a.label && <Tag>{a.label}</Tag>}
          {a.isDefault && <Tag color="volcano">Mặc định</Tag>}
          {out && <Tag color="red">Ngoài khu vực giao</Tag>}
          {!complete && <Tag color="red">Cần cập nhật tỉnh / phường</Tag>}
        </div>
      </div>
    </div>
  )
}
