import { Button, Card, Form, Input, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, CoffeeOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import type { LoginRequest } from '@/types'

const { Title, Text } = Typography

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const mutation = useMutation({
    mutationFn: (values: LoginRequest) => login(values),
    onSuccess: (data) => {
      setAuth(data.token, data.user)
      message.success(`Welcome back, ${data.user.fullName ?? data.user.username}!`)
      navigate('/', { replace: true })
    },
    onError: () => {
      message.error('Invalid username or password.')
    },
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #6f4e37 0%, #3b2a20 100%)',
      }}
    >
      <Card style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CoffeeOutlined style={{ fontSize: 40, color: '#6f4e37' }} />
          <Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>
            Coffee Shop Admin
          </Title>
          <Text type="secondary">Sign in to manage your shop</Text>
        </div>
        <Form layout="vertical" onFinish={(values) => mutation.mutate(values)}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username" size="large" autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={mutation.isPending}
            >
              Log in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
