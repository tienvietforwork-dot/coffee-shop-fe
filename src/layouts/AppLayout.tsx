import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Badge } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  AppstoreOutlined,
  TagsOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  CarOutlined,
  UserOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CoffeeOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useRealtime } from '@/realtime/RealtimeProvider'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Products' },
  { key: '/categories', icon: <TagsOutlined />, label: 'Categories' },
  { key: '/materials', icon: <DatabaseOutlined />, label: 'Materials' },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: 'Orders' },
  { key: '/shipping', icon: <CarOutlined />, label: 'Shipping' },
  { key: '/users', icon: <UserOutlined />, label: 'Users', adminOnly: true },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
]

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { connected } = useRealtime()

  const visibleItems = menuItems.filter((item) => !item.adminOnly || user?.role === 'ADMIN')

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => {
        logout()
        navigate('/login', { replace: true })
      },
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div
          style={{
            height: 48,
            margin: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            gap: 8,
          }}
        >
          <CoffeeOutlined />
          {!collapsed && <span>Coffee Admin</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleItems.map(({ key, icon, label }) => ({ key, icon, label }))}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            onClick={() => setCollapsed((c) => !c)}
            style={{ cursor: 'pointer', fontSize: 18 }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Space size="large">
            <Badge status={connected ? 'success' : 'default'} text={connected ? 'Live' : 'Offline'} />
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <Text>{user?.fullName ?? user?.username}</Text>
                <Text type="secondary">({user?.role})</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: '100%' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
