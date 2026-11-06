import { useQuery } from '@tanstack/react-query'
import { Button, Card, Col, Form, Input, Row, Select } from 'antd'
import { coreApi } from '@/api/core'
import type { InvoiceSettings } from '@/api/types'
import { useAction } from './useCrud'

/** quán là hộ kinh doanh: chỉ lập hóa đơn bán hàng, không thuế GTGT */
const VAT = [{ value: 'none', label: 'Không thuế' }]

/**
 * Thiết lập hóa đơn điện tử: người bán (đã đăng ký với cơ quan thuế), loại hóa đơn, ký hiệu.
 * Hóa đơn đã lập giữ thông tin người bán lúc lập — đổi ở đây chỉ áp dụng cho hóa đơn mới.
 */
export function InvoiceSettingsForm({ readOnly }: { readOnly?: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['invoice-settings'], queryFn: coreApi.invoiceSettings })
  const [form] = Form.useForm()
  const save = useAction(coreApi.saveInvoiceSettings, [['invoice-settings']], 'Đã lưu thiết lập hóa đơn')
  const suffix = Form.useWatch('seriesSuffix', form)
  if (isLoading || !data) return <Card loading />

  const yy = data.series?.slice(2, 4) ?? String(new Date().getFullYear() % 100).padStart(2, '0')
  const preview = `2C${yy}M${String(suffix ?? '').toUpperCase().padEnd(2, '_')}`

  return (
        <Card size="small" title="Người bán & ký hiệu">
          <Form form={form} layout="vertical" disabled={readOnly}
            initialValues={{ ...data, vatRate: 'none' }}
            onFinish={(v) => save.mutate({ ...v, vatRate: undefined } as InvoiceSettings)}>
            <Form.Item name="sellerName" label="Tên người bán" rules={[{ required: true }]}>
              <Input placeholder="HỘ KINH DOANH COFFEEHOLIC" />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="sellerTaxCode" label="Mã số thuế" rules={[{ required: true }, { pattern: /^\d{10}(-\d{3})?$|^\d{12}$/, message: '10 số, 10 số-3 số hoặc 12 số' }]}>
                  <Input placeholder="0312345678" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="vatRate" label="Loại hóa đơn"><Select options={VAT} /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="sellerAddress" label="Địa chỉ người bán">
              <Input allowClear placeholder={data.shopAddress} />
            </Form.Item>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="seriesSuffix" label="2 chữ cuối ký hiệu" normalize={(v: string) => v?.toUpperCase()}
                  rules={[{ required: true }, { pattern: /^[A-Za-z]{2}$/, message: '2 chữ cái' }]}>
                  <Input maxLength={2} placeholder="CH" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Ký hiệu năm nay"><Input value={preview} disabled /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Số HĐ cuối đã cấp"><Input value={data.series === preview ? data.lastNo ?? 'chưa có' : 'ký hiệu mới — từ 1'} disabled /></Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="taxOfficeCode" label="Mã CQT cấp (5 ký tự)" normalize={(v: string) => v?.toUpperCase()}
                  rules={[{ pattern: /^[A-Za-z0-9]{5}$/, message: '5 ký tự chữ / số' }]}>
                  <Input maxLength={5} placeholder="XXXXX" />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item name="lookupUrl" label="Trang tra cứu hóa đơn"><Input placeholder="https://www.meinvoice.vn/tra-cuu" /></Form.Item>
              </Col>
            </Row>
            {!readOnly && <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu</Button>}
          </Form>
        </Card>
  )
}
