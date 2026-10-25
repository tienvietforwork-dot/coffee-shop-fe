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
import { PaymentResultPage } from '@/guest/PaymentResultPage'
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
const SuppliersPage = lazy(() => import('@/admin/pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })))
const PurchaseOrdersPage = lazy(() => import('@/admin/pages/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })))
const GoodsReceiptsPage = lazy(() => import('@/admin/pages/GoodsReceiptsPage').then((m) => ({ default: m.GoodsReceiptsPage })))
const SupplierReturnsPage = lazy(() => import('@/admin/pages/SupplierReturnsPage').then((m) => ({ default: m.SupplierReturnsPage })))
const SupplierDebtsPage = lazy(() => import('@/admin/pages/SupplierDebtsPage').then((m) => ({ default: m.SupplierDebtsPage })))
const StocktakesPage = lazy(() => import('@/admin/pages/StocktakesPage').then((m) => ({ default: m.StocktakesPage })))
const InventoryReportPage = lazy(() => import('@/admin/pages/InventoryReportPage').then((m) => ({ default: m.InventoryReportPage })))
const CoffeeCostsPage = lazy(() => import('@/admin/pages/CoffeeCostsPage').then((m) => ({ default: m.CoffeeCostsPage })))
const CashShiftsPage = lazy(() => import('@/admin/pages/CashShiftsPage').then((m) => ({ default: m.CashShiftsPage })))
const WorkShiftsPage = lazy(() => import('@/admin/pages/WorkShiftsPage').then((m) => ({ default: m.WorkShiftsPage })))
const AuditLogsPage = lazy(() => import('@/admin/pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })))
const PaymentReconciliationPage = lazy(() => import('@/admin/pages/PaymentReconciliationPage').then((m) => ({ default: m.PaymentReconciliationPage })))
const DeliveryZonesPage = lazy(() => import('@/admin/pages/DeliveryZonesPage').then((m) => ({ default: m.DeliveryZonesPage })))
const InvoicesPage = lazy(() => import('@/admin/pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const NotificationsPage = lazy(() => import('@/admin/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const TablesPage = lazy(() => import('@/admin/pages/TablesPage').then((m) => ({ default: m.TablesPage })))
const StaffPage = lazy(() => import('@/admin/pages/StaffPage').then((m) => ({ default: m.StaffPage })))
const RolesPage = lazy(() => import('@/admin/pages/RolesPage').then((m) => ({ default: m.RolesPage })))
const UsersPage = lazy(() => import('@/admin/pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const CustomerAnalyticsPage = lazy(() => import('@/admin/pages/CustomerAnalyticsPage').then(m => ({ default: m.CustomerAnalyticsPage })))
const StatsPage = lazy(() => import('@/admin/pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const CustomersPage = lazy(() => import('@/admin/pages/crm/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const InteractionsPage = lazy(() => import('@/admin/pages/crm/InteractionsPage').then((m) => ({ default: m.InteractionsPage })))
const FeedbacksPage = lazy(() => import('@/admin/pages/crm/FeedbacksPage').then((m) => ({ default: m.FeedbacksPage })))
const GroupsPage = lazy(() => import('@/admin/pages/crm/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const InsightsPage = lazy(() => import('@/admin/pages/crm/InsightsPage').then((m) => ({ default: m.InsightsPage })))
const MerchandisingAnalyticsPage = lazy(() => import('@/admin/pages/MerchandisingAnalyticsPage').then(m => ({ default: m.MerchandisingAnalyticsPage })))
const MerchandisingSchedulePage = lazy(() => import('@/admin/pages/MerchandisingSchedulePage').then(m => ({ default: m.MerchandisingSchedulePage })))
const ProductPlacementPage = lazy(() => import('@/admin/pages/ProductPlacementPage').then((m) => ({ default: m.ProductPlacementPage })))
const RecommendationPage = lazy(() => import('@/admin/pages/RecommendationPage').then(m => ({ default: m.RecommendationPage })))
const UpsellPage = lazy(() => import('@/admin/pages/UpsellPage').then(m => ({ default: m.UpsellPage })))
const CrossSellPage = lazy(() => import('@/admin/pages/CrossSellPage').then(m => ({ default: m.CrossSellPage })))
const ProductBundlesPage = lazy(() => import('@/admin/pages/ProductBundlesPage').then((m) => ({ default: m.ProductBundlesPage })))
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
                <Route path="/payment/result" element={<PaymentResultPage />} />
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
                  <Route path="/admin/merchandising-analytics" element={<Guard perm="stats"><MerchandisingAnalyticsPage /></Guard>} />
                  <Route path="/admin/merchandising-schedule" element={<Guard perm="menu"><MerchandisingSchedulePage /></Guard>} />
                  <Route path="/admin/product-placement" element={<Guard perm="menu"><ProductPlacementPage /></Guard>} />
                  <Route path="/admin/recommendation" element={<Guard perm="menu"><RecommendationPage /></Guard>} />
                  <Route path="/admin/upsell" element={<Guard perm="menu"><UpsellPage /></Guard>} />
                  <Route path="/admin/cross-sell" element={<Guard perm="menu"><CrossSellPage /></Guard>} />
                  <Route path="/admin/product-bundles" element={<Guard perm="menu"><ProductBundlesPage /></Guard>} />
                  <Route path="/admin/coffees" element={<Guard perm="menu"><CoffeesPage /></Guard>} />
                  <Route path="/admin/categories" element={<Guard perm="categories"><CategoriesPage /></Guard>} />
                  <Route path="/admin/materials" element={<Guard perm="materials"><MaterialsPage /></Guard>} />
                  <Route path="/admin/stock" element={<Guard perm="stock"><StockPage /></Guard>} />
                  <Route path="/admin/stock-history" element={<Guard perm="stock-history"><StockHistoryPage /></Guard>} />
                  <Route path="/admin/suppliers" element={<Guard perm="suppliers"><SuppliersPage /></Guard>} />
                  <Route path="/admin/purchase-orders" element={<Guard perm="purchase-orders"><PurchaseOrdersPage /></Guard>} />
                  <Route path="/admin/goods-receipts" element={<Guard perm="stock"><GoodsReceiptsPage /></Guard>} />
                  <Route path="/admin/supplier-returns" element={<Guard perm="supplier-returns"><SupplierReturnsPage /></Guard>} />
                  <Route path="/admin/supplier-debts" element={<Guard perm="supplier-debts"><SupplierDebtsPage /></Guard>} />
                  <Route path="/admin/stocktakes" element={<Guard perm="stocktakes"><StocktakesPage /></Guard>} />
                  <Route path="/admin/inventory-report" element={<Guard perm="inventory-report"><InventoryReportPage /></Guard>} />
                  <Route path="/admin/coffee-costs" element={<Guard perm="coffee-costs"><CoffeeCostsPage /></Guard>} />
                  <Route path="/admin/cash-shifts" element={<Guard perm="cash-shifts"><CashShiftsPage /></Guard>} />
                  <Route path="/admin/work-shifts" element={<Guard perm="work-shifts"><WorkShiftsPage /></Guard>} />
                  <Route path="/admin/audit-logs" element={<Guard perm="audit-logs"><AuditLogsPage /></Guard>} />
                  <Route path="/admin/payment-reconciliation" element={<Guard perm="payment-reconciliation"><PaymentReconciliationPage /></Guard>} />
                  <Route path="/admin/delivery-zones" element={<Guard perm="delivery-zones"><DeliveryZonesPage /></Guard>} />
                  <Route path="/admin/invoices" element={<Guard perm="invoices"><InvoicesPage /></Guard>} />
                  <Route path="/admin/notifications" element={<Guard perm="notifications"><NotificationsPage /></Guard>} />
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
                  <Route path="/admin/stats/customers" element={<Guard perm="stats"><CustomerAnalyticsPage /></Guard>} />
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
