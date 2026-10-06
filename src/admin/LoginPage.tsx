import { useNavigate, useLocation, Link } from 'react-router-dom'
import { App, Button, Card, Form, Input } from 'antd'
import { LockOutlined, UserOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { errorMessage } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

/** Đăng nhập hệ thống quản trị (Quản lý / Nhân viên). Tài khoản khách hàng được chuyển về trang của khách. */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)
  const { message } = App.useApp()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname

  const login = useMutation({
    mutationFn: (v: { username: string; password: string }) => authApi.login(v.username, v.password),
    onSuccess: (r) => {
      setSession(r)
      const adminScreens = r.permissions.filter((p) => p.module !== 'customer' && p.path).sort((a, b) => a.sortOrder - b.sortOrder)
      if (!adminScreens.length) {
        message.info('Tài khoản khách hàng không có quyền quản trị')
        navigate('/account', { replace: true })
        return
      }
      navigate(from ?? adminScreens[0].path!, { replace: true })
    },
    onError: (e) => message.error(errorMessage(e, 'Sai tên đăng nhập hoặc mật khẩu')),
  })

  return (
    <div className="a-login">
      <Card className="a-login-card">
        <div className="a-login-brand">☕ <b>Coffeeholic</b><span>Hệ thống quản trị</span></div>
        <Form layout="vertical" onFinish={(v) => login.mutate(v)} requiredMark={false}>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={login.isPending}>Đăng nhập</Button>
        </Form>
        <Link to="/" className="a-login-back"><ArrowLeftOutlined /> Về trang gọi món</Link>
      </Card>
    </div>
  )
}
