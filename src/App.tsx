import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { GuestLayout } from '@/guest/GuestLayout'
import { MenuPage } from '@/guest/MenuPage'
import { CheckoutPage } from '@/guest/CheckoutPage'
import { OrderTrackingPage } from '@/guest/OrderTrackingPage'
import { MyOrdersPage } from '@/guest/MyOrdersPage'
import { TableEntryPage } from '@/guest/TableEntryPage'
import { FeedbackPage } from '@/guest/FeedbackPage'
import { AdminLayout } from '@/admin/AdminLayout'
import { LoginPage } from '@/admin/LoginPage'
import { AdminHome, Guard, RequireAdmin } from '@/admin/ProtectedRoute'
import { AccountPage } from '@/guest/AccountPage'
import { RealtimeProvider } from '@/admin/RealtimeProvider'
const DashboardPage = lazy(() => import('@/admin/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OrdersBoardPage = lazy(() => import('@/admin/pages/OrdersBoardPage').then((m) => ({ default: m.OrdersBoardPage })))
const PosPage = lazy(() => import('@/admin/pages/PosPage').then((m) => ({ default: m.PosPage })))
const ShipmentsPage = lazy(() => import('@/admin/pages/ShipmentsPage').then((m) => ({ default: m.ShipmentsPage })))
const IncidentsPage = lazy(() => import('@/admin/pages/IncidentsPage').then((m) => ({ default: m.IncidentsPage })))
const CoffeesPage = lazy(() => import('@/admin/pages/CoffeesPage').then((m) => ({ default: m.CoffeesPage })))
const CategoriesPage = lazy(() => import('@/admin/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const MaterialsPage = lazy(() => import('@/admin/pages/MaterialsPage').then((m) => ({ default: m.MaterialsPage })))
const StockPage = lazy(() => import('@/admin/pages/StockPage').then((m) => ({ default: m.StockPage })))
const StockHistoryPage = lazy(() => import('@/admin/pages/StockHistoryPage').then((m) => ({ default: m.StockHistoryPage })))
const TablesPage = lazy(() => import('@/admin/pages/TablesPage').then((m) => ({ default: m.TablesPage })))
const StaffPage = lazy(() => import('@/admin/pages/StaffPage').then((m) => ({ default: m.StaffPage })))
const RolesPage = lazy(() => import('@/admin/pages/RolesPage').then((m) => ({ default: m.RolesPage })))
const UsersPage = lazy(() => import('@/admin/pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const StatsPage = lazy(() => import('@/admin/pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const CustomersPage = lazy(() => import('@/admin/pages/crm/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const InteractionsPage = lazy(() => import('@/admin/pages/crm/InteractionsPage').then((m) => ({ default: m.InteractionsPage })))
const FeedbacksPage = lazy(() => import('@/admin/pages/crm/FeedbacksPage').then((m) => ({ default: m.FeedbacksPage })))
const GroupsPage = lazy(() => import('@/admin/pages/crm/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const InsightsPage = lazy(() => import('@/admin/pages/crm/InsightsPage').then((m) => ({ default: m.InsightsPage })))
const PromotionsPage = lazy(() => import('@/admin/pages/promotions/PromotionsPage').then((m) => ({ default: m.PromotionsPage })))
const VouchersPage = lazy(() => import('@/admin/pages/promotions/VouchersPage').then((m) => ({ default: m.VouchersPage })))
const PromotionAnalyticsPage = lazy(() => import('@/admin/pages/promotions/PromotionAnalyticsPage').then((m) => ({ default: m.PromotionAnalyticsPage })))

dayjs.locale('vi')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
})

const theme = {
  token: {
    colorPrimary: '#6f4e37',
    colorLink: '#8a5a3b',
    borderRadius: 10,
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
}

export default function App() {
  return (
    <ConfigProvider theme={theme} locale={viVN}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              {/* Guest ordering site – no login */}
              <Route element={<GuestLayout />}>
                <Route path="/" element={<MenuPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:code" element={<OrderTrackingPage />} />
                <Route path="/orders" element={<MyOrdersPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/account" element={<AccountPage />} />
              </Route>
              <Route path="/t/:qr" element={<TableEntryPage />} />

              {/* Admin system */}
              <Route path="/admin/login" element={<LoginPage />} />
              <Route element={<RequireAdmin />}>
                <Route element={<RealtimeProvider><AdminLayout /></RealtimeProvider>}>
                  <Route element={<Suspense fallback={<div className="a-center"><Spin /></div>}><Outlet /></Suspense>}>
                  <Route path="/admin" element={<AdminHome><DashboardPage /></AdminHome>} />
                  <Route path="/admin/orders" element={<Guard perm="orders"><OrdersBoardPage /></Guard>} />
                  <Route path="/admin/pos" element={<Guard perm="pos"><PosPage /></Guard>} />
                  <Route path="/admin/shipments" element={<Guard perm="shipments"><ShipmentsPage /></Guard>} />
                  <Route path="/admin/incidents" element={<Guard perm="incidents"><IncidentsPage /></Guard>} />
                  <Route path="/admin/coffees" element={<Guard perm="menu"><CoffeesPage /></Guard>} />
                  <Route path="/admin/categories" element={<Guard perm="categories"><CategoriesPage /></Guard>} />
                  <Route path="/admin/materials" element={<Guard perm="materials"><MaterialsPage /></Guard>} />
                  <Route path="/admin/stock" element={<Guard perm="stock"><StockPage /></Guard>} />
                  <Route path="/admin/stock-history" element={<Guard perm="stock-history"><StockHistoryPage /></Guard>} />
                  <Route path="/admin/tables" element={<Guard perm="tables"><TablesPage /></Guard>} />
                  <Route path="/admin/crm/customers" element={<Guard perm="crm.customers"><CustomersPage /></Guard>} />
                  <Route path="/admin/crm/interactions" element={<Guard perm="crm.interactions"><InteractionsPage /></Guard>} />
                  <Route path="/admin/crm/feedbacks" element={<Guard perm="crm.feedbacks"><FeedbacksPage /></Guard>} />
                  <Route path="/admin/crm/groups" element={<Guard perm="crm.groups"><GroupsPage /></Guard>} />
                  <Route path="/admin/crm/insights" element={<Guard perm="crm.insights"><InsightsPage /></Guard>} />
                  <Route path="/admin/promotions" element={<Guard perm="promotions"><PromotionsPage /></Guard>} />
                  <Route path="/admin/vouchers" element={<Guard perm="vouchers"><VouchersPage /></Guard>} />
                  <Route path="/admin/promotions/analytics" element={<Guard perm="promotions.analytics"><PromotionAnalyticsPage /></Guard>} />
                  <Route path="/admin/stats" element={<Guard perm="stats"><StatsPage /></Guard>} />
                  <Route path="/admin/staff" element={<Guard perm="staff"><StaffPage /></Guard>} />
                  <Route path="/admin/users" element={<Guard perm="users"><UsersPage /></Guard>} />
                  <Route path="/admin/roles" element={<Guard perm="roles"><RolesPage /></Guard>} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  )
}
