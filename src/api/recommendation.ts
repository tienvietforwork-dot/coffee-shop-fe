import apiClient from './client'
export type RecommendationType='PRODUCT'|'CATEGORY'|'SIMILAR'
export type RecommendationRule={id:number;name:string;type:RecommendationType;anchorCoffeeId:number;anchorName:string;targetCoffeeId:number|null;targetName:string|null;priority:number;status:string;impressions:number;clicks:number;addToCart:number}
export type RecommendationPayload={name:string;type:RecommendationType;anchorCoffeeId:number;targetCoffeeId:number|null;priority:number}
export type RecommendationItem={ruleId:number;coffeeId:number;coffeeName:string;price:number;imageUrl?:string|null;description?:string|null;reason:string;priority:number}
const base='/stats/recommendation'
export const recommendationApi={
 rules:async()=>(await apiClient.get<RecommendationRule[]>(`${base}/rules`)).data,
 create:async(x:RecommendationPayload)=>(await apiClient.post(`${base}/rules`,x)).data,
 update:async(id:number,x:RecommendationPayload)=>(await apiClient.put(`${base}/rules/${id}`,x)).data,
 activate:async(id:number)=>(await apiClient.post(`${base}/rules/${id}/activate`)).data,
 pause:async(id:number)=>(await apiClient.post(`${base}/rules/${id}/pause`)).data,
 remove:async(id:number)=>(await apiClient.delete(`${base}/rules/${id}`)).data,
 preview:async(id:number,anchorCoffeeId:number)=>(await apiClient.get<RecommendationItem[]>(`${base}/rules/${id}/preview`,{params:{anchorCoffeeId}})).data,
 analytics:async(id:number)=>(await apiClient.get<RecommendationRule&{clickThroughRate:number;purchasesTracked:boolean;note:string}>(`${base}/rules/${id}/analytics`)).data,
 suggestions:async(anchorCoffeeId:number)=>(await apiClient.get<RecommendationItem[]>('/stats/public/merchandising/recommendation',{params:{anchorCoffeeId}})).data,
 event:async(ruleId:number,coffeeId:number,impressionId:string,eventType:'IMPRESSION'|'CLICK'|'ADD_TO_CART')=>apiClient.post('/stats/public/merchandising/recommendation/events',{ruleId,coffeeId,impressionId,eventType})
}
