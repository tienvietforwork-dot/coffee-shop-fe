import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Radio, Segmented, Select, Space, Switch, Table, Tag, TimePicker, Tooltip } from 'antd'
import { DownloadOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { coreApi } from '@/api/core'
import type { AttendanceState, ShiftAssignment, Staff, TimesheetRow, WorkShift } from '@/api/types'
import { time } from '@/lib/format'
import { PageHeader } from '../components/PageHeader'
import { useAction } from '../components/useCrud'

const STATE: Record<AttendanceState, { text: string; color: string }> = {
  SCHEDULED: { text: 'Chưa vào ca', color: 'default' }, WORKING: { text: 'Đang làm', color: 'processing' },
  DONE: { text: 'Đã chấm', color: 'green' }, MISSING_OUT: { text: 'Quên chấm ra', color: 'orange' },
  ABSENT: { text: 'Vắng', color: 'red' }, LEAVE: { text: 'Nghỉ', color: 'purple' },
}
const POSITIONS = ['Pha chế', 'Thu ngân', 'Phục vụ', 'Giao hàng']
const DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/**
 * Phân ca & chấm công: ca mẫu (sáng / chiều / tối…), lịch tuần (xếp nhiều nhân viên × nhiều ngày; ca gãy = 2 ca trong ngày),
 * quản lý sửa giờ chấm công có ghi lý do / ghi nghỉ P – KL, bảng chấm công tháng (mẫu 01a-LĐTL rút gọn, xuất Excel).
 * Nhân viên tự chấm vào / ra ở nút "Chấm công" trên thanh trên cùng.
 */
export function WorkShiftsPage() {
  const [tab, setTab] = useState<'week' | 'shifts' | 'sheet'>('week')
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'))
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  const range = { from: days[0].format('YYYY-MM-DD'), to: days[6].format('YYYY-MM-DD') }
  const { data: shifts = [] } = useQuery({ queryKey: ['work-shifts'], queryFn: coreApi.workShifts })
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: coreApi.staff })
  const { data: schedule = [] } = useQuery({ queryKey: ['schedule', range], queryFn: () => coreApi.schedule(range), enabled: tab === 'week' })
  const working = staff.filter((s) => s.workStatus !== 'RESIGNED')
  const keys = [['schedule'], ['timesheet'], ['my-shifts']]
  const assign = useAction(coreApi.assignShift, keys, 'Đã xếp ca')
  const unassign = useAction(coreApi.unassignShift, keys, 'Đã gỡ ca')
  const adjust = useAction((v: { id: number; b: Parameters<typeof coreApi.adjustAttendance>[1] }) => coreApi.adjustAttendance(v.id, v.b), keys, 'Đã sửa chấm công')
  const saveShift = useAction(coreApi.saveWorkShift, [['work-shifts']], 'Đã lưu ca')
  const deleteShift = useAction(coreApi.deleteWorkShift, [['work-shifts']], 'Đã xóa ca')

  const [assigning, setAssigning] = useState<{ staffIds?: number[]; dates?: Dayjs[] } | null>(null)
  const [editing, setEditing] = useState<ShiftAssignment | null>(null)
  const [shiftEdit, setShiftEdit] = useState<Partial<WorkShift> | null>(null)
  const [assignForm] = Form.useForm()
  const [adjustForm] = Form.useForm()
  const [shiftForm] = Form.useForm()

  const [month, setMonth] = useState(dayjs())
  const { data: sheet } = useQuery({ queryKey: ['timesheet', month.format('YYYY-MM')], enabled: tab === 'sheet',
    queryFn: () => coreApi.timesheet(month.format('YYYY-MM')) })

  const openAssign = (staffIds?: number[], date?: Dayjs) => {
    setAssigning({})
    assignForm.resetFields()
    assignForm.setFieldsValue({ staffIds, dates: date ? [date] : [], shiftId: shifts.find((s) => s.active)?.id })
  }
  const openAdjust = (a: ShiftAssignment) => {
    setEditing(a)
    adjustForm.resetFields()
    adjustForm.setFieldsValue({
      kind: a.leaveType ? a.leaveType : 'WORK',
      checkInAt: a.checkInAt ? dayjs(a.checkInAt) : dayjs(`${a.workDate}T${a.startTime}`),
      checkOutAt: a.checkOutAt ? dayjs(a.checkOutAt) : dayjs(`${a.workDate}T${a.endTime}`),
    })
  }

  const cell = (s: Staff, d: Dayjs) => {
    const list = schedule.filter((a) => a.staffId === s.id && a.workDate === d.format('YYYY-MM-DD'))
    return (
      <div className="a-ws-cell">
        {list.map((a) => (
          <Tooltip key={a.id} title={<>{a.shiftName} {a.startTime.slice(0, 5)}–{a.endTime.slice(0, 5)}{a.position && ` · ${a.position}`}<br />
            {STATE[a.state].text}{a.checkInAt && ` · vào ${time(a.checkInAt)}`}{a.checkOutAt && ` · ra ${time(a.checkOutAt)}`}
            {a.lateMinutes > 0 && ` · muộn ${a.lateMinutes}′`}{a.note && <><br />{a.note}</>}</>}>
            <Tag color={a.state === 'SCHEDULED' ? a.color ?? 'blue' : STATE[a.state].color} style={{ cursor: 'pointer', marginBottom: 2 }} onClick={() => openAdjust(a)}>
              {a.shiftName}{a.lateMinutes > 0 ? ' ⏰' : ''}
            </Tag>
          </Tooltip>
        ))}
        {!d.isBefore(dayjs(), 'day') && <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openAssign([s.id], d)} />}
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Phân ca & chấm công" subtitle="Xếp ca theo tuần · nhân viên tự chấm vào / ra · bảng chấm công tháng" />
      <Segmented value={tab} onChange={(v) => setTab(v as typeof tab)} style={{ marginBottom: 12 }}
        options={[{ value: 'week', label: 'Lịch tuần' }, { value: 'shifts', label: 'Ca mẫu' }, { value: 'sheet', label: 'Bảng chấm công' }]} />

      {tab === 'week' && <>
        <Space style={{ marginBottom: 12 }}>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart(weekStart.subtract(7, 'day'))} />
          <b>{days[0].format('DD/MM')} – {days[6].format('DD/MM/YYYY')}</b>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart(weekStart.add(7, 'day'))} />
          <Button onClick={() => setWeekStart(dayjs().startOf('week').add(1, 'day'))}>Tuần này</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openAssign()}>Xếp ca</Button>
        </Space>
        <Table<Staff> rowKey="id" size="small" pagination={false} dataSource={working} scroll={{ x: 1000 }} bordered
          columns={[
            { title: 'Nhân viên', fixed: 'left', width: 160, render: (_, s) => <><b>{s.fullName}</b><div className="a-muted small">{s.position}</div></> },
            ...days.map((d) => ({
              title: <span className={d.isSame(dayjs(), 'day') ? 'a-limit' : ''}>{DAY[d.day()]} {d.format('DD/MM')}</span>,
              key: d.format('YYYY-MM-DD'), render: (_: unknown, s: Staff) => cell(s, d),
            })),
          ]} />
      </>}

      {tab === 'shifts' && <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }}
          onClick={() => { setShiftEdit({}); shiftForm.resetFields(); shiftForm.setFieldsValue({ graceMinutes: 5, active: true }) }}>Thêm ca</Button>
        <Table<WorkShift> rowKey="id" size="small" pagination={false} dataSource={shifts}
          columns={[
            { title: 'Ca', dataIndex: 'name', render: (v, s) => <Tag color={s.color ?? 'blue'}>{v}</Tag> },
            { title: 'Giờ', render: (_, s) => `${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}` },
            { title: 'Số giờ', render: (_, s) => `${Math.round(s.minutes / 6) / 10} giờ` },
            { title: 'Cho phép trễ', dataIndex: 'graceMinutes', render: (v) => `${v} phút` },
            { title: 'Trạng thái', dataIndex: 'active', render: (v) => (v ? <Tag color="green">Đang dùng</Tag> : <Tag>Tạm ngưng</Tag>) },
            {
              title: '', render: (_, s) => <Space>
                <Button size="small" onClick={() => { setShiftEdit(s); shiftForm.setFieldsValue({ ...s, startTime: dayjs(s.startTime, 'HH:mm:ss'), endTime: dayjs(s.endTime, 'HH:mm:ss') }) }}>Sửa</Button>
                <Popconfirm title="Xóa ca mẫu?" onConfirm={() => deleteShift.mutate(s.id)}><Button size="small" danger>Xóa</Button></Popconfirm>
              </Space>,
            },
          ]} />
      </>}

      {tab === 'sheet' && <>
        <Space style={{ marginBottom: 12 }}>
          <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} format="MM/YYYY" allowClear={false} />
          <Button icon={<DownloadOutlined />} onClick={() => coreApi.timesheetExcel(month.format('YYYY-MM'))}>Xuất Excel</Button>
          <span className="a-muted small">Số = giờ công · P nghỉ phép · KL nghỉ không lương · V vắng · ? quên chấm ra</span>
        </Space>
        <Table<TimesheetRow> rowKey="staffId" size="small" pagination={false} dataSource={sheet?.rows ?? []} scroll={{ x: 1600 }} bordered
          columns={[
            { title: 'Nhân viên', dataIndex: 'staffName', fixed: 'left', width: 150 },
            ...Array.from({ length: sheet?.daysInMonth ?? 0 }, (_, i) => ({
              title: String(i + 1), key: `d${i + 1}`, width: 42, align: 'center' as const,
              render: (_: unknown, r: TimesheetRow) => {
                const v = r.days[i + 1]
                return v ? <span className={v === 'V' || v === '?' ? 'a-limit' : ''}>{v}</span> : ''
              },
            })),
            { title: 'Số ca', dataIndex: 'worked', width: 60, render: (v, r) => `${v}/${r.scheduled}` },
            { title: 'Giờ công', dataIndex: 'workedHours', width: 70 },
            { title: 'Muộn', render: (_, r) => (r.lateTimes ? `${r.lateTimes} lần · ${r.lateMinutes}′` : '—'), width: 90 },
            { title: 'Vắng', dataIndex: 'absent', width: 50 },
            { title: 'P / KL', render: (_, r) => `${r.leavePaid} / ${r.leaveUnpaid}`, width: 60 },
          ]} />
      </>}

      <Modal open={!!assigning} title="Xếp ca" onCancel={() => setAssigning(null)} destroyOnHidden
        footer={<Button type="primary" loading={assign.isPending} onClick={() => assignForm.submit()}>Xếp ca</Button>}>
        <Form form={assignForm} layout="vertical" onFinish={(v: { staffIds: number[]; dates: Dayjs[]; shiftId: number; position?: string }) =>
          assign.mutate({ staffIds: v.staffIds, dates: v.dates.map((d) => d.format('YYYY-MM-DD')), shiftId: v.shiftId, position: v.position },
            { onSuccess: () => setAssigning(null) })}>
          <Form.Item name="shiftId" label="Ca" rules={[{ required: true }]}>
            <Select options={shifts.filter((s) => s.active).map((s) => ({ value: s.id, label: `${s.name} (${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)})` }))} />
          </Form.Item>
          <Form.Item name="staffIds" label="Nhân viên" rules={[{ required: true }]}>
            <Select mode="multiple" optionFilterProp="label" options={working.map((s) => ({ value: s.id, label: s.fullName }))} />
          </Form.Item>
          <Form.Item name="dates" label="Ngày" rules={[{ required: true }]} extra="Chọn nhiều ngày; ca gãy: xếp thêm ca thứ hai cùng ngày">
            <DatePicker multiple format="DD/MM" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="position" label="Vị trí"><Select allowClear options={POSITIONS.map((p) => ({ value: p, label: p }))} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={!!editing} title={editing && `${editing.staffName} · ${editing.shiftName} ${dayjs(editing.workDate).format('DD/MM')}`}
        onCancel={() => setEditing(null)} destroyOnHidden
        footer={<Space>
          {editing && !editing.checkInAt && !editing.leaveType && (
            <Popconfirm title="Gỡ ca này khỏi lịch?" onConfirm={() => unassign.mutate(editing.id, { onSuccess: () => setEditing(null) })}><Button danger>Gỡ ca</Button></Popconfirm>
          )}
          <Button type="primary" loading={adjust.isPending} onClick={() => adjustForm.submit()}>Lưu chấm công</Button>
        </Space>}>
        {editing && <Form form={adjustForm} layout="vertical" onFinish={(v: { kind: string; checkInAt?: Dayjs; checkOutAt?: Dayjs; note: string }) =>
          adjust.mutate({ id: editing.id, b: {
            leaveType: v.kind === 'WORK' ? undefined : v.kind, note: v.note,
            checkInAt: v.kind === 'WORK' ? v.checkInAt?.format('YYYY-MM-DDTHH:mm:ss') : undefined,
            checkOutAt: v.kind === 'WORK' ? v.checkOutAt?.format('YYYY-MM-DDTHH:mm:ss') : undefined,
          } }, { onSuccess: () => setEditing(null) })}>
          <p><Tag color={STATE[editing.state].color}>{STATE[editing.state].text}</Tag>
            {editing.checkInAt && `Vào ${time(editing.checkInAt)} `}{editing.checkOutAt && `· ra ${time(editing.checkOutAt)} `}
            {editing.lateMinutes > 0 && `· muộn ${editing.lateMinutes} phút `}{editing.adjustedBy && `· đã sửa bởi ${editing.adjustedBy}`}</p>
          <Form.Item name="kind"><Radio.Group options={[{ value: 'WORK', label: 'Đi làm' }, { value: 'P', label: 'Nghỉ có phép' }, { value: 'KL', label: 'Nghỉ không lương' }]} /></Form.Item>
          <Form.Item noStyle shouldUpdate>{() => adjustForm.getFieldValue('kind') === 'WORK' && (
            <div className="a-grid-2">
              <Form.Item name="checkInAt" label="Giờ vào"><DatePicker showTime format="HH:mm DD/MM" style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="checkOutAt" label="Giờ ra"><DatePicker showTime format="HH:mm DD/MM" style={{ width: '100%' }} /></Form.Item>
            </div>
          )}</Form.Item>
          <Form.Item name="note" label="Lý do sửa" rules={[{ required: true }]}><Input placeholder="Quên chấm công, máy hỏng, nghỉ ốm có giấy…" /></Form.Item>
        </Form>}
      </Modal>

      <Modal open={!!shiftEdit} title={shiftEdit?.id ? 'Sửa ca' : 'Thêm ca'} onCancel={() => setShiftEdit(null)} destroyOnHidden
        footer={<Button type="primary" loading={saveShift.isPending} onClick={() => shiftForm.submit()}>Lưu</Button>}>
        <Form form={shiftForm} layout="vertical" onFinish={(v: { name: string; startTime: Dayjs; endTime: Dayjs; graceMinutes: number; color?: string; active: boolean }) =>
          saveShift.mutate({ id: shiftEdit?.id, name: v.name, startTime: v.startTime.format('HH:mm'), endTime: v.endTime.format('HH:mm'),
            graceMinutes: v.graceMinutes, color: v.color, active: v.active }, { onSuccess: () => setShiftEdit(null) })}>
          <Form.Item name="name" label="Tên ca" rules={[{ required: true }]}><Input placeholder="Ca sáng" /></Form.Item>
          <div className="a-grid-2">
            <Form.Item name="startTime" label="Giờ vào" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="endTime" label="Giờ ra" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} /></Form.Item>
          </div>
          <div className="a-grid-3">
            <Form.Item name="graceMinutes" label="Cho phép trễ (phút)"><InputNumber min={0} max={60} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="color" label="Màu"><Select allowClear options={['blue', 'green', 'orange', 'purple', 'magenta', 'cyan'].map((c) => ({ value: c, label: <Tag color={c}>{c}</Tag> }))} /></Form.Item>
            <Form.Item name="active" label="Đang dùng" valuePropName="checked"><Switch /></Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}
