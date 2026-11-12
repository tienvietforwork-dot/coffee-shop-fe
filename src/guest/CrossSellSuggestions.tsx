import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crossSellApi } from '@/api/crossSell'
import { DEFAULT_IMAGE, imageSrc, money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'
import type { SuggestionTracking } from './suggestionTracking'

const fallback = DEFAULT_IMAGE
/** Sellable food/add-on companions supplied by active cross-sell rules. */
export function CrossSellSuggestions({anchor,cartTotal,onPick}:{anchor:MenuCoffee;cartTotal:number;onPick:(coffee:MenuCoffee, tracking:SuggestionTracking)=>void}) {
  const {data=[]}=useQuery({queryKey:['cross-sell',anchor.id,cartTotal],queryFn:()=>crossSellApi.recommendations(anchor.id,cartTotal),retry:1})
  const impressionId=useMemo(()=>`${anchor.id}-${cartTotal}-${crypto.randomUUID()}`,[anchor.id,cartTotal])
  useEffect(()=>{
    for(const item of data){crossSellApi.event(item.ruleId,item.coffeeId,impressionId,'IMPRESSION').catch(()=>{})}
  },[data,impressionId])
  if(!data.length)return null
  return <section className="cross-sell-guest"><strong>Món bán kèm</strong><p>Thêm bánh, đồ ăn hoặc món thêm vào đơn</p>
    <div className="cross-sell-items">{data.map(x=><button key={`${x.ruleId}-${x.coffeeId}`} type="button" className="cross-sell-choice" onClick={()=>{
      crossSellApi.event(x.ruleId,x.coffeeId,impressionId,'CLICK').catch(()=>{})
      onPick({id:x.coffeeId,name:x.coffeeName,description:x.description,price:x.price,imageUrl:x.imageId?`/api/public/images/${x.imageId}`:x.imageUrl,available:true},{source:'cross-sell',ruleId:x.ruleId,coffeeId:x.coffeeId,impressionId})
    }}><img src={imageSrc(x.imageId?`/api/public/images/${x.imageId}`:x.imageUrl)||fallback} alt=""/><span>{x.coffeeName}<small>{money(x.price)}</small></span><b>+</b></button>)}</div>
  </section>
}
