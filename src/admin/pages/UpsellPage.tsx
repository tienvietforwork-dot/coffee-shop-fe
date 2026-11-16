import { Typography } from 'antd'
import { UpsellProductsSection } from './UpsellProductsSection'

export function UpsellPage() {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 0 }}>
        Đề xuất món cho khách
      </Typography.Title>
      <Typography.Text type="secondary">
        Giới thiệu món khác phù hợp với gu khách; món gợi ý có thể đắt hơn, rẻ hơn hoặc cùng giá.
      </Typography.Text>
      <UpsellProductsSection />
    </div>
  )
}
