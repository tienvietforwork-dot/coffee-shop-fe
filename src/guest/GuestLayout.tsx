import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Dropdown, Tooltip } from 'antd'
import { ShoppingOutlined, SettingOutlined, EnvironmentOutlined, CloseOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useCart } from './useCart'
import { CartDrawer } from './CartDrawer'
import { AuthModal } from './AuthModal'
import { useGuestStore } from '@/store/guestStore'
import { useAuthStore } from '@/store/authStore'
import { usePerm } from '@/lib/perm'

export function GuestLayout() {
  const [cartOpen, setCartOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { count } = useCart()
  const { tableNo, setTable, setCart } = useGuestStore()
  const { isAuthenticated, user, logout } = useAuthStore()
  const { hasAdminAccess } = usePerm()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const leaveTable = () => {
    setTable(null, null)
    setCart(null)
  }

  return (
    <div className="guest">
      <header className="g-header">
        <div className="g-container g-header-inner">
          <Link to="/" className="g-logo">
            <span className="g-logo-mark">☕</span>
            <span>Coffeeholic</span>
          </Link>
          <nav className="g-nav">
            <NavLink to="/" end>Thực đơn</NavLink>
            <NavLink to="/orders">Đơn của tôi</NavLink>
            <NavLink to="/feedback">Góp ý</NavLink>
          </nav>
          <div className="g-header-actions">
            {tableNo && (
              <span className="g-table-chip">
                <EnvironmentOutlined /> Bàn {tableNo}
                <Tooltip title="Rời bàn (đặt mang về / giao hàng)">
                  <CloseOutlined className="g-table-chip-x" onClick={leaveTable} />
                </Tooltip>
              </span>
            )}
            <Tooltip title="Hệ thống quản trị (Quản lý / Nhân viên)">
              <Button className="g-admin-btn" icon={<SettingOutlined />} onClick={() => navigate('/admin')}>
                <span className="g-hide-sm">Quản trị</span>
              </Button>
            </Tooltip>
            {isAuthenticated ? (
              <Dropdown menu={{
                items: [
                  hasAdminAccess
                    ? { key: 'admin', icon: <SettingOutlined />, label: 'Vào hệ thống quản trị' }
                    : { key: 'account', icon: <UserOutlined />, label: 'Tài khoản của tôi' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất' },
                ],
                onClick: (e) => {
                  if (e.key === 'logout') { logout(); qc.clear(); navigate('/') } else navigate(e.key === 'admin' ? '/admin' : '/account')
                },
              }}>
                <Avatar className="g-avatar">{(user?.fullName || user?.username || '?')[0].toUpperCase()}</Avatar>
              </Dropdown>
            ) : (
              <Button className="g-admin-btn" icon={<UserOutlined />} onClick={() => setAuthOpen(true)}>
                <span className="g-hide-sm">Đăng nhập</span>
              </Button>
            )}
            <Badge count={count} size="small" offset={[-4, 4]}>
              <Button type="primary" shape="round" icon={<ShoppingOutlined />} onClick={() => setCartOpen(true)}>
                <span className="g-hide-sm">Giỏ hàng</span>
              </Button>
            </Badge>
          </div>
        </div>
      </header>

      <main>
        <Outlet context={{ openCart: () => setCartOpen(true) }} />
      </main>

      {count > 0 && (
        <button className="g-fab" onClick={() => setCartOpen(true)}>
          <ShoppingOutlined /> {count} món · Xem giỏ
        </button>
      )}

      <footer className="g-footer">
        <div className="g-container g-footer-inner">
          <div>
            <div className="g-logo g-logo-light"><span className="g-logo-mark">☕</span> Coffeeholic</div>
            <p>Cà phê rang mộc mỗi ngày · 7:00 – 22:00</p>
          </div>
          <div className="g-footer-links">
            <Link to="/orders">Tra cứu đơn</Link>
            <Link to="/feedback">Gửi góp ý</Link>
            <Link to="/admin">Dành cho nhân viên</Link>
          </div>
        </div>
      </footer>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
