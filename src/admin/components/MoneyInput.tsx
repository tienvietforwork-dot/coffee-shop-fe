import { InputNumber, type InputNumberProps } from 'antd'

export function MoneyInput(props: InputNumberProps<number>) {
  return (
    <InputNumber<number>
      min={0}
      step={1000}
      style={{ width: '100%' }}
      formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
      parser={(v) => Number((v ?? '').replace(/\./g, ''))}
      addonAfter="đ"
      {...props}
    />
  )
}
