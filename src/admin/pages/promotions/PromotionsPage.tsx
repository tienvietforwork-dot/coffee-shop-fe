import { PageHeader } from "@/admin/components/PageHeader";
import { ServiceGate } from "@/admin/components/ServiceGate";
import { useQuery } from "@tanstack/react-query";
import { promotionsApi } from "@/api/promotions";
import type {
  Promotion,
  PromotionScope,
  PromotionType,
} from "@/api/promotions";
import {
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { date, money } from "@/lib/format";
import {
  MinusCircleOutlined,
  MoreOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useAction } from "@/admin/components/useCrud";
import { MoneyInput } from "@/admin/components/MoneyInput";
import dayjs from "dayjs";
import { coreApi } from "@/api/core";

const DISCOUNT_SCOPE: Record<PromotionScope, { label: string; color: string }> =
  {
    ORDER: { label: "Áp dụng cho Order", color: "#1677ff" },
    COFFEE: { label: "Áp dụng cho Coffee", color: "#722ed1" },
  };

const DISCOUNT_TYPE: Record<PromotionType, { label: string; color: string }> = {
  PERCENTAGE: { label: "Giảm theo phần trăm", color: "#FF5722" },
  FIXED_AMOUNT: { label: "Giảm số tiền cố định", color: "#009688" },
  SPECIAL: { label: "Ưu đãi đặc biệt", color: "#ffb300" },
};

export const PROMO_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Nháp", color: "#8c8c8c" },
  ACTIVE: { label: "Đang sử dụng", color: "#52c41a" },
  PAUSED: { label: "Tạm dừng", color: "#faad14" },
  ENDED: { label: "Đã kết thúc", color: "#ff4d4f" },
};

export function PromotionsPage() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["promotions"],
    queryFn: promotionsApi.list,
    retry: false,
  });
  const { data: coffees = [] } = useQuery({
    queryKey: ["coffees"],
    queryFn: coreApi.coffees,
  });
  const [edit, setEdit] = useState<Partial<Promotion> | null>(null);

  const act = useAction(
    (v: { id: number; op: "active" | "pause" | "end" | "clone" | "remove" }) =>
      promotionsApi[v.op](v.id),
    [["promotions"], ["menu"]],
    "Đã cập nhật",
  );

  const [form] = Form.useForm();
  const openPromotion = (promotion: Partial<Promotion>) => {
    form.setFieldsValue({
      name: promotion.name,
      description: promotion.description,
      applyScope: promotion.applyScope ?? "ORDER",
      discountType: promotion.discountType ?? "PERCENTAGE",
      discountPercent: promotion.discountPercent,
      minOrderAmount: promotion.minOrderAmount,
      period: promotion.startDate
        ? [dayjs(promotion.startDate), dayjs(promotion.endDate)]
        : undefined,
      items: promotion.items ?? [],
    });
    setEdit(promotion);
  };
  const scope = Form.useWatch("applyScope", form);
  const discountType = Form.useWatch("discountType", form);
  const updateItemSalePrice = (
    index: number,
    changed: { coffeeId?: number; customDiscount?: number | null },
  ) => {
    const item = form.getFieldValue(["items", index]);
    const coffeeId = changed.coffeeId ?? item?.coffeeId;
    const discount =
      changed.customDiscount !== undefined
        ? changed.customDiscount
        : item?.customDiscount;
    const coffee = coffees.find((candidate) => candidate.id === coffeeId);

    if (!coffee || discount == null) {
      form.setFieldValue(["items", index, "salePrice"], undefined);
      return;
    }

    const salePrice =
      discountType === "SPECIAL"
        ? discount
        : discountType === "FIXED_AMOUNT"
          ? Math.max(0, coffee.price - discount)
          : Math.max(0, Math.round((coffee.price * (100 - discount)) / 100));
    form.setFieldValue(["items", index, "salePrice"], salePrice);
  };

  const discountFieldLabel =
    discountType === "FIXED_AMOUNT"
      ? "Số tiền giảm"
      : discountType === "SPECIAL"
        ? "Giá đồng giá"
        : "Phần trăm giảm";
  const coffeeDiscountPlaceholder =
    discountType === "FIXED_AMOUNT"
      ? "Số tiền giảm"
      : discountType === "SPECIAL"
        ? "Giá đồng giá"
        : "Phần trăm giảm";
  const keys = [["promotions"], ["menu"]];
  const save = useAction(promotionsApi.save, keys);
  const applyScopeOptions = (
    Object.keys(DISCOUNT_SCOPE) as PromotionScope[]
  ).map((value) => ({
    value,
    label: (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: DISCOUNT_SCOPE[value].color,
          }}
        />
        {DISCOUNT_SCOPE[value].label}
      </span>
    ),
  }));

  const discountTypes: PromotionType[] =
    scope === "COFFEE"
      ? ["PERCENTAGE", "FIXED_AMOUNT", "SPECIAL"]
      : ["PERCENTAGE", "FIXED_AMOUNT"];
  const discountOptions = discountTypes.map((value) => ({
    value,
    label: (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: DISCOUNT_TYPE[value].color,
          }}
        />
        {DISCOUNT_TYPE[value].label}
      </span>
    ),
  }));

  return (
    <>
      {/* Header */}
      <PageHeader
        title="Đợi giảm giá"
        subtitle="Giảm giá hóa đơn ( % và đơn tối thiểu ) hoặc cho cà phê cụ thể ( mức giảm giá riêng và số lượng tối đa )"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              openPromotion({ applyScope: "ORDER", discountType: "PERCENTAGE" })
            }
          >
            Tạo đợt giảm giá
          </Button>
        }
      />

      {/* Table */}
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        <Table
          className="promotions-table"
          rowKey="id"
          dataSource={data}
          rowClassName={(promotion) => {
            if (promotion.status === "ACTIVE") {
              return "promotion-row-activate";
            }
            if (promotion.status === "PAUSE" || promotion.status === "PAUSED") {
              return "promotion-row-paused";
            }
            return "";
          }}
          locale={{ emptyText: "Chưa có chương trình khuyến mãi" }}
          expandable={{
            rowExpandable: (p) => p.applyScope === "COFFEE",
            expandedRowRender: (p) => (
              <Table
                size="small"
                rowKey="coffeeId"
                pagination={false}
                dataSource={p.items}
                columns={[
                  { title: "Coffee", dataIndex: "coffeeName" },
                  {
                    title: "Mức giảm giá",
                    dataIndex: "customDiscount",
                    render: (v, i) => {
                      if (p.discountType === "PERCENTAGE") {
                        return `${v ?? 0}%`;
                      }
                      if (p.discountType === "FIXED_AMOUNT") {
                        return money(v);
                      }

                      if (p.discountType === "SPECIAL") {
                        return `Đồng giá ${money(v)}`;
                      }
                    },
                  },
                  {
                    title: "Đã bán / Tối đa",
                    render: (_, i) =>
                      `${i.soldQuantity ?? 0} / ${i.maxQuantity ?? 0}`,
                  },
                ]}
              />
            ),
          }}
          columns={[
            {
              title: "Tên chương trình",
              dataIndex: "name",
              render: (v, p) => (
                <>
                  <b>{v}</b>
                  <div className="a-muted small">{p.description}</div>
                </>
              ),
            },
            {
              title: "Áp dụng cho",
              render: (_, p) => {
                const scope = DISCOUNT_SCOPE[p.applyScope];
                return <Tag color={scope.color}>{scope.label}</Tag>;
              },
            },
            {
              title: "Hình thức giảm",
              render: (_, p) => {
                const type = p.discountType
                  ? DISCOUNT_TYPE[p.discountType]
                  : undefined;
                const value =
                  p.discountType === "PERCENTAGE"
                    ? `${p.discountPercent}%`
                    : p.discountType === "FIXED_AMOUNT"
                      ? money(p.discountPercent)
                      : `${p.discountPercent}`;
                return (
                  <Tag color={type?.color ?? "default"}>
                    {type ? `${type.label}: ${value}` : value}
                  </Tag>
                );
              },
            },

            {
              title: "Thời gian",
              render: (_, p) => `${date(p.startDate)} -> ${date(p.endDate)}`,
            },
            {
              title: "Trạng thái",
              render: (_, p) => {
                const status = PROMO_STATUS[p.status];
                return status ? (
                  <Tag color={status.color}>{status.label}</Tag>
                ) : (
                  <Tag>{p.status || "—"}</Tag>
                );
              },
            },

            {
              title: "Thao tác",
              render: (_, p) => {
                return (
                  <Space>
                    {p.status !== "ENDED" && (
                      <Button
                        className="small"
                        onClick={() => openPromotion(p)}
                      >
                        Sửa
                      </Button>
                    )}
                    <Dropdown
                      menu={{
                        items: [
                          ...(p.status === "DRAFT" || p.status === "PAUSED"
                            ? [{ key: "active", label: "Kích hoạt" }]
                            : []),
                          ...(p.status === "ACTIVE"
                            ? [{ key: "pause", label: "Tạm dừng" }]
                            : []),
                          ...(p.status === "ACTIVE" || p.status === "PAUSED"
                            ? [{ key: "end", label: "Kết thúc", danger: true }]
                            : []),
                          ...(p.status === "ENDED"
                            ? [{ key: "clone", label: "Nhân bản" }]
                            : []),
                          ...(p.status === "DRAFT"
                            ? [{ key: "remove", label: "Xóa bản nháp" }]
                            : []),
                        ],
                        onClick: ({ key }) => {
                          if (
                            p.id === undefined ||
                            (key !== "active" &&
                              key !== "pause" &&
                              key !== "end" &&
                              key !== "clone" &&
                              key !== "remove")
                          ) {
                            return;
                          }
                          act.mutate({ id: p.id, op: key });
                        },
                      }}
                    >
                      <Button
                        className="small"
                        icon={<MoreOutlined />}
                      ></Button>
                    </Dropdown>
                  </Space>
                );
              },
            },
          ]}
        />
      </ServiceGate>

      {/* Form */}
      <Modal
        open={!!edit}
        title={edit?.id ? "Sửa đợt giảm giá" : "Tạo đợt giảm giá"}
        footer={null}
        onCancel={() => setEdit(null)}
        destroyOnHidden
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) =>
            save.mutate(
              {
                id: edit?.id,
                name: v.name,
                description: v.description,
                applyScope: v.applyScope,
                discountType: v.discountType ?? "PERCENTAGE",
                discountPercent: v.discountPercent,
                minOrderAmount: v.minOrderAmount,
                startDate: v.period[0].format("YYYY-MM-DDTHH:mm:ss"),
                endDate: v.period[1].format("YYYY-MM-DDTHH:mm:ss"),
                items: v.applyScope === "COFFEE" ? v.items : [],
              },
              { onSuccess: () => setEdit(null) },
            )
          }
        >
          <Form.Item
            name="name"
            label="Tên chương trình"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="applyScope" label="Áp dụng cho">
            <Segmented block options={applyScopeOptions} />
          </Form.Item>
          <Form.Item name="discountType" label="Hình thức giảm">
            <Segmented
              block
              options={discountOptions}
              onChange={(value) => {
                const selectedType = discountTypes.find(
                  (type) => type === value,
                );
                if (selectedType) {
                  form.setFieldValue("discountType", selectedType);
                }
              }}
            />
          </Form.Item>

          <div className="a-grid-3">
            <Form.Item
              name="discountPercent"
              label={discountFieldLabel}
              rules={[{ required: scope === "ORDER" }]}
            >
              {discountType === "FIXED_AMOUNT" || discountType === "SPECIAL" ? (
                <MoneyInput />
              ) : (
                <InputNumber
                  min={1}
                  max={100}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
              )}
            </Form.Item>
            {scope === "ORDER" && (
              <Form.Item name="minOrderAmount" label="Đơn tối thiểu">
                <MoneyInput />
              </Form.Item>
            )}
            <Form.Item
              name="period"
              label="Thời gian áp dụng"
              rules={[{ required: true }]}
            >
              <DatePicker.RangePicker showTime format="DD/MM HH:mm" />
            </Form.Item>
          </div>
          {scope === "COFFEE" && (
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((f) => (
                    <Space key={f.key} align="baseline" wrap>
                      <Form.Item
                        name={[f.name, "coffeeId"]}
                        rules={[{ required: true }]}
                        style={{ width: 200 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="Cà phê"
                          onChange={(coffeeId: number) =>
                            updateItemSalePrice(f.name, { coffeeId })
                          }
                          options={coffees.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${money(c.price)})`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item name={[f.name, "salePrice"]}>
                        <MoneyInput
                          placeholder="Giá sau giảm"
                          style={{ width: 150 }}
                        />
                      </Form.Item>
                      <Form.Item name={[f.name, "customDiscount"]}>
                        {discountType === "PERCENTAGE" || !discountType ? (
                          <InputNumber
                            min={1}
                            max={100}
                            addonAfter="%"
                            placeholder={coffeeDiscountPlaceholder}
                            style={{ width: 150 }}
                            onChange={(value) =>
                              updateItemSalePrice(f.name, {
                                customDiscount: value,
                              })
                            }
                          />
                        ) : (
                          <MoneyInput
                            placeholder={coffeeDiscountPlaceholder}
                            style={{ width: 150 }}
                            onChange={(value) =>
                              updateItemSalePrice(f.name, {
                                customDiscount: value,
                              })
                            }
                          />
                        )}
                      </Form.Item>
                      <Form.Item name={[f.name, "maxQuantity"]}>
                        <InputNumber min={1} placeholder="SL tối đa" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(f.name)} />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        customDiscount: form.getFieldValue("discountPercent"),
                      })
                    }
                  >
                    Thêm cà phê
                  </Button>
                </>
              )}
            </Form.List>
          )}
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={save.isPending}
            style={{ marginTop: 16 }}
          >
            Lưu
          </Button>
        </Form>
      </Modal>
    </>
  );
}
