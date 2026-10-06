import { Tag } from 'antd'

export function StatusTag({ label }: { label: { text: string; color: string } }) {
  return <Tag color={label.color} bordered={false}>{label.text}</Tag>
}
