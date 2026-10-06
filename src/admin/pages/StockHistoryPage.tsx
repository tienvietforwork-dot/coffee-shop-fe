import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, Table } from 'antd'
import { coreApi } from '@/api/core'
import { TX_TYPE, dateTime, num } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'

export function StockHistoryPage() {
  const [materialId, setMaterialId] = useState<number>()
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: coreApi.materials })
  const { data = [], isLoading } = useQuery({ queryKey: ['transactions', materialId], queryFn: () => coreApi.transactions(materialId) })
  return (
    <>
      <PageHeader title="Lịch sử giao dịch kho" extra={
        <Select allowClear showSearch optionFilterProp="label" placeholder="Lọc theo nguyên liệu" style={{ width: 240 }} value={materialId} onChange={setMaterialId}
          options={materials.map((m) => ({ value: m.id, label: m.name }))} />
      } />
      <Table rowKey="id" loading={isLoading} dataSource={data}
        columns={[
          { title: 'Thời gian', dataIndex: 'createdAt', render: dateTime },
          { title: 'Loại', render: (_, t) => <StatusTag label={TX_TYPE[t.type]} /> },
          { title: 'Nguyên liệu', dataIndex: 'materialName' },
          { title: 'Lô', dataIndex: 'batchId', render: (v) => `#${v}` },
          { title: 'Số lượng', render: (_, t) => <b style={{ color: t.quantity < 0 ? '#cf1322' : '#389e0d' }}>{t.quantity > 0 ? '+' : ''}{num(t.quantity)} {t.unit}</b>, align: 'right' },
          { title: 'Nhân viên', dataIndex: 'staffName' },
          { title: 'Ghi chú', dataIndex: 'note' },
        ]} />
    </>
  )
}
