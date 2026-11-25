import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Empty, Progress, Tag } from "antd";
import { useOutletContext } from "react-router-dom";
import { promotionsApi, type VoucherTemplates } from "@/api/promotions";
import { accountApi } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { date, money } from "@/lib/format";
import { ServiceGate } from "@/admin/components/ServiceGate";
import { useAuthStore } from "@/store/authStore";
import { usePerm, P } from "@/lib/perm";

function progressPercent(current: number, required: number) {
  if (required <= 0) return 100;
  return Math.min(Math.round((current / required) * 100), 100);
}

function progressColor(percent: number) {
  const colors = [
    "#ff4d4f",
    "#ff7a45",
    "#ffa940",
    "#ffc53d",
    "#fadb14",
    "#a0d911",
    "#7cb305",
    "#52c41a",
    "#389e0d",
    "#237804",
    "#135200",
  ];
  return colors[Math.floor(Math.min(Math.max(percent, 0), 100) / 10)];
}

function completedOrdersSince(
  orders: { status: string; orderedAt: string; totalAmount: number }[],
  startDate: string,
) {
  const start = new Date(startDate).getTime();
  return orders.filter(
    (order) =>
      order.status === "COMPLETED" &&
      (!Number.isFinite(start) ||
        !order.orderedAt ||
        new Date(order.orderedAt).getTime() >= start),
  );
}

export function RewardsPage() {
  const { isAuthenticated } = useAuthStore();
  const { can } = usePerm();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { openAuth } = useOutletContext<{ openAuth: () => void }>();
  const canViewAccount = isAuthenticated && can(P.ACCOUNT);
  const profile = useQuery({
    queryKey: ["account"],
    queryFn: accountApi.profile,
    enabled: canViewAccount,
    refetchInterval: 30_000,
  });
  const orders = useQuery({
    queryKey: ["account-orders"],
    queryFn: accountApi.orders,
    enabled: canViewAccount,
    refetchInterval: 30_000,
  });

  const {
    data: templates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["available-voucher-templates"],
    queryFn: () => promotionsApi.availableVoucherTemplates(),
    retry: false,
    refetchInterval: 30_000,
  });
  const redeem = useMutation({
    mutationFn: promotionsApi.redeemVoucherTemplate,
    onSuccess: (voucher, templateId) => {
      message.success(`Đổi voucher thành công${voucher.code ? `: ${voucher.code}` : ""}`);
      const template = templates.find((item) => item.id === templateId);
      if (template) {
        queryClient.setQueryData(
          ["account"],
          (account: { loyaltyPoints?: number } | undefined) =>
            account
              ? {
                  ...account,
                  loyaltyPoints: Math.max(
                    0,
                    (account.loyaltyPoints ?? 0) - template.requiredPoints,
                  ),
                }
              : account,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["account"] });
      queryClient.invalidateQueries({ queryKey: ["account-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["account-points"] });
      queryClient.invalidateQueries({ queryKey: ["available-voucher-templates"] });
    },
    onError: (e) => message.error(errorMessage(e)),
  });

  return (
    <div className="g-container g-page g-narrow">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h1 className="g-page-title" style={{ marginBottom: 20 }}>
          Đổi thưởng
        </h1>
        {canViewAccount && (
          <Tag
            color="gold"
            style={{
              margin: "0 0 20px",
              padding: "8px 12px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 999,
            }}
          >
            {profile.isLoading
              ? "Đang tải điểm..."
              : profile.isError
                ? "Không tải được điểm"
                : `${profile.data?.loyaltyPoints ?? 0} điểm thưởng`}
          </Tag>
        )}
      </div>
      <p className="g-muted">
        Khám phá các voucher khả dụng và số điểm cần để đổi.
      </p>
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        {templates.length === 0 ? (
          <Empty description="Hiện chưa có voucher khả dụng" />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {templates.map((template) => {
              const periodCompletedOrders = completedOrdersSince(
                orders.data ?? [],
                template.startDate,
              );
              const periodTotalAmount = periodCompletedOrders.reduce(
                (total, order) => total + order.totalAmount,
                0,
              );
              const requiredCount = template.completedOrderCount ?? 0;
              const requiredAmount = template.minOrderAmount ?? 0;
              const qualifyingOrderCount = periodCompletedOrders.filter(
                (order) => order.totalAmount >= requiredAmount,
              ).length;
              const meetsOrderRequirement =
                template.orderType === "ALL" ||
                (template.orderType === "COUNT" &&
                  periodCompletedOrders.length >= requiredCount) ||
                (template.orderType === "AMOUNT" &&
                  periodTotalAmount >= requiredAmount) ||
                (template.orderType === "COUNT_AMOUNT" &&
                  qualifyingOrderCount >= requiredCount);
              const hasOrderRequirement = template.orderType !== "ALL";
              const hasEnoughPoints =
                (profile.data?.loyaltyPoints ?? 0) >= template.requiredPoints;
              const redeemedQuantity = template.redeemedQuantity ?? 0;
              const reachedPersonalLimit =
                template.maxQuantity > 0 &&
                redeemedQuantity >= template.maxQuantity;
              const reachedVoucherLimit =
                template.voucherMaxQuantity != null &&
                template.voucherMaxQuantity > 0 &&
                (template.voucherQuantity ?? 0) >= template.voucherMaxQuantity;
              let redemptionUnavailableReason = "";
              if (reachedVoucherLimit) {
                redemptionUnavailableReason = "Voucher đã hết";
              } else if (reachedPersonalLimit) {
                redemptionUnavailableReason = "Bạn đã hết lượt đổi voucher";
              } else if (!hasEnoughPoints) {
                redemptionUnavailableReason = "Đã hết điểm voucher";
              }
              const canRedeem =
                canViewAccount &&
                !!profile.data &&
                !reachedPersonalLimit &&
                !reachedVoucherLimit &&
                hasEnoughPoints &&
                meetsOrderRequirement &&
                (!hasOrderRequirement || orders.isSuccess);
              const redeemButtonText = !isAuthenticated
                ? "Đăng nhập để đổi"
                : !canViewAccount
                  ? "Chỉ dành cho khách hàng"
                  : profile.isLoading
                    ? "Đang tải tài khoản..."
                    : !profile.data
                      ? "Không tải được tài khoản"
                      : hasOrderRequirement && orders.isLoading
                        ? "Đang tải điều kiện..."
                        : hasOrderRequirement && orders.isError
                          ? "Không tải được điều kiện"
                          : redemptionUnavailableReason
                            ? redemptionUnavailableReason
                            : !meetsOrderRequirement
                              ? "Chưa đủ điều kiện"
                              : "Đổi voucher";

              return (
                <Card
                  key={template.id}
                  className="g-panel"
                  title={template.name}
                  extra={<Tag color="gold">{template.requiredPoints} điểm</Tag>}
                >
                  <div>
                    <strong>{template.voucherName || "Voucher"}</strong>
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {template.orderType === "ALL" && (
                      <div className="g-muted">
                        Điều kiện: Không yêu cầu đơn hàng
                      </div>
                    )}

                    {template.orderType === "COUNT_AMOUNT" && (
                      <div>
                        {(() => {
                          const requiredCount =
                            template.completedOrderCount ?? 0;
                          const requiredAmount = template.minOrderAmount ?? 0;

                          return (
                            <>
                              <div
                                className="g-muted"
                                style={{ marginBottom: 4 }}
                              >
                                Hoàn thành {qualifyingOrderCount}/
                                {requiredCount} đơn có giá trị{" "}
                                {money(requiredAmount)} trở lên
                              </div>
                              <Progress
                                percent={progressPercent(
                                  qualifyingOrderCount,
                                  requiredCount,
                                )}
                                strokeColor={progressColor(
                                  progressPercent(
                                    qualifyingOrderCount,
                                    requiredCount,
                                  ),
                                )}
                                size="small"
                              />
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {template.orderType === "COUNT" && (
                      <div>
                        <div className="g-muted" style={{ marginBottom: 4 }}>
                          Hoàn thành số đơn: {periodCompletedOrders.length}/
                          {requiredCount}
                        </div>
                        <Progress
                          percent={progressPercent(
                            periodCompletedOrders.length,
                            requiredCount,
                          )}
                          strokeColor={progressColor(
                            progressPercent(
                              periodCompletedOrders.length,
                              requiredCount,
                            ),
                          )}
                          size="small"
                        />
                      </div>
                    )}

                    {template.orderType === "AMOUNT" && (
                      <div>
                        <div className="g-muted" style={{ marginBottom: 4 }}>
                          Tổng giá trị mua:{" "}
                          {money(periodTotalAmount)}
                          /{money(requiredAmount)}
                        </div>
                        <Progress
                          percent={progressPercent(
                            periodTotalAmount,
                            requiredAmount,
                          )}
                          strokeColor={progressColor(
                            progressPercent(
                              periodTotalAmount,
                              requiredAmount,
                            ),
                          )}
                          size="small"
                        />
                      </div>
                    )}
                  </div>
                  <div className="g-muted">
                    Thời hạn: {date(template.startDate)} –{" "}
                    {date(template.endDate)}
                  </div>
                  <Button
                    type="primary"
                    style={{ marginTop: 12 }}
                    disabled={isAuthenticated && (!canRedeem || redeem.isPending)}
                    loading={redeem.isPending && redeem.variables === template.id}
                    onClick={() =>
                      isAuthenticated
                        ? redeem.mutate(template.id)
                        : openAuth()
                    }
                  >
                    {redeemButtonText}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </ServiceGate>
    </div>
  );
}
