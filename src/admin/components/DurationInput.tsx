import { useState } from 'react'
import { InputNumber, Select, Space } from 'antd'

const UNITS = [{ value: 1, label: 'phút' }, { value: 60, label: 'giờ' }, { value: 1440, label: 'ngày' }]
/** largest unit the value is a whole number of */
const unitOf = (min?: number) => (min && min % 1440 === 0 ? 1440 : min && min % 60 === 0 ? 60 : min ? 1 : 60)

/** Form control for a duration stored in minutes, entered in phút / giờ / ngày. */
export function DurationInput({ value, onChange, defaultUnit }: { value?: number; onChange?: (v?: number) => void; defaultUnit?: number }) {
  const [unit, setUnit] = useState(value ? unitOf(value) : defaultUnit ?? 60)
  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber min={0} step={1} style={{ width: '100%' }} value={value == null ? undefined : Math.round((value / unit) * 100) / 100}
        onChange={(v) => onChange?.(v == null ? undefined : Math.round(Number(v) * unit))} />
      <Select style={{ width: 90 }} value={unit} options={UNITS}
        onChange={(u) => { setUnit(u); if (value != null) onChange?.(Math.round((value / unit) * u)) }} />
    </Space.Compact>
  )
}
