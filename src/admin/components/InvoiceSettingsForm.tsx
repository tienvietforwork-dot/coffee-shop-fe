import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Descriptions, Form, Input, Row, Select, Tag } from 'antd'
import { coreApi } from '@/api/core'
import type { InvoiceSettings } from '@/api/types'
import { useAction } from './useCrud'

const VAT = [
  { value: 'none', label: 'Không thuế GTGT — hóa đơn bán hàng (hộ kinh doanh, PP trực tiếp)' },
  { value: 0, label: 'GTGT 0%' }, { value: 5, label: 'GTGT 5%' }, { value: 8, label: 'GTGT 8%' }, { value: 10, label: 'GTGT 10%' },
]

/**
 * Thiết lập hóa đơn điện tử: người bán (đã đăng ký với cơ quan thuế), loại hóa đơn, ký hiệu.
 * Hóa đơn đã lập giữ thông tin người bán lúc lập — đổi ở đây chỉ áp dụng cho hóa đơn mới.
 */
export function InvoiceSettingsForm({ readOnly }: { readOnly?: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['invoice-settings'], queryFn: coreApi.invoiceSettings })
  const [form] = Form.useForm()
  const save = useAction(coreApi.saveInvoiceSettings, [['invoice-settings']], 'Đã lưu thiết lập hóa đơn')
  const vat = Form.useWatch('vatRate', form)
  const suffix = Form.useWatch('seriesSuffix', form)
  if (isLoading || !data) return <Card loading />

  const yy = data.series?.slice(2, 4) ?? String(new Date().getFullYear() % 100).padStart(2, '0')
  const preview = `${vat === 'none' || vat == null ? '2' : '1'}C${yy}M${String(suffix ?? '').toUpperCase().padEnd(2, '_')}`

  return (
    <Row gutter={16}>
      <Col xs={24} lg={14}>
        <Card size="small" title="Người bán & ký hiệu"
          extra={<Tag color={data.simulated ? 'gold' : 'green'}>{data.simulated ? 'Chế độ mô phỏng' : 'Đang nối MISA meInvoice'}</Tag>}>
          <Form form={form} layout="vertical" disabled={readOnly}
            initialValues={{ ...data, vatRate: data.vatRate ?? 'none' }}
            onFinish={(v) => save.mutate({ ...v, vatRate: v.vatRate === 'none' ? undefined : v.vatRate } as InvoiceSettings)}>
            <Form.Item name="sellerName" label="Tên người bán (đúng tên trên đăng ký thuế)" rules={[{ required: true }]}>
              <Input placeholder="HỘ KINH DOANH COFFEEHOLIC" />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="sellerTaxCode" label="Mã số thuế" rules={[{ required: true }, { pattern: /^\d{10}(-\d{3})?$|^\d{12}$/, message: '10 số, 10 số-3 số hoặc 12 số' }]}>
                  <Input placeholder="0312345678" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="vatRate" label="Loại hóa đơn / thuế suất"><Select options={VAT} /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="sellerAddress" label="Địa chỉ người bán"
              extra={<>Để trống = dùng địa chỉ quán (Giao hàng → Phí giao hàng): <b>{data.shopAddress ?? '—'}</b></>}>
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
          <Alert type="info" showIcon style={{ marginTop: 12 }}
            message="Đổi thiết lập chỉ áp dụng cho hóa đơn lập từ bây giờ; hóa đơn đã lập giữ nguyên người bán lúc lập. Đổi ký hiệu / MST phải khớp với tờ khai đăng ký (mẫu 01/ĐKTĐ-HĐĐT) đã gửi cơ quan thuế." />
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card size="small" title="Các mã trên hóa đơn">
          <Descriptions size="small" column={1} bordered items={[
            { label: 'Mẫu số', children: <>1 = hóa đơn GTGT, 2 = hóa đơn bán hàng. Tự chọn theo loại hóa đơn ở bên.</> },
            { label: 'Ký hiệu', children: <><b>{preview}</b>: ký tự 1 = mẫu số · <b>C</b> = có mã của CQT · <b>{yy}</b> = năm lập · <b>M</b> = khởi tạo từ máy tính tiền · 2 chữ cuối quán tự đặt (phân biệt quầy / chi nhánh). Sang năm mới hệ thống tự đổi năm trong ký hiệu.</> },
            { label: 'Số hóa đơn', children: <>Số thứ tự liên tục trong từng ký hiệu, bắt đầu từ 1 mỗi năm, tối đa 8 chữ số. Tự cấp khi phát hành, không sửa tay, không nhảy số.</> },
            { label: 'Mã của CQT', children: <><b>M{'{mẫu}'}-{'{YY}'}-{'{XXXXX}'}-{'{11 số}'}</b>, e.g. M2-{yy}-AB12C-00000000123: XXXXX là 5 ký tự cơ quan thuế cấp khi quán đăng ký dùng hóa đơn từ máy tính tiền; 11 số tự sinh liên tục. Chứng minh hóa đơn đã được chuyển cho cơ quan thuế.</> },
            { label: 'Mã tra cứu', children: <>Nhà cung cấp hóa đơn (MISA) sinh cho từng hóa đơn. Khách nhập ở trang tra cứu để xem / tải hóa đơn gốc (XML, PDF).</> },
            { label: 'Mã đơn hàng', children: <>Mã nội bộ của quán: CH + ngày (yyMMdd) + 4 ký tự ngẫu nhiên, e.g. CH261106K7QX. Không phải số hóa đơn; in kèm để đối chiếu đơn ↔ hóa đơn.</> },
          ]} />
        </Card>
      </Col>
    </Row>
  )
}
