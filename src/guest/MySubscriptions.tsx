import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Empty, Modal, Popconfirm, Space, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { accountApi } from '@/api/auth'
import { publicApi } from '@/api/public'
import { errorMessage } from '@/api/client'
import type { Subscription, SubscriptionPayload, SubscriptionStatus } from '@/api/types'
import { dateTime, money } from '@/lib/format'
import { SubscriptionForm } from '@/components/SubscriptionForm'

const STATUS: Record<SubscriptionStatus, { text: string; color: string }> = {
  ACTIVE: { text: 'Đang giao', color: 'green' }, PAUSED: { text: 'Tạm dừng', color: 'gold' }, CANCELLED: { text: 'Đã hủy', color: 'default' },
}

/** Khách tự đăng ký / tạm dừng / hủy gói giao cà phê định kỳ (mỗi ngày hoặc theo thứ, giờ cố định, trả khi nhận). */
export function MySubscriptions({ name, phone }: { name?: string; phone?: string }) {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const { data = [], isLoading } = useQuery({ queryKey: ['account-subscriptions'], queryFn: accountApi.subscriptions })
  const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: publicApi.menu, staleTime: 5 * 60_000 })
  const coffees = (menu?.categories ?? []).flatMap((c) => c.coffees).map((c) => ({ id: c.id, name: c.name, price: c.salePrice ?? c.price }))
  const [edit, setEdit] = useState<Subscription | 'new' | null>(null)
  const done = (text: string) => ({
    onSuccess: () => { message.success(text); qc.invalidateQueries({ queryKey: ['account-subscriptions'] }) },
    onError: (e: unknown) => message.error(errorMessage(e)),
  })
  const save = useMutation({ mutationFn: (v: SubscriptionPayload & { id?: number }) => accountApi.saveSubscription(v), ...done('Đã lưu gói') })
  const status = useMutation({ mutationFn: (v: { id: number; s: SubscriptionStatus }) => accountApi.setSubscriptionStatus(v.id, v.s), ...done('Đã cập nhật') })

  return (
    <div>
      <p className="g-muted">Nhận cà phê mỗi ngày hoặc vào các thứ bạn chọn, đúng giờ cố định. Thanh toán khi nhận hàng.</p>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit('new')} style={{ marginBottom: 12 }}>Đăng ký gói mới</Button>
      {!isLoading && !data.length ? <Empty description="Bạn chưa có gói giao định kỳ" /> : (
        <ul className="g-order-list">
          {data.map((s) => (
            <li key={s.id} className="g-order-item" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{s.code} <Tag color={STATUS[s.status].color}>{STATUS[s.status].text}</Tag></strong>
                <span>~{money(s.itemsTotal)} / lần</span>
              </div>
              <div>{s.items.map((i) => `${i.quantity}× ${i.coffeeName}`).join(', ')}</div>
              <div className="g-muted">{s.schedule} · {s.address}</div>
              {s.nextDelivery && <div className="g-muted">Lần giao tới: <b>{dateTime(s.nextDelivery)}</b></div>}
              {s.status !== 'CANCELLED' && (
                <Space style={{ marginTop: 8 }} wrap>
                  <Button size="small" onClick={() => setEdit(s)}>Sửa</Button>
                  {s.status === 'ACTIVE'
                    ? <Button size="small" onClick={() => status.mutate({ id: s.id, s: 'PAUSED' })}>Tạm dừng</Button>
                    : <Button size="small" onClick={() => status.mutate({ id: s.id, s: 'ACTIVE' })}>Tiếp tục</Button>}
                  <Popconfirm title="Hủy gói này?" onConfirm={() => status.mutate({ id: s.id, s: 'CANCELLED' })}>
                    <Button size="small" danger>Hủy gói</Button>
                  </Popconfirm>
                </Space>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} title={edit && edit !== 'new' ? `Sửa gói ${edit.code}` : 'Đăng ký gói giao định kỳ'} footer={null}
        onCancel={() => setEdit(null)} destroyOnHidden width={680}>
        <SubscriptionForm initial={edit === 'new' ? null : edit} coffees={coffees} saving={save.isPending}
          prefill={{ recipientName: name, recipientPhone: phone }}
          onSubmit={(p) => save.mutate({ ...p, id: edit && edit !== 'new' ? edit.id : undefined }, { onSuccess: () => setEdit(null) })} />
      </Modal>
    </div>
  )
}
