import apiClient from './client'
export type UpsellType='LARGER_SIZE'|'PREMIUM_VERSION'|'PREMIUM_ADDON'
export interface UpsellRule {id:number; name:string; anchorCoffeeId:number;anchorName:string;upgradeCoffeeId:number;upgradeName:string;upgradePrice:number;basePrice:number;upgradeType:UpsellType;priority:number;minCartAmount:number;startsAt?:string|null;endsAt?:string|null;status:string;compatible?:boolean;impressions:number;accepts:number;imageUrl?:string;description?:string}
export type UpsellPayload={name:string;anchorCoffeeId:number;upgradeCoffeeId:number;upgradeType:UpsellType;priority:number;minCartAmount:number;startsAt:string|null;endsAt:string|null}
export interface UpsellVariantLink {id:number;baseCoffeeId:number;baseName:string;variantCoffeeId:number;variantName:string;upgradeType:UpsellType;enabled:boolean;basePrice:number;variantPrice:number}
export type UpsellVariantInput={baseCoffeeId:number;variantCoffeeId:number;upgradeType:UpsellType;recipeConfirmed:boolean}
const base='/stats/upsell'
export const upsellApi={
 variants:async()=>(await apiClient.get<UpsellVariantLink[]>(`${base}/variants`)).data,
 registerVariant:async(x:UpsellVariantInput)=>apiClient.post(`${base}/variants`,x),
 disableVariant:async(id:number)=>apiClient.post(`${base}/variants/${id}/disable`),
 compatible:async(anchorCoffeeId:number,upgradeType:UpsellType)=>(await apiClient.get<Array<{coffeeId:number;coffeeName:string;price:number}>>(`${base}/compatible`,{params:{anchorCoffeeId,upgradeType}})).data,
 rules:async()=>(await apiClient.get<UpsellRule[]>(`${base}/rules`)).data,
 create:async(x:UpsellPayload)=>(await apiClient.post(`${base}/rules`,x)).data,
 update:async(id:number,x:UpsellPayload)=>(await apiClient.put(`${base}/rules/${id}`,x)).data,
 activate:async(id:number)=>(await apiClient.post(`${base}/rules/${id}/activate`)).data,
 pause:async(id:number)=>(await apiClient.post(`${base}/rules/${id}/pause`)).data,
 remove:async(id:number)=>(await apiClient.delete(`${base}/rules/${id}`)).data,
 preview:async(id:number)=>(await apiClient.get<UpsellRule[]>(`${base}/rules/${id}/preview`)).data,
 analytics:async(id:number)=>(await apiClient.get<{impressions:number;accepts:number;acceptRate:number;note:string}>(`${base}/rules/${id}/analytics`)).data,
 suggestions:async(anchorCoffeeId:number,cartTotal:number)=>(await apiClient.get<UpsellRule[]>('/stats/public/merchandising/upsell',{params:{anchorCoffeeId,cartTotal}})).data,
 event:async(ruleId:number,impressionId:string,eventType:'IMPRESSION'|'ACCEPT')=>apiClient.post('/stats/public/merchandising/upsell/events',{ruleId,impressionId,eventType})
}

export type UpsellOptionKind='SIZE'|'TOPPING'|'PREMIUM'
export type UpsellOptionInput={coffeeId:number;kind:UpsellOptionKind;name:string;extraPrice:number;extraVolumeMl?:number|null;enabled:boolean}
export type UpsellOption=UpsellOptionInput&{id:number;coffeeName:string;recipeReady:boolean}
export const upsellOptionApi={
  list:async()=>(await apiClient.get<UpsellOption[]>('/stats/upsell/options')).data,
  create:async(x:UpsellOptionInput)=>apiClient.post('/stats/upsell/options',x),
  update:async(id:number,x:UpsellOptionInput)=>apiClient.put(`/stats/upsell/options/${id}`,x),
  disable:async(id:number)=>apiClient.post(`/stats/upsell/options/${id}/disable`),
  remove:async(id:number)=>apiClient.delete(`/stats/upsell/options/${id}`),
  ingredients:async(id:number)=>(await apiClient.get<Array<{materialId:number;materialName:string;unit:string;quantity:number}>>(`/stats/upsell/options/${id}/ingredients`)).data,
  setIngredients:async(id:number,ingredients:Array<{materialId:number;quantity:number}>)=>apiClient.put(`/stats/upsell/options/${id}/ingredients`,ingredients),
}
