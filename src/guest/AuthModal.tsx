import { useState } from 'react'
import { App, Form, Input, Modal, Segmented } from 'antd'
import { LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useGuestStore } from '@/store/guestStore'

/** Đăng nhập / đăng ký tùy chọn cho khách – không bắt buộc để đặt món. */
export function AuthModal({ open, onClose, initialMode = 'login' }: { open: boolean; onClose: () => void; initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const setSession = useAuthStore((s) => s.setSession)
  const setContact = useGuestStore((s) => s.setContact)
  const qc = useQueryClient()
  const { message } = App.useApp()

  const done = (r: Awaited<ReturnType<typeof authApi.login>>) => {
    setSession(r)
    setContact(r.user.fullName ?? '', r.user.phone ?? r.user.username)
    qc.invalidateQueries()
    message.success(`Xin chào ${r.user.fullName || r.user.username}!`)
    onClose()
  }
  const login = useMutation({
    mutationFn: (v: { username: string; password: string }) => authApi.login(v.username.trim(), v.password),
    onSuccess: done,
    onError: (e) => message.error(errorMessage(e, 'Sai số điện thoại hoặc mật khẩu')),
  })
  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: done,
    onError: (e) => message.error(errorMessage(e)),
  })

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={420} centered destroyOnHidden className="g-auth">
      <h3 className="g-auth-title">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h3>
      <p className="g-muted">Theo dõi đơn hàng, tích điểm và dùng voucher của bạn. Không đăng nhập vẫn đặt món bình thường.</p>
      <Segmented block value={mode} onChange={(v) => setMode(v as 'login' | 'register')} style={{ margin: '12px 0 16px' }}
        options={[{ value: 'login', label: 'Đăng nhập' }, { value: 'register', label: 'Đăng ký' }]} />
      {mode === 'login' ? (
        <Form layout="vertical" requiredMark={false} onFinish={(v) => login.mutate(v)}>
          <Form.Item name="username" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
            <Input prefix={<PhoneOutlined />} inputMode="tel" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <button className="g-cta g-cta-block" type="submit" disabled={login.isPending}>Đăng nhập</button>
        </Form>
      ) : (
        <Form layout="vertical" requiredMark={false} onFinish={(v) => register.mutate(v)}>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}
            extra="Nếu bạn từng đặt món bằng số này, lịch sử và điểm sẽ được giữ nguyên">
            <Input prefix={<PhoneOutlined />} inputMode="tel" autoComplete="username" />
          </Form.Item>
          <Form.Item name="fullName" label="Họ tên"><Input maxLength={100} /></Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <button className="g-cta g-cta-block" type="submit" disabled={register.isPending}>Tạo tài khoản</button>
        </Form>
      )}
    </Modal>
  )
}
