import { useEffect,useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { upsellApi } from '@/api/upsell'
import { money } from '@/lib/format'
import type { MenuCoffee } from '@/api/types'
/** In the guest modal this replaces the intended choice before a line is added to cart.
 * The server remains responsible for stock and the final selling price. */
export function UpsellSuggestions({anchor,cartTotal,onPick}:{anchor:MenuCoffee;cartTotal:number;onPick:(coffee:MenuCoffee)=>void}){
 const {data=[]}=useQuery({queryKey:['upsell',anchor.id,cartTotal],queryFn:()=>upsellApi.suggestions(anchor.id,cartTotal)})
 const impression=useMemo(()=>crypto.randomUUID(),[anchor.id,cartTotal])
 useEffect(()=>{for(const r of data)upsellApi.event(r.id,impression,'IMPRESSION').catch(()=>{})},[data,impression])
 if(!data.length)return null
 return <section className="cross-sell-guest"><strong>Đổi sang phiên bản khác</strong><p>Đây là một món/SKU khác trong thực đơn. Các topping và extra shot của món đang chọn được cấu hình ở phần tùy chỉnh bên trên.</p><div className="cross-sell-items">{data.map(r=><button type="button" key={r.id} className="cross-sell-choice" onClick={()=>{
  upsellApi.event(r.id,impression,'ACCEPT').catch(()=>{});
  onPick({id:r.upgradeCoffeeId,name:r.upgradeName,description:r.description,price:Number(r.upgradePrice),imageUrl:r.imageUrl,available:true})
 }}><span><strong>{r.upgradeName}</strong><small>{money(Number(r.upgradePrice))} · thêm từ {money(Math.max(0,Number(r.upgradePrice)-Number(r.basePrice)))}</small></span><b>↑</b></button>)}</div></section>
}
