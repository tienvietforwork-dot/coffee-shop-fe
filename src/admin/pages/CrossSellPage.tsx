import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Col, DatePicker, Form, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { crossSellApi, type CrossSellPayload, type CrossSellRule } from '@/api/crossSell'
import { merchandisingApi } from '@/api/merchandising'
import { errorMessage } from '@/api/client'

const { Title, Text } = Typography
export function CrossSellPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm<CrossSellPayload & {related: number[]; start?: dayjs.Dayjs; end?: dayjs.Dayjs}>()
  const [edit, setEdit] = useState<CrossSellRule|null>(null)
  const [open,setOpen] = useState(false)
  const [preview,setPreview] = useState<string[]|null>(null)
  const [analytics,setAnalytics] = useState<Record<string,unknown>|null>(null)
  const [saving,setSaving] = useState(false)
  const list = useQuery({queryKey:['cross-sell-rules'],queryFn:crossSellApi.rules})
  const menu = useQuery({queryKey:['cross-sell-coffees'],queryFn:merchandisingApi.placementOverview})
  const options = (menu.data?.coffees||[]).map(c=>({value:c.id,label:`${c.name} (${c.price.toLocaleString('vi-VN')}đ)`}))
  function start(rule:CrossSellRule|null) {
    setEdit(rule);setOpen(true)
    form.setFieldsValue(rule?{
      anchorCoffeeId:rule.anchor_coffee_id,priority:rule.priority,minCartAmount:rule.min_cart_amount,
      related:rule.items.map(x=>x.coffeeId),start:rule.starts_at?dayjs(rule.starts_at):undefined,
      end:rule.ends_at?dayjs(rule.ends_at):undefined
    }:{anchorCoffeeId:undefined,priority:0,minCartAmount:0,related:[],start:undefined,end:undefined})
  }
  async function save() {
    try {
      const values=await form.validateFields()
      if(values.related.includes(values.anchorCoffeeId)) { message.error('Món đề xuất không được trùng món gốc');return }
      if(values.start&&values.end&&values.start.isAfter(values.end)){message.error('Ngày kết thúc phải sau ngày bắt đầu');return}
      const payload:CrossSellPayload={anchorCoffeeId:values.anchorCoffeeId,priority:values.priority||0,
        minCartAmount:values.minCartAmount||0,startsAt:values.start?.format('YYYY-MM-DDTHH:mm:ss')||null,
        endsAt:values.end?.format('YYYY-MM-DDTHH:mm:ss')||null,
        items:values.related.map((coffeeId,position)=>({coffeeId,position}))}
      setSaving(true)
      if(edit)await crossSellApi.update(edit.id,payload);else await crossSellApi.create(payload)
      setOpen(false);message.success('Đã lưu quy tắc');qc.invalidateQueries({queryKey:['cross-sell-rules']})
    } catch(e) {if((e as {errorFields?:unknown})?.errorFields)return;message.error(errorMessage(e))} finally{setSaving(false)}
  }
  async function action(fn:()=>Promise<unknown>) {try{await fn();qc.invalidateQueries({queryKey:['cross-sell-rules']});message.success('Đã cập nhật')}catch(e){message.error(errorMessage(e))}}
  const columns=[
    {title:'Sản phẩm gốc',dataIndex:'anchor_name',key:'name'},
    {title:'Sản phẩm bán kèm',key:'items',render:(_:unknown,r:CrossSellRule)=><Text>{r.items.map(i=>i.coffeeName).join(', ')}</Text>},
    {title:'Ưu tiên',dataIndex:'priority',key:'priority'},
    {title:'Giỏ tối thiểu',dataIndex:'min_cart_amount',key:'cart',render:(v:number)=>`${Number(v).toLocaleString('vi-VN')}đ`},
    {title:'Trạng thái',dataIndex:'status',key:'status',render:(v:string)=><Tag color={v==='ACTIVE'?'green':v==='DRAFT'?'default':'orange'}>{v}</Tag>},
    {title:'Tương tác',key:'track',render:(_:unknown,r:CrossSellRule)=>`${r.impressions} xem / ${r.clicks} click`},
    {title:'Thao tác',key:'actions',render:(_:unknown,r:CrossSellRule)=><Space wrap>
      <Button size="small" disabled={r.status==='ACTIVE'} onClick={()=>start(r)}>Sửa</Button>
      <Button size="small" onClick={()=>action(()=>r.status==='ACTIVE'?crossSellApi.pause(r.id):crossSellApi.activate(r.id))}>{r.status==='ACTIVE'?'Tạm dừng':'Kích hoạt'}</Button>
      <Button size="small" onClick={async()=>{try{setPreview((await crossSellApi.preview(r.id)).map(x=>x.coffeeName))}catch(e){message.error(errorMessage(e))}}}>Xem trước</Button>
      <Button size="small" onClick={async()=>{try{setAnalytics(await crossSellApi.analytics(r.id) as Record<string,unknown>)}catch(e){message.error(errorMessage(e))}}}>Hiệu quả</Button>
      <Button size="small" danger onClick={()=>Modal.confirm({title:'Xóa quy tắc này?',onOk:()=>action(()=>crossSellApi.remove(r.id))})}>Xóa</Button>
    </Space>},
  ]
  return <div style={{padding:24}}>
    <Row justify="space-between" align="middle"><Col><Title level={3} style={{marginBottom:0}}>Cross-sell · Bán kèm</Title><Text type="secondary">Cấu hình gợi ý khi khách xem món gốc</Text></Col><Col><Button type="primary" onClick={()=>start(null)}>+ Tạo quy tắc</Button></Col></Row>
    <Card style={{marginTop:20}}><Table<CrossSellRule> rowKey="id" dataSource={list.data||[]} loading={list.isLoading} columns={columns} scroll={{x:960}} pagination={{pageSize:8}} /></Card>
    <Modal title={edit?'Sửa quy tắc Cross-sell':'Tạo quy tắc Cross-sell'} open={open} onCancel={()=>setOpen(false)} onOk={save} confirmLoading={saving} okText="Lưu nháp" destroyOnHidden width={600}>
      <Form form={form} layout="vertical">
        <Form.Item name="anchorCoffeeId" label="Sản phẩm gốc" rules={[{required:true,message:'Chọn món gốc'}]}><Select showSearch optionFilterProp="label" options={options}/></Form.Item>
        <Form.Item name="related" label="Sản phẩm liên quan (thứ tự chọn = mức ưu tiên)" rules={[{required:true,type:'array',min:1,message:'Chọn ít nhất một món'}]}><Select mode="multiple" showSearch optionFilterProp="label" options={options}/></Form.Item>
        <Row gutter={16}><Col span={12}><Form.Item name="priority" label="Ưu tiên quy tắc" rules={[{required:true}]}><InputNumber min={0} max={10000} style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item name="minCartAmount" label="Giá trị giỏ tối thiểu (đ)" rules={[{required:true}]}><InputNumber min={0} style={{width:'100%'}}/></Form.Item></Col></Row>
        <Row gutter={16}><Col span={12}><Form.Item name="start" label="Bắt đầu"><DatePicker showTime style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item name="end" label="Kết thúc"><DatePicker showTime style={{width:'100%'}}/></Form.Item></Col></Row>
      </Form><Text type="secondary">Sau khi lưu nháp, dùng nút Kích hoạt trên danh sách để công bố.</Text>
    </Modal>
    <Modal title="Xem trước đề xuất" open={!!preview} onCancel={()=>setPreview(null)} footer={null}><p>Khách xem sản phẩm gốc sẽ thấy các món sau (nếu quy tắc kích hoạt và đủ điều kiện):</p>{preview?.map((x,i)=><p key={i}>{i+1}. {x}</p>)}</Modal>
    <Modal title="Hiệu quả quy tắc" open={!!analytics} onCancel={()=>setAnalytics(null)} footer={null}>
      {analytics&&<><Row gutter={16}><Col span={12}><Statistic title="Lượt hiển thị" value={Number(analytics.impressions||0)}/></Col><Col span={12}><Statistic title="Lượt click" value={Number(analytics.clicks||0)}/></Col></Row>
      <p>CTR: {(Number(analytics.clickThroughRate||0)*100).toFixed(1)}%</p><Text type="secondary">{String(analytics.note||'')}</Text></>}
    </Modal>
  </div>
}
