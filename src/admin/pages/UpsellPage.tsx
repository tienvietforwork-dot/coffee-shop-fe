import { Typography } from 'antd'
import { UpsellProductsSection } from './UpsellProductsSection'

export function UpsellPage() {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 0 }}>
        Upsell · Nâng cấp món
      </Typography.Title>
      <Typography.Text type="secondary">
        Gợi ý một món cà phê khác có trải nghiệm tương tự nhưng cao cấp hơn.
      </Typography.Text>
      <UpsellProductsSection />
    </div>
  )
}
