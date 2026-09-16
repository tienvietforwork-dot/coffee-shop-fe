import { Table, Typography, Space, Select, Tag, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getShippers } from '@/api/users'
import { getShipments, assignShipper, updateShipmentStatus } from '@/api/shipments'
import type { Shipment, ShipmentStatus } from '@/types'

const { Title } = Typography

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  WAITING: 'default',
  ASSIGNED: 'blue',
  IN_TRANSIT: 'gold',
  DELIVERED: 'green',
  FAILED: 'red',
}

const STATUS_OPTIONS: ShipmentStatus[] = ['WAITING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']

export function ShippingPage() {
  const queryClient = useQueryClient()
  const { data: shipments, isLoading } = useQuery({ queryKey: ['shipments'], queryFn: getShipments })
  const { data: shippers } = useQuery({ queryKey: ['users', 'shippers'], queryFn: getShippers })

  const assignMutation = useMutation({
    mutationFn: ({ id, shipperId }: { id: number; shipperId: number }) => assignShipper(id, shipperId),
    onSuccess: () => {
      message.success('Shipper assigned')
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ShipmentStatus }) => updateShipmentStatus(id, status),
    onSuccess: () => {
      message.success('Shipment status updated')
      queryClient.invalidateQueries({ queryKey: ['shipments'] })
    },
  })

  return (
    <div>
      <Title level={3}>Shipping</Title>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={shipments}
        columns={[
          { title: 'Order', dataIndex: 'orderCode', render: (v, r: Shipment) => v ?? `#${r.orderId}` },
          { title: 'Address', dataIndex: 'address' },
          {
            title: 'Shipper',
            dataIndex: 'shipperId',
            render: (shipperId: number | undefined, record: Shipment) => (
              <Select
                style={{ width: 180 }}
                placeholder="Assign shipper"
                value={shipperId}
                options={shippers?.map((s) => ({ value: s.id, label: s.fullName }))}
                onChange={(value) => assignMutation.mutate({ id: record.id, shipperId: value })}
              />
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (status: ShipmentStatus, record: Shipment) => (
              <Space>
                <Tag color={STATUS_COLORS[status]}>{status}</Tag>
                <Select
                  size="small"
                  style={{ width: 140 }}
                  value={status}
                  options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                  onChange={(value) => statusMutation.mutate({ id: record.id, status: value })}
                />
              </Space>
            ),
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: 'Delivered',
            dataIndex: 'deliveredAt',
            render: (v?: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
          },
        ]}
      />
    </div>
  )
}
