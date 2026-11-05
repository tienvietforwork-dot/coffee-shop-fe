import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Dropdown, Grid, Input, Layout, Menu, Tag, Tooltip, type MenuProps } from 'antd'
import {
  DashboardOutlined, ProfileOutlined, ShopOutlined, CarOutlined, WarningOutlined, CoffeeOutlined,
  AppstoreOutlined, ExperimentOutlined, TableOutlined, TeamOutlined,
  UserOutlined, IdcardOutlined, MessageOutlined, CommentOutlined, ClusterOutlined, BarChartOutlined,
  GiftOutlined, TagsOutlined, FundOutlined, LineChartOutlined, LogoutOutlined, ArrowLeftOutlined,
  SafetyCertificateOutlined, KeyOutlined, StarOutlined, SwapOutlined,
  DollarOutlined, ScheduleOutlined, FileSearchOutlined,
  CreditCardOutlined, EnvironmentOutlined, FileTextOutlined, NotificationOutlined, SearchOutlined,
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

const GROUPS: { label: string; icon: ReactNode; items: Entry[] }[] = [
  {
    label: '', icon: null, items: [{ key: '/admin', icon: <DashboardOutlined />, label: 'Tổng quan', perm: P.DASHBOARD }],
  },
  {
    label: 'Bán hàng & vận hành', icon: <ShopOutlined />, items: [
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
    label: 'Thực đơn', icon: <CoffeeOutlined />, items: [
      { key: '/admin/coffees', icon: <CoffeeOutlined />, label: 'Cà phê & công thức', perm: P.MENU },
      { key: '/admin/categories', icon: <AppstoreOutlined />, label: 'Danh mục', perm: P.CATEGORIES },
      { key: '/admin/product-placement', icon: <StarOutlined />, label: 'Trưng bày sản phẩm', perm: P.MENU },
      { key: '/admin/merchandising-analytics', icon: <BarChartOutlined />, label: 'Merchandising Analytics', perm: P.STATS },
      { key: '/admin/merchandising-schedule', icon: <StarOutlined />, label: 'Lịch trưng bày', perm: P.MENU },
      { key: '/admin/recommendation', icon: <StarOutlined />, label: 'Recommendation · Gợi ý', perm: P.MENU },
      { key: '/admin/upsell', icon: <SwapOutlined />, label: 'Upsell · Nâng cấp món', perm: P.MENU },
      { key: '/admin/cross-sell', icon: <SwapOutlined />, label: 'Cross-sell · Bán kèm', perm: P.MENU },
      { key: '/admin/product-bundles', icon: <GiftOutlined />, label: 'Combo sản phẩm', perm: P.MENU },
      { key: '/admin/materials', icon: <ExperimentOutlined />, label: 'Nguyên liệu', perm: P.MATERIALS },
    ],
  },
  {
    label: 'Khách hàng', icon: <TeamOutlined />, items: [
      { key: '/admin/crm/customers', icon: <IdcardOutlined />, label: 'Hồ sơ khách hàng', perm: P.CRM_CUSTOMERS },
      { key: '/admin/crm/interactions', icon: <MessageOutlined />, label: 'Tương tác & chăm sóc', perm: P.CRM_INTERACTIONS },
      { key: '/admin/crm/feedbacks', icon: <CommentOutlined />, label: 'Phản hồi & khiếu nại', perm: P.CRM_FEEDBACKS },
      { key: '/admin/crm/groups', icon: <ClusterOutlined />, label: 'Nhóm khách hàng', perm: P.CRM_GROUPS },
      { key: '/admin/crm/insights', icon: <BarChartOutlined />, label: 'Phân tích khách hàng', perm: P.CRM_INSIGHTS },
    ],
  },
  {
    label: 'Khuyến mãi', icon: <GiftOutlined />, items: [
      { key: '/admin/promotions', icon: <GiftOutlined />, label: 'Đợt giảm giá', perm: P.PROMOTIONS },
      { key: '/admin/vouchers', icon: <TagsOutlined />, label: 'Voucher', perm: P.VOUCHERS },
      { key: '/admin/promotions/analytics', icon: <FundOutlined />, label: 'Hiệu quả khuyến mãi', perm: P.PROMOTIONS_ANALYTICS },
    ],
  },
  {
    label: 'Thống kê & hệ thống', icon: <LineChartOutlined />, items: [
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

// Bo dau tieng Viet de tim "phan quyen" van ra "Phân quyền"
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

const groupKey = (label: string) => `group:${label}`

export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { can } = usePerm()
  const { connected } = useRealtime()
  const screens = Grid.useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [filter, setFilter] = useState('')

  // Menu = only the screens this account has a permission for
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length)

  // Loc menu theo tu khoa (khong phan biet dau); khop ten nhom thi giu ca nhom
  const q = fold(filter.trim())
  const shown = q
    ? groups
        .map((g) => ({ ...g, items: fold(g.label).includes(q) ? g.items : g.items.filter((i) => fold(i.label).includes(q)) }))
        .filter((g) => g.items.length)
    : groups
  // Moi nhom la mot submenu thu gon / mo rong duoc
  const items = shown.flatMap<MenuItem>((g) => {
    const children = g.items.map(({ key, icon, label }) => ({ key, icon, label }))
    return g.label ? [{ key: groupKey(g.label), icon: g.icon, label: g.label, children }] : children
  })
  const keys = groups.flatMap((g) => g.items.map((i) => i.key))
  const selected = keys
    .filter((k) => location.pathname === k || (k !== '/admin' && location.pathname.startsWith(k + '/')))
    .sort((a, b) => b.length - a.length)[0] ?? '/admin'

  // Nhom dang mo: mac dinh mo nhom chua man hinh hien tai; khi dang loc thi mo het nhom khop
  const currentGroup = groups.find((g) => g.label && g.items.some((i) => i.key === selected))?.label
  const [openKeys, setOpenKeys] = useState<string[]>(currentGroup ? [groupKey(currentGroup)] : [])
  useEffect(() => {
    if (!currentGroup) return
    const k = groupKey(currentGroup)
    setOpenKeys((prev) => (prev.includes(k) ? prev : [...prev, k]))
  }, [currentGroup])
  const menuOpenKeys = q ? shown.filter((g) => g.label).map((g) => groupKey(g.label)) : openKeys

  // Cuon menu toi muc dang mo (vd. vao thang /admin/roles)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const box = scrollRef.current
      const item = box?.querySelector<HTMLElement>('.ant-menu-item-selected')
      if (!box || !item) return
      const top = item.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
      if (top < box.scrollTop || top + item.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTop = top - (box.clientHeight - item.offsetHeight) / 2
      }
    })
    return () => cancelAnimationFrame(id)
  }, [selected, collapsed])

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
        {!collapsed && (
          <div className="a-menu-filter">
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Tìm chức năng…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                // Enter -> mo chuc nang dau tien khop
                const first = shown[0]?.items[0]
                if (e.key === 'Enter' && q && first) { navigate(first.key); setFilter('') }
              }}
            />
          </div>
        )}
        <div className="a-menu-scroll" ref={scrollRef}>
          <Menu
            mode="inline"
            inlineIndent={14}
            selectedKeys={[selected]}
            items={items}
            onClick={(e) => navigate(e.key)}
            {...(collapsed ? {} : { openKeys: menuOpenKeys, onOpenChange: (k: string[]) => { if (!q) setOpenKeys(k) } })}
          />
          {!items.length && <div className="a-menu-empty">Không có chức năng phù hợp</div>}
        </div>
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
