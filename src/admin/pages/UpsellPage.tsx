import { Typography } from 'antd'
import { UpsellOptionsSection } from './UpsellOptionsSection'

/** Only the modifier-based Upsell flow is exposed to admins.
 * Historical SKU-to-SKU rules remain stored on the server for migration/audit.
 */
export function UpsellPage() {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 0 }}>
        Upsell · Tùy chỉnh món
      </Typography.Title>
      <Typography.Text type="secondary">
        Nâng kích cỡ ly, thêm topping hoặc thành phần cao cấp trên chính món khách chọn.
      </Typography.Text>
      <UpsellOptionsSection />
    </div>
  )
}
