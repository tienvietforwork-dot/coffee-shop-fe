import type { ReactNode } from 'react'
import { Alert, Result, Spin } from 'antd'
import { errorMessage, isServiceUnavailable } from '@/api/client'

/**
 * Wraps a page whose data comes from app-crm / app-promotions / app-stats.
 * If that module's backend is not deployed yet, show a clear notice instead of a broken page.
 */
export function ServiceGate({
  loading, error, module, children,
}: { loading?: boolean; error?: unknown; module: 'CRM' | 'Khuyến mãi' | 'Thống kê'; children: ReactNode }) {
  if (loading) return <div className="a-center"><Spin /></div>
  if (error && isServiceUnavailable(error)) {
    return (
      <Result
        status="warning"
        title={`Dịch vụ ${module} chưa sẵn sàng`}
        subTitle={`Giao diện đã sẵn sàng nhưng backend của module ${module} chưa được triển khai hoặc chưa kết nối qua gateway.`}
      />
    )
  }
  if (error) return <Alert type="error" showIcon message={errorMessage(error)} />
  return <>{children}</>
}
