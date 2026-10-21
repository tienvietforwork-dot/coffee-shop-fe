import { Form, Input, Radio } from 'antd'

/** Thông tin người mua trên hóa đơn: công ty (MST, tên đơn vị, địa chỉ) or cá nhân (họ tên, CCCD). Fields only — the parent owns the form. */
export function InvoiceBuyerFields() {
  return (
    <>
      <Form.Item name="kind" initialValue="company"><Radio.Group options={[{ value: 'company', label: 'Công ty / hộ kinh doanh' }, { value: 'person', label: 'Cá nhân' }]} /></Form.Item>
      <Form.Item noStyle shouldUpdate={(a, b) => a.kind !== b.kind}>
        {({ getFieldValue }) => getFieldValue('kind') === 'person' ? (
          <div className="a-grid-2">
            <Form.Item name="buyerName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="buyerIdNumber" label="Số CCCD"><Input /></Form.Item>
          </div>
        ) : (
          <>
            <div className="a-grid-2">
              <Form.Item name="buyerTaxCode" label="Mã số thuế" rules={[{ required: true }, { pattern: /^\d{10}(-\d{3})?$|^\d{12}$/, message: 'MST 10 hoặc 13 số' }]}><Input /></Form.Item>
              <Form.Item name="buyerName" label="Người mua hàng"><Input /></Form.Item>
            </div>
            <Form.Item name="buyerCompany" label="Tên đơn vị" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="buyerAddress" label="Địa chỉ" rules={[{ required: true }]}><Input /></Form.Item>
          </>
        )}
      </Form.Item>
      <Form.Item name="buyerEmail" label="Email nhận hóa đơn" rules={[{ type: 'email' }]}><Input /></Form.Item>
    </>
  )
}
