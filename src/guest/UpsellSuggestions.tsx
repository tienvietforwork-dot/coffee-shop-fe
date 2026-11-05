import { useEffect, useMemo, useState } from 'react'
import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { Modal } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { upsellApi, type UpsellRule } from '@/api/upsell'
import { imageSrc, money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'

const fallbackImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80'

/** Lets a guest compare a curated, higher-priced coffee before replacing their current choice. */
export function UpsellSuggestions({anchor,cartTotal,onPick}:{anchor:MenuCoffee;cartTotal:number;onPick:(coffee:MenuCoffee)=>void}){
 const {data=[]}=useQuery({queryKey:['upsell',anchor.id,cartTotal],queryFn:()=>upsellApi.suggestions(anchor.id,cartTotal)})
 const [selected,setSelected]=useState<UpsellRule|null>(null)
 const impression=useMemo(()=>crypto.randomUUID(),[anchor.id,cartTotal])
 useEffect(()=>{for(const r of data)upsellApi.event(r.id,impression,'IMPRESSION').catch(()=>{})},[data,impression])
 if(!data.length)return null

 const photo=(url?:string)=>imageSrc(url)||fallbackImage
 const difference=(rule:UpsellRule)=>Math.max(0,Number(rule.upgradePrice)-Number(rule.basePrice))
 const choose=(rule:UpsellRule)=>{
  upsellApi.event(rule.id,impression,'ACCEPT').catch(()=>{})
  onPick({id:rule.upgradeCoffeeId,name:rule.upgradeName,description:rule.description,price:Number(rule.upgradePrice),imageUrl:rule.imageUrl,available:true})
  setSelected(null)
 }

 return <>
  <section className="upsell-guest" aria-label="Gợi ý nâng cấp món">
   <div className="upsell-guest-heading">
    <span className="upsell-kicker">GỢI Ý THEO GU CỦA BẠN</span>
    <strong>Thử một phiên bản cao cấp hơn</strong>
    <p>Xem ảnh và lý do món này hợp với lựa chọn hiện tại của bạn.</p>
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
      <small className="upsell-suggestion-label">NÂNG CẤP MÓN</small>
      <strong>{rule.upgradeName}</strong>
      <span className="upsell-suggestion-reason">{rule.experienceNote || 'Một lựa chọn cao cấp hơn dành cho cùng gu thưởng thức.'}</span>
      <span className="upsell-suggestion-price">{money(Number(rule.upgradePrice))}<i>Thêm {money(difference(rule))}</i></span>
     </span>
     <span className="upsell-compare-link">So sánh <ArrowRightOutlined /></span>
    </button>)}
   </div>
  </section>

  <Modal open={!!selected} onCancel={()=>setSelected(null)} footer={null} centered width={540} zIndex={1200} className="upsell-detail-modal" destroyOnHidden>
   {selected && <div className="upsell-detail">
    <span className="upsell-kicker">COFFEEHOLIC MATCH</span>
    <h3>Cùng gu, khác cách pha</h3>
    <p className="upsell-detail-intro">So sánh món bạn chọn với gợi ý nâng cấp trước khi đổi món.</p>
    <div className="upsell-comparison">
     <div className="upsell-comparison-product">
      <img src={photo(anchor.imageUrl)} alt={anchor.name} onError={e=>{e.currentTarget.src=fallbackImage}} />
      <small>BẠN ĐANG CHỌN</small>
      <strong>{anchor.name}</strong>
      <span>{money(anchor.price)}</span>
     </div>
     <ArrowRightOutlined className="upsell-comparison-arrow" />
     <div className="upsell-comparison-product is-upgrade">
      <img src={photo(selected.imageUrl)} alt={selected.upgradeName} onError={e=>{e.currentTarget.src=fallbackImage}} />
      <small>GỢI Ý NÂNG CẤP</small>
      <strong>{selected.upgradeName}</strong>
      <span>{money(Number(selected.upgradePrice))}</span>
     </div>
    </div>
    <div className="upsell-match-reason">
     <CheckCircleFilled />
     <div><strong>Điểm chung về trải nghiệm vị</strong><p>{selected.experienceNote || 'Hai món được chọn để phù hợp với cùng gu thưởng thức.'}</p></div>
    </div>
    {selected.description && <p className="upsell-upgrade-description">{selected.description}</p>}
    <button type="button" className="upsell-confirm" onClick={()=>choose(selected)}>Chọn {selected.upgradeName}<span>+{money(difference(selected))}</span></button>
    <button type="button" className="upsell-keep-current" onClick={()=>setSelected(null)}>Tiếp tục với {anchor.name}</button>
   </div>}
  </Modal>
 </>
}
