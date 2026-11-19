import { Typography } from 'antd'
import { UpsellProductsSection } from './UpsellProductsSection'

export function UpsellPage() {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 0 }}>
        Gợi ý sản phẩm cho khách hàng
      </Typography.Title>
      <Typography.Text type="secondary">
        Quản lý sản phẩm được giới thiệu khi khách đang xem một sản phẩm khác.
      </Typography.Text>
      <UpsellProductsSection />
    </div>
  )
}
