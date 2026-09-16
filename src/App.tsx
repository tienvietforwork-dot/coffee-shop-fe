import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { MaterialsPage } from '@/pages/MaterialsPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { ShippingPage } from '@/pages/ShippingPage'
import { UsersPage } from '@/pages/UsersPage'
import { ReportsPage } from '@/pages/ReportsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#6f4e37' } }}>
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/materials" element={<MaterialsPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/shipping" element={<ShippingPage />} />
                  <Route path="/reports" element={<ReportsPage />} />

                  <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </RealtimeProvider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
