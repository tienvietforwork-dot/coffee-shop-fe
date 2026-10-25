import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, Switch } from 'antd'
import { upsellOptionApi, type UpsellOption, type UpsellOptionInput } from '@/api/upsell'
import { merchandisingApi } from '@/api/merchandising'
import apiClient, { errorMessage } from '@/api/client'

const kinds = [
 {value:'TOPPING',label:'Thêm topping / extra shot'},
 {value:'PREMIUM',label:'Thành phần cao cấp'},
]
export function UpsellOptionsSection(){
 const {message,modal}=App.useApp()
 const qc=useQueryClient()
 const [open,setOpen]=useState(false)
 const [edit,setEdit]=useState<UpsellOption|null>(null)
 const [busy,setBusy]=useState(false)
 const [recipeId,setRecipeId]=useState<number|null>(null)
 const [recipeLines,setRecipeLines]=useState<Array<{materialId?:number;quantity?:number}>>([])
 const materials=useQuery({queryKey:['upsell-materials'],queryFn:async()=>{
   const r=await apiClient.get<Array<{id:number;name:string;unit:string}>>('/materials');return r.data
 }})
 async function openRecipe(id:number){try{const lines=await upsellOptionApi.ingredients(id);setRecipeLines(lines.length?lines.map(x=>({materialId:x.materialId,quantity:x.quantity})):[{}]);setRecipeId(id)}catch(e){message.error(errorMessage(e))}}
 async function deleteOption(item:UpsellOption){
   modal.confirm({
     title:'Xóa tùy chọn Upsell?',
     content:`Xóa vĩnh viễn "${item.name}" của món ${item.coffeeName}? Nếu đã dùng trong giỏ hoặc đơn, hệ thống sẽ từ chối xóa; hãy dùng Tắt.`,
     okText:'Xóa',okType:'danger',cancelText:'Hủy',
     onOk:async()=>{
       try{
         await upsellOptionApi.remove(item.id)
         message.success('Đã xóa tùy chọn')
         await qc.invalidateQueries({queryKey:['upsell-option-catalog']})
       }catch(e){message.error(errorMessage(e));throw e}
     }
   })
 }
 async function saveRecipe(){if(!recipeId)return;try{
   if(recipeLines.some(x=>!x.materialId||!x.quantity||x.quantity<=0))throw Error('Chọn nguyên liệu và nhập lượng lớn hơn 0')
   setBusy(true);await upsellOptionApi.setIngredients(recipeId,recipeLines as Array<{materialId:number;quantity:number}>);
   message.success('Đã lưu định lượng nguyên liệu');setRecipeId(null);await qc.invalidateQueries({queryKey:['upsell-option-catalog']})
 }catch(e){message.error(errorMessage(e))}finally{setBusy(false)}}
 const [form]=Form.useForm<UpsellOptionInput>()
 const options=useQuery({queryKey:['upsell-option-catalog'],queryFn:upsellOptionApi.list})
 const menu=useQuery({queryKey:['upsell-menu'],queryFn:merchandisingApi.placementOverview})
 const coffees=menu.data?.coffees||[]
 function start(item:UpsellOption|null){setEdit(item);form.resetFields();form.setFieldsValue(item?{coffeeId:item.coffeeId,kind:item.kind,name:item.name,extraPrice:item.extraPrice,enabled:item.enabled}:{kind:'TOPPING',extraPrice:0,enabled:false});setOpen(true)}
 async function save(){try{const x=await form.validateFields();setBusy(true);const payload={...x,extraVolumeMl:null};if(edit)await upsellOptionApi.update(edit.id,payload);else await upsellOptionApi.create(payload);message.success('Đã lưu tùy chọn. Hãy cấu hình nguyên liệu để khách được chọn.');setOpen(false);await qc.invalidateQueries({queryKey:['upsell-option-catalog']})}catch(e){if(e&&typeof e==='object'&&'errorFields'in e)return;message.error(errorMessage(e))}finally{setBusy(false)}}
 return <Card style={{marginTop:20}} title="Danh mục topping / thành phần cao cấp" extra={<Button onClick={()=>start(null)}>+ Tạo tùy chọn</Button>}>
  <Typography.Paragraph type="warning">Tùy chọn chỉ xuất hiện phía khách khi được bật và đã cấu hình nguyên liệu. Phụ phí được app-core tính lại khi mua; định lượng nguyên liệu được trừ lúc xác nhận đơn.</Typography.Paragraph>
  <Table<UpsellOption> rowKey="id" loading={options.isLoading} dataSource={(options.data||[]).filter(item=>item.kind!=='SIZE')} pagination={{pageSize:8}} columns={[
   {title:'Món',dataIndex:'coffeeName'},{title:'Loại',dataIndex:'kind',render:(v:string)=>kinds.find(x=>x.value===v)?.label||v},
   {title:'Tùy chọn',dataIndex:'name'},{title:'Phụ phí',dataIndex:'extraPrice',render:(v:number)=>`${Number(v).toLocaleString('vi-VN')}đ`},
   {title:'Cấu hình',render:(_:unknown,r:UpsellOption)=><Space><Tag color={r.enabled?'green':'default'}>{r.enabled?'Bật':'Tắt'}</Tag><Tag color={r.recipeReady?'green':'orange'}>{r.recipeReady?'Có công thức':'Chưa có công thức'}</Tag></Space>},
   {title:'Thao tác',render:(_:unknown,r:UpsellOption)=><Space><Button size="small" onClick={()=>start(r)}>Sửa</Button><Button size="small" onClick={()=>openRecipe(r.id)}>Nguyên liệu</Button><Button size="small" danger disabled={!r.enabled} onClick={()=>modal.confirm({title:'Tắt tùy chọn?',onOk:async()=>{try{await upsellOptionApi.disable(r.id);await qc.invalidateQueries({queryKey:['upsell-option-catalog']})}catch(e){message.error(errorMessage(e))}}})}>Tắt</Button><Button size="small" danger onClick={()=>deleteOption(r)}>Xóa</Button></Space>}
  ]}/>
  <Modal title={edit?'Sửa tùy chọn':'Thêm tùy chọn mới'} open={open} onCancel={()=>setOpen(false)} onOk={save} confirmLoading={busy} okText="Lưu cấu hình" destroyOnHidden>
   <Form form={form} layout="vertical">
    <Form.Item name="coffeeId" label="Món gốc" rules={[{required:true,message:'Chọn món'}]}><Select showSearch optionFilterProp="label" options={coffees.map(c=>({value:c.id,label:c.name}))}/></Form.Item>
    <Form.Item name="kind" label="Kiểu nâng cấp" rules={[{required:true}]}><Select options={kinds}/></Form.Item>
    <Form.Item name="name" label="Tên tùy chọn" rules={[{required:true,message:'Nhập tên'}]}><Input maxLength={100} placeholder="Ví dụ: Thêm 1 shot espresso"/></Form.Item>
    <Form.Item name="extraPrice" label="Phụ phí dự kiến (đ)" rules={[{required:true}]}><InputNumber min={0} style={{width:'100%'}}/></Form.Item>
    <Form.Item name="enabled" label="Cho phép cấu hình" valuePropName="checked"><Switch/></Form.Item>
   </Form>
  </Modal>
  <Modal title="Định lượng nguyên liệu tăng thêm cho mỗi ly" open={recipeId!==null} onCancel={()=>setRecipeId(null)} onOk={saveRecipe} confirmLoading={busy} okText="Lưu công thức">
   <Typography.Paragraph type="secondary">Chỉ khai báo lượng nguyên liệu BỔ SUNG cho tùy chọn này; đơn vị phải đúng với bảng nguyên liệu. Ví dụ một shot bổ sung sẽ tiêu hao lượng cà phê bổ sung thực tế.</Typography.Paragraph>
   {recipeLines.map((x,i)=><Space key={i} style={{display:'flex',marginBottom:8}}>
     <Select showSearch optionFilterProp="label" placeholder="Nguyên liệu" style={{width:250}} value={x.materialId} onChange={v=>setRecipeLines(old=>old.map((y,j)=>j===i?{...y,materialId:v}:y))}
       options={(materials.data||[]).map(m=>({value:m.id,label:`${m.name} (${m.unit})`}))}/>
     <InputNumber min={0.01} step={0.01} placeholder="Số lượng" value={x.quantity} onChange={v=>setRecipeLines(old=>old.map((y,j)=>j===i?{...y,quantity:v??undefined}:y))}/>
     <Button danger onClick={()=>setRecipeLines(old=>old.filter((_,j)=>j!==i))}>Xóa</Button>
   </Space>)}
   <Button onClick={()=>setRecipeLines(old=>[...old,{}])}>+ Nguyên liệu</Button>
  </Modal>
 </Card>
}
