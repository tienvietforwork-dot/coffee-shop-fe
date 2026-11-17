import apiClient from './client'
// app-stats currently supports product-to-product premium upgrades only.
export type UpsellType='PREMIUM_VERSION'
export interface UpsellRule {id:number; name:string; anchorCoffeeId:number;anchorName:string;upgradeCoffeeId:number;upgradeName:string;upgradePrice:number;basePrice:number;upgradeType:UpsellType;priority:number;minCartAmount:number;startsAt?:string|null;endsAt?:string|null;status:string;compatible?:boolean;experienceNote?:string|null;impressions:number;accepts:number;imageUrl?:string;description?:string}
export type UpsellPayload={name:string;anchorCoffeeId:number;upgradeCoffeeId:number;upgradeType:UpsellType;priority:number;minCartAmount:number;startsAt:string|null;endsAt:string|null}
export interface UpsellVariantLink {id:number;baseCoffeeId:number;baseName:string;variantCoffeeId:number;variantName:string;upgradeType:UpsellType;enabled:boolean;experienceNote?:string|null;basePrice:number;variantPrice:number}
export type UpsellVariantInput={baseCoffeeId:number;variantCoffeeId:number;upgradeType:UpsellType;recipeConfirmed:boolean;experienceConfirmed:boolean;experienceNote:string}
const base='/stats/upsell'
export const upsellApi={
 variants:async()=>(await apiClient.get<UpsellVariantLink[]>(base+'/variants')).data,
 registerVariant:async(x:UpsellVariantInput)=>apiClient.post(base+'/variants',x),
 disableVariant:async(id:number)=>apiClient.post(base+'/variants/'+id+'/disable'),
 compatible:async(anchorCoffeeId:number,upgradeType:UpsellType)=>(await apiClient.get<Array<{coffeeId:number;coffeeName:string;price:number;experienceNote:string}>>(base+'/compatible',{params:{anchorCoffeeId,upgradeType}})).data,
 rules:async()=>(await apiClient.get<UpsellRule[]>(base+'/rules')).data,
 create:async(x:UpsellPayload)=>(await apiClient.post<UpsellRule>(base+'/rules',x)).data,
 update:async(id:number,x:UpsellPayload)=>(await apiClient.put<UpsellRule>(base+'/rules/'+id,x)).data,
 activate:async(id:number)=>(await apiClient.post<UpsellRule>(base+'/rules/'+id+'/activate')).data,
 pause:async(id:number)=>(await apiClient.post<UpsellRule>(base+'/rules/'+id+'/pause')).data,
 remove:async(id:number)=>(await apiClient.delete(base+'/rules/'+id)).data,
 preview:async(id:number)=>(await apiClient.get<UpsellRule[]>(base+'/rules/'+id+'/preview')).data,
 analytics:async(id:number)=>(await apiClient.get<{impressions:number;accepts:number;acceptRate:number;note:string}>(base+'/rules/'+id+'/analytics')).data,
 suggestions:async(anchorCoffeeId:number,cartTotal:number)=>(await apiClient.get<UpsellRule[]>('/stats/public/merchandising/upsell',{params:{anchorCoffeeId,cartTotal}})).data,
 event:async(ruleId:number,impressionId:string,eventType:'IMPRESSION'|'ACCEPT')=>apiClient.post('/stats/public/merchandising/upsell/events',{ruleId,impressionId,eventType})
}

