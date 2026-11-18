import { useEffect, useMemo, useState } from 'react'
import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { Modal } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { upsellApi, type UpsellRule } from '@/api/upsell'
import { DEFAULT_IMAGE, imageSrc, money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'

const fallbackImage = DEFAULT_IMAGE

/** Lets a guest compare a curated coffee recommendation before replacing their current choice. */
export function UpsellSuggestions({anchor,onPick}:{anchor:MenuCoffee;onPick:(coffee:MenuCoffee)=>void}){
 const {data=[]}=useQuery({queryKey:['upsell',anchor.id],queryFn:()=>upsellApi.suggestions(anchor.id)})
 const [selected,setSelected]=useState<UpsellRule|null>(null)
 const impression=useMemo(()=>crypto.randomUUID(),[anchor.id])
 useEffect(()=>{for(const r of data)upsellApi.event(r.id,impression,'IMPRESSION').catch(()=>{})},[data,impression])
 if(!data.length)return null

 const photo=(url?:string)=>imageSrc(url)||fallbackImage
 const priceDifference=(rule:UpsellRule)=>Number(rule.upgradePrice)-Number(rule.basePrice)
 const differenceLabel=(rule:UpsellRule)=>{
  const difference=priceDifference(rule)
  return difference>0?`Giá cao hơn ${money(difference)}`:difference<0?`Giá thấp hơn ${money(Math.abs(difference))}`:'Cùng giá'
 }
 const choose=(rule:UpsellRule)=>{
  upsellApi.event(rule.id,impression,'ACCEPT').catch(()=>{})
  onPick({id:rule.upgradeCoffeeId,name:rule.upgradeName,description:rule.description,price:Number(rule.upgradePrice),imageUrl:rule.imageUrl,available:true})
  setSelected(null)
 }

 return <>
  <section className="upsell-guest" aria-label="Đề xuất món cho khách">
   <div className="upsell-guest-heading">
    <span className="upsell-kicker">GỢI Ý THEO GU CỦA BẠN</span>
    <strong>Một món khác có thể hợp với bạn</strong>
    <p>So sánh hương vị và giá với món bạn đang chọn trước khi đổi món.</p>
   </div>
   <div className="upsell-current-choice">
    <img src={photo(anchor.imageUrl)} alt="" onError={e=>{e.currentTarget.src=fallbackImage}} />
    <span><small>BẠN ĐANG CHỌN</small><strong>{anchor.name}</strong></span>
    <b>{money(anchor.price)}</b>
   </div>
   <div className="upsell-suggestion-list">
    {data.map(rule=><button type="button" key={rule.id} className="upsell-suggestion-card" onClick={()=>setSelected(rule)} aria-haspopup="dialog">
     <img className="upsell-suggestion-photo" src={photo(rule.imageUrl)} alt={rule.upgradeName} loading="lazy" onError={e=>{e.currentTarget.src=fallbackImage}} />
     <span className="upsell-suggestion-copy">
      <small className="upsell-suggestion-label">MÓN ĐƯỢC ĐỀ XUẤT</small>
      <strong>{rule.upgradeName}</strong>
      <span className="upsell-suggestion-reason">{rule.experienceNote || 'Một lựa chọn khác phù hợp với gu thưởng thức của bạn.'}</span>
      <span className="upsell-suggestion-price">{money(Number(rule.upgradePrice))}<i>{differenceLabel(rule)}</i></span>
     </span>
     <span className="upsell-compare-link">So sánh <ArrowRightOutlined /></span>
    </button>)}
   </div>
  </section>

  <Modal open={!!selected} onCancel={()=>setSelected(null)} footer={null} centered width={540} zIndex={1200} className="upsell-detail-modal" destroyOnHidden>
   {selected && <div className="upsell-detail">
    <span className="upsell-kicker">COFFEEHOLIC MATCH</span>
    <h3>Món khác cùng gu của bạn</h3>
    <p className="upsell-detail-intro">So sánh món hiện tại với món được đề xuất. Giá có thể cao hơn, thấp hơn hoặc bằng.</p>
    <div className="upsell-comparison">
     <div className="upsell-comparison-product">
      <img src={photo(anchor.imageUrl)} alt={anchor.name} onError={e=>{e.currentTarget.src=fallbackImage}} />
      <small>BẠN ĐANG CHỌN</small>
      <strong>{anchor.name}</strong>
      <span>{money(anchor.price)}</span>
     </div>
     <ArrowRightOutlined className="upsell-comparison-arrow" />
     <div className="upsell-comparison-product is-suggestion">
      <img src={photo(selected.imageUrl)} alt={selected.upgradeName} onError={e=>{e.currentTarget.src=fallbackImage}} />
      <small>MÓN ĐƯỢC ĐỀ XUẤT</small>
      <strong>{selected.upgradeName}</strong>
      <span>{money(Number(selected.upgradePrice))}</span>
     </div>
    </div>
    <div className="upsell-match-reason">
     <CheckCircleFilled />
     <div><strong>Vì sao món này được gợi ý</strong><p>{selected.experienceNote || 'Hai món được chọn để phù hợp với cùng gu thưởng thức.'}</p><p>{differenceLabel(selected)} so với {anchor.name}</p></div>
    </div>
    {selected.description && <p className="upsell-suggestion-description">{selected.description}</p>}
    <button type="button" className="upsell-confirm" onClick={()=>choose(selected)}>Chọn {selected.upgradeName}<span>{money(Number(selected.upgradePrice))}</span></button>
    <button type="button" className="upsell-keep-current" onClick={()=>setSelected(null)}>Tiếp tục với {anchor.name}</button>
   </div>}
  </Modal>
 </>
}
