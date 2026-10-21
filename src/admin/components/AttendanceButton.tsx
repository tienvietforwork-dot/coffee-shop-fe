import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Empty, List, Popover, Tag } from 'antd'
import { FieldTimeOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { time } from '@/lib/format'
import { useAction } from './useCrud'

/**
 * Chấm công of the logged-in staff member: today's shifts with "Vào ca" / "Ra ca". Shown in the admin header for
 * accounts linked to a staff record.
 */
export function AttendanceButton() {
  const { data: mine = [] } = useQuery({ queryKey: ['my-shifts'], queryFn: coreApi.myShiftsToday, refetchInterval: 60_000 })
  const keys = [['my-shifts'], ['schedule'], ['timesheet']]
  const checkIn = useAction(coreApi.checkIn, keys, 'Đã chấm vào ca')
  const checkOut = useAction(coreApi.checkOut, keys, 'Đã chấm ra ca')
  const pending = mine.filter((a) => (a.state === 'SCHEDULED' && !a.leaveType) || a.state === 'WORKING').length

  return (
    <Popover trigger="click" placement="bottomRight" title="Chấm công hôm nay" content={
      mine.length ? (
        <List size="small" style={{ width: 320 }} dataSource={mine} renderItem={(a) => (
          <List.Item actions={[
            a.state === 'SCHEDULED' && !a.leaveType && <Button key="in" type="primary" size="small" loading={checkIn.isPending} onClick={() => checkIn.mutate(a.id)}>Vào ca</Button>,
            a.state === 'WORKING' && <Button key="out" size="small" loading={checkOut.isPending} onClick={() => checkOut.mutate(a.id)}>Ra ca</Button>,
          ].filter(Boolean)}>
            <List.Item.Meta title={<>{a.shiftName} <span className="a-muted small">{a.startTime.slice(0, 5)}–{a.endTime.slice(0, 5)}</span></>}
              description={<>
                {a.position && <Tag>{a.position}</Tag>}
                {a.checkInAt && `Vào ${time(a.checkInAt)}`}{a.checkOutAt && ` · ra ${time(a.checkOutAt)}`}
                {a.lateMinutes > 0 && <Tag color="orange" style={{ marginLeft: 4 }}>muộn {a.lateMinutes}′</Tag>}
                {a.leaveType && <Tag color="purple">Nghỉ {a.leaveType}</Tag>}
              </>} />
          </List.Item>
        )} />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hôm nay bạn không có ca" />
    }>
      <Badge count={pending} size="small"><Button icon={<FieldTimeOutlined />}>Chấm công</Button></Badge>
    </Popover>
  )
}
