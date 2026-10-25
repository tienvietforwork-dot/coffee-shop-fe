import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { recommendationApi } from '@/api/recommendation'
import type { MenuCoffee } from '@/api/types'
import { imageSrc, money } from '@/lib/format'
/** Product context recommendations. Add-to-cart telemetry is emitted when the user chooses the add action, not when the order succeeds. */
export function RecommendationSuggestions({anchor,onPick}:{anchor:MenuCoffee;onPick:(coffee:MenuCoffee)=>void}){
 const {data=[]}=useQuery({queryKey:['recommendation',anchor.id],queryFn:()=>recommendationApi.suggestions(anchor.id)});
 const impression=useMemo(()=>crypto.randomUUID(),[anchor.id]);
 useEffect(()=>{for(const r of data)recommendationApi.event(r.ruleId,r.coffeeId,impression,'IMPRESSION').catch(()=>{})},[data,impression]);
 if(!data.length)return null;
 return <section className="cross-sell-guest"><strong>Có thể bạn thích</strong><p>Gợi ý theo món đang xem</p><div className="cross-sell-items">{data.map(r=><button key={`${r.ruleId}-${r.coffeeId}`} className="cross-sell-choice" type="button" onClick={()=>{recommendationApi.event(r.ruleId,r.coffeeId,impression,'CLICK').catch(()=>{});onPick({id:r.coffeeId,name:r.coffeeName,price:r.price,description:r.description??undefined,available:true,imageUrl:r.imageUrl??undefined})}}>{r.imageUrl&&<img src={imageSrc(r.imageUrl)} alt=""/>}<span>{r.coffeeName}<small>{money(r.price)}</small></span><b>+</b></button>)}</div></section>
}
