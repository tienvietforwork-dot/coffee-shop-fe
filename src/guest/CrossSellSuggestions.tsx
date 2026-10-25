import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crossSellApi } from '@/api/crossSell'
import { imageSrc, money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'

const fallback = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80'
/** Suggested companions to the coffee currently being viewed; no unapproved rules displayed. */
export function CrossSellSuggestions({anchor,cartTotal,onPick}:{anchor:MenuCoffee;cartTotal:number;onPick:(coffee:MenuCoffee)=>void}) {
  const {data=[]}=useQuery({queryKey:['cross-sell',anchor.id,cartTotal],queryFn:()=>crossSellApi.recommendations(anchor.id,cartTotal),retry:1})
  const impressionId=useMemo(()=>crypto.randomUUID(),[anchor.id,cartTotal])
  useEffect(()=>{
    for(const item of data){crossSellApi.event(item.ruleId,item.coffeeId,impressionId,'IMPRESSION').catch(()=>{})}
  },[data,impressionId])
  if(!data.length)return null
  return <section className="cross-sell-guest"><strong>Thường dùng cùng món này</strong><p>Bạn có thể thích thêm</p>
    <div className="cross-sell-items">{data.map(x=><button key={`${x.ruleId}-${x.coffeeId}`} type="button" className="cross-sell-choice" onClick={()=>{
      crossSellApi.event(x.ruleId,x.coffeeId,impressionId,'CLICK').catch(()=>{})
      onPick({id:x.coffeeId,name:x.coffeeName,description:x.description,price:x.price,imageUrl:x.imageId?`/api/public/images/${x.imageId}`:x.imageUrl,available:true})
    }}><img src={imageSrc(x.imageId?`/api/public/images/${x.imageId}`:x.imageUrl)||fallback} alt=""/><span>{x.coffeeName}<small>{money(x.price)}</small></span><b>+</b></button>)}</div>
  </section>
}
