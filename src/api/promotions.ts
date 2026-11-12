import apiClient from "./client";

/*
 * app-promotions API (routed by nginx-gateway: /api/promotions/* -> app-promotions).
 * Contract expected by the admin UI. Tables: promotions, promotion_items, vouchers.
 * Checkout itself (applying running promotions / validating vouchers) is done by app-core.
 */
export type PromotionScope = "ORDER" | "COFFEE";
export type PromotionStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "PAUSE"
  | "ENDED";
export type PromotionType = "PERCENTAGE" | "FIXED_AMOUNT" | "SPECIAL";
export type VoucherStatus = "ISSUED" | "USED" | "EXPIRED" | "REVOKED";
export type IncidentType =
  | "WRONG_ITEM"
  | "QUALITY"
  | "LATE"
  | "SPILLED"
  | "MISSING_ITEM"
  | "OTHER";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH";
export type VoucherType = "PERCENTAGE" | "FIXED_AMOUNT";
export type VoucherTypeStatus = "DRAFT" | "ACTIVE" | "ENDED";

export interface PromotionItem {
  id?: number;
  coffeeId: number;
  coffeeName: string;
  customDiscount: number;
  salePrice: number;
  maxQuantity: number;
  soldQuantity?: number;
}

export interface Promotion {
  id?: number;
  name: string;
  description?: string;
  applyScope: PromotionScope;
  discountType?: PromotionType;
  discountPercent?: number;
  minOrderAmount?: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus | string;
  items?: PromotionItem[];
}

export type PromotionPayload = Omit<Promotion, "id" | "status" | "items"> & {
  items?: PromotionItem[];
};

export type VoucherPayload = Omit<Voucher, "id" | "status" | "validDays"> & {
  validDate: number;
};

export interface VoucherDetail {
  id?: number;
  orderId?: number;
  orderCode?: string;
  customerId: number;
  customerName: string;
  customerPhone: number;
  incidentId?: string;
  incidentType?: IncidentType;
  incidentSeverity?: IncidentSeverity;
  code: string;
  status: VoucherStatus;
  issuedAt: string;
  expiresAt: string;
}

export interface Voucher {
  id?: number;
  name: string;
  discountType?: VoucherType;
  discountValue: number;
  minOrderValue: number;
  quantity: number;
  maxQuantity: number;
  validDays: number;
  status: VoucherTypeStatus;
  items?: VoucherDetail[];
}

export interface PromotionAnalyticsResponse {
  vouchers: {
    issued: number;
    used: number;
    usageRate: number;
    discountTotal: number;
  };
  baseline: {
    avgOrderValue: number;
  };
  promotions: Array<{
    id: number;
    name: string;
    status: PromotionStatus | string;
    orders: number;
    revenue: number;
    discountTotal: number;
    avgOrderValue: number;
    roi?: number | null;
  }>;
}

const base = "/promotions";
const base_2 = "/vouchers";

export const promotionsApi = {
  list: () => apiClient.get<Promotion[]>(base).then((r) => r.data),
  active: (id: number) =>
    apiClient.post(`${base}/${id}/active`).then((r) => r.data),
  pause: (id: number) =>
    apiClient.post(`${base}/${id}/pause`).then((r) => r.data),
  end: (id: number) => apiClient.post(`${base}/${id}/end`).then((r) => r.data),
  clone: (id: number) =>
    apiClient.post(`${base}/${id}/clone`).then((r) => r.data),
  remove: (id: number) =>
    apiClient.delete(`${base}/${id}/remove`).then((r) => r.data),

  save: (b: PromotionPayload & { id?: number }) =>
    (b.id
      ? apiClient.put<Promotion>(`${base}/${b.id}`, b)
      : apiClient.post<Promotion>(base, b)
    ).then((r) => r.data),
  analytics: (from: string, to: string) =>
    apiClient
      .get<PromotionAnalyticsResponse>(`${base}/analytics`, {
        params: { from, to },
      })
      .then((r) => r.data),

  vouchers: () => apiClient.get<Voucher[]>(base_2).then((r) => r.data),
  activeVoucher: (id: number) =>
    apiClient.post(`${base_2}/${id}/active`).then((r) => r.data),
  endVoucher: (id: number) =>
    apiClient.post(`${base_2}/${id}/end`).then((r) => r.data),
  cloneVoucher: (id: number) =>
    apiClient.post(`${base_2}/${id}/clone`).then((r) => r.data),
  removeVoucher: (id: number) =>
    apiClient.delete(`${base_2}/${id}/remove`).then((r) => r.data),
  saveVoucher: (b: VoucherPayload & { id?: number }) =>
    (b.id
      ? apiClient.put<Voucher>(`${base_2}/${b.id}`, b)
      : apiClient.post<Voucher>(base_2, b)
    ).then((r) => r.data),
};
