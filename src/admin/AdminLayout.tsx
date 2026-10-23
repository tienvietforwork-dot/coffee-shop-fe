import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Dropdown, Grid, Layout, Menu, Tag, Tooltip, type MenuProps } from 'antd'
import {
  DashboardOutlined, ProfileOutlined, ShopOutlined, CarOutlined, WarningOutlined, CoffeeOutlined,
  AppstoreOutlined, ExperimentOutlined, InboxOutlined, HistoryOutlined, TableOutlined, TeamOutlined,
  UserOutlined, IdcardOutlined, MessageOutlined, CommentOutlined, ClusterOutlined, BarChartOutlined,
  GiftOutlined, TagsOutlined, FundOutlined, LineChartOutlined, LogoutOutlined, ArrowLeftOutlined,
  SafetyCertificateOutlined, KeyOutlined, ShoppingCartOutlined, SolutionOutlined, FileDoneOutlined, RollbackOutlined,
  WalletOutlined, AuditOutlined, ContainerOutlined, PercentageOutlined, DollarOutlined, ScheduleOutlined, FileSearchOutlined,
  CreditCardOutlined, EnvironmentOutlined, FileTextOutlined, NotificationOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { P, ROLE_LABEL, usePerm } from '@/lib/perm'
import { useRealtime } from './RealtimeProvider'
import { ChangePasswordModal } from './components/ChangePasswordModal'
import { AttendanceButton } from './components/AttendanceButton'

const { Sider, Header, Content } = Layout
type MenuItem = Required<MenuProps>['items'][number]

interface Entry { key: string; icon: ReactNode; label: string; perm: string }

const GROUPS: { label: string; items: Entry[] }[] = [
  {
    label: '', items: [{ key: '/admin', icon: <DashboardOutlined />, label: 'Tổng quan', perm: P.DASHBOARD }],
  },
  {
    label: 'Bán hàng & vận hành', items: [
      { key: '/admin/orders', icon: <ProfileOutlined />, label: 'Điều phối đơn hàng', perm: P.ORDERS },
      { key: '/admin/pos', icon: <ShopOutlined />, label: 'Order tại quầy', perm: P.POS },
      { key: '/admin/cash-shifts', icon: <DollarOutlined />, label: 'Ca thu ngân', perm: P.CASH_SHIFTS },
      { key: '/admin/payment-reconciliation', icon: <CreditCardOutlined />, label: 'Đối soát thanh toán', perm: P.PAYMENT_RECONCILIATION },
      { key: '/admin/invoices', icon: <FileTextOutlined />, label: 'Hóa đơn điện tử', perm: P.INVOICES },
      { key: '/admin/shipments', icon: <CarOutlined />, label: 'Giao hàng', perm: P.SHIPMENTS },
      { key: '/admin/delivery-zones', icon: <EnvironmentOutlined />, label: 'Khu vực giao hàng', perm: P.DELIVERY_ZONES },
      { key: '/admin/incidents', icon: <WarningOutlined />, label: 'Sự cố đơn hàng', perm: P.INCIDENTS },
      { key: '/admin/tables', icon: <TableOutlined />, label: 'Bàn & mã QR', perm: P.TABLES },
    ],
  },
  {
    label: 'Thực đơn & kho', items: [
      { key: '/admin/coffees', icon: <CoffeeOutlined />, label: 'Cà phê & công thức', perm: P.MENU },
      { key: '/admin/categories', icon: <AppstoreOutlined />, label: 'Danh mục', perm: P.CATEGORIES },
      { key: '/admin/coffee-costs', icon: <PercentageOutlined />, label: 'Giá vốn món', perm: P.COFFEE_COSTS },
      { key: '/admin/materials', icon: <ExperimentOutlined />, label: 'Nguyên liệu & lô', perm: P.MATERIALS },
      { key: '/admin/stock', icon: <InboxOutlined />, label: 'Nhập / xuất kho', perm: P.STOCK },
      { key: '/admin/stocktakes', icon: <AuditOutlined />, label: 'Kiểm kê kho', perm: P.STOCKTAKES },
      { key: '/admin/stock-history', icon: <HistoryOutlined />, label: 'Lịch sử kho', perm: P.STOCK_HISTORY },
      { key: '/admin/inventory-report', icon: <ContainerOutlined />, label: 'Xuất – nhập – tồn', perm: P.INVENTORY_REPORT },
    ],
  },
  {
    label: 'Mua hàng', items: [
      { key: '/admin/suppliers', icon: <SolutionOutlined />, label: 'Nhà cung cấp', perm: P.SUPPLIERS },
      { key: '/admin/purchase-orders', icon: <ShoppingCartOutlined />, label: 'Phiếu đặt hàng', perm: P.PURCHASE_ORDERS },
      { key: '/admin/goods-receipts', icon: <FileDoneOutlined />, label: 'Phiếu nhập kho', perm: P.STOCK },
      { key: '/admin/supplier-returns', icon: <RollbackOutlined />, label: 'Trả hàng nhập', perm: P.SUPPLIER_RETURNS },
      { key: '/admin/supplier-debts', icon: <WalletOutlined />, label: 'Công nợ nhà cung cấp', perm: P.SUPPLIER_DEBTS },
    ],
  },
  {
    label: 'Khách hàng', items: [
      { key: '/admin/crm/customers', icon: <IdcardOutlined />, label: 'Hồ sơ khách hàng', perm: P.CRM_CUSTOMERS },
      { key: '/admin/crm/interactions', icon: <MessageOutlined />, label: 'Tương tác & chăm sóc', perm: P.CRM_INTERACTIONS },
      { key: '/admin/crm/feedbacks', icon: <CommentOutlined />, label: 'Phản hồi & khiếu nại', perm: P.CRM_FEEDBACKS },
      { key: '/admin/crm/groups', icon: <ClusterOutlined />, label: 'Nhóm khách hàng', perm: P.CRM_GROUPS },
      { key: '/admin/crm/insights', icon: <BarChartOutlined />, label: 'Phân tích khách hàng', perm: P.CRM_INSIGHTS },
    ],
  },
  {
    label: 'Khuyến mãi', items: [
      { key: '/admin/promotions', icon: <GiftOutlined />, label: 'Đợt giảm giá', perm: P.PROMOTIONS },
      { key: '/admin/vouchers', icon: <TagsOutlined />, label: 'Voucher', perm: P.VOUCHERS },
      { key: '/admin/promotions/analytics', icon: <FundOutlined />, label: 'Hiệu quả khuyến mãi', perm: P.PROMOTIONS_ANALYTICS },
    ],
  },
  {
    label: 'Thống kê & hệ thống', items: [
      { key: '/admin/stats', icon: <LineChartOutlined />, label: 'Thống kê doanh thu', perm: P.STATS },
      { key: '/admin/staff', icon: <TeamOutlined />, label: 'Nhân viên', perm: P.STAFF },
      { key: '/admin/work-shifts', icon: <ScheduleOutlined />, label: 'Phân ca & chấm công', perm: P.WORK_SHIFTS },
      { key: '/admin/users', icon: <UserOutlined />, label: 'Tài khoản', perm: P.USERS },
      { key: '/admin/roles', icon: <SafetyCertificateOutlined />, label: 'Phân quyền', perm: P.ROLES },
      { key: '/admin/notifications', icon: <NotificationOutlined />, label: 'Tin nhắn khách hàng', perm: P.NOTIFICATIONS },
      { key: '/admin/audit-logs', icon: <FileSearchOutlined />, label: 'Nhật ký thao tác', perm: P.AUDIT_LOGS },
    ],
  },
]

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { can } = usePerm()
  const { connected } = useRealtime()
  const screens = Grid.useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)

  // Menu = only the screens this account has a permission for
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length)
  const items = groups.flatMap<MenuItem>((g) => {
    const children = g.items.map(({ key, icon, label }) => ({ key, icon, label }))
    return g.label ? [{ key: g.label, label: g.label, type: 'group' as const, children }] : children
  })
  const keys = groups.flatMap((g) => g.items.map((i) => i.key))
  const selected = keys
    .filter((k) => location.pathname === k || (k !== '/admin' && location.pathname.startsWith(k + '/')))
    .sort((a, b) => b.length - a.length)[0] ?? '/admin'

  return (
    <Layout className="admin" style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={screens.md ? 64 : 0}
        className="a-sider"
      >
        <Link to="/admin" className="a-brand">
          <span>☕</span>{!collapsed && <b>Coffeeholic</b>}
        </Link>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={(e) => navigate(e.key)} />
      </Sider>
      <Layout>
        <Header className="a-header">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            {screens.sm && 'Trang gọi món'}
          </Button>
          <div className="a-header-right">
            {user?.staffId && <AttendanceButton />}
            <Tooltip title={connected ? 'Đang nhận thông báo realtime' : 'Mất kết nối realtime'}>
              <Badge status={connected ? 'success' : 'default'} text={screens.sm ? (connected ? 'Trực tuyến' : 'Ngoại tuyến') : ''} />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  { key: 'pwd', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất' },
                ],
                onClick: (e) => {
                  if (e.key === 'pwd') setPwdOpen(true)
                  else { logout(); navigate('/admin/login') }
                },
              }}
            >
              <span className="a-user">
                <Avatar style={{ background: '#6f4e37' }}>{(user?.fullName || user?.username || '?')[0].toUpperCase()}</Avatar>
                {screens.sm && (
                  <span>
                    {user?.fullName || user?.username}
                    <small>{user?.roles.map((r) => ROLE_LABEL[r]?.text ?? r).join(', ')}</small>
                  </span>
                )}
                {!screens.sm && user?.roles[0] && <Tag>{ROLE_LABEL[user.roles[0]]?.text}</Tag>}
              </span>
            </Dropdown>
          </div>
        </Header>
        <Content className="a-content">
          <Outlet />
        </Content>
      </Layout>
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </Layout>
  )
}
