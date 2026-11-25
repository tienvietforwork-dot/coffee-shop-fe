import { PageHeader } from "@/admin/components/PageHeader";
import { ServiceGate } from "@/admin/components/ServiceGate";
import { useQuery } from "@tanstack/react-query";
import { promotionsApi } from "@/api/promotions";
import type {
  Promotion,
  PromotionItem,
  PromotionScope,
  PromotionType,
} from "@/api/promotions";
import {
  Avatar,
  Button,
  Checkbox,
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
import { date, imageSrc, money } from "@/lib/format";
import {
  DeleteOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useAction } from "@/admin/components/useCrud";
import { MoneyInput } from "@/admin/components/MoneyInput";
import dayjs from "dayjs";
import { coreApi } from "@/api/core";

// 1. CONSTANTS & MAPPINGS

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
  ACTIVE: { label: "Đang diễn ra", color: "#52c41a" },
  PAUSED: { label: "Tạm dừng", color: "#faad14" },
  ENDED: { label: "Đã kết thúc", color: "#ff4d4f" },
};

const SCOPE_FILTER_OPTIONS = (
  Object.keys(DISCOUNT_SCOPE) as PromotionScope[]
).map((value) => ({ value, label: DISCOUNT_SCOPE[value].label }));

const TYPE_FILTER_OPTIONS = (Object.keys(DISCOUNT_TYPE) as PromotionType[]).map(
  (value) => ({ value, label: DISCOUNT_TYPE[value].label }),
);

interface DiscountBand {
  value: string;
  label: string;
  min: number;
  max?: number;
  inclusiveMax?: boolean;
  exclusiveMin?: boolean;
}

const PERCENTAGE_DISCOUNT_BANDS: DiscountBand[] = [
  { value: "0-5", label: "0 - 5%", min: 0, max: 5 },
  { value: "5-10", label: "5 - 10%", min: 5, max: 10 },
  { value: "10-20", label: "10 - 20%", min: 10, max: 20 },
  { value: "20-50", label: "20 - 50%", min: 20, max: 50, inclusiveMax: true },
  { value: "50+", label: "Trên 50%", min: 50, exclusiveMin: true },
];

const AMOUNT_DISCOUNT_BANDS: DiscountBand[] = [
  { value: "0-1000", label: "0 - 1.000đ", min: 0, max: 1000 },
  { value: "1000-5000", label: "1.000 - 5.000đ", min: 1000, max: 5000 },
  { value: "5000-10000", label: "5.000 - 10.000đ", min: 5000, max: 10000 },
  {
    value: "10000-20000",
    label: "10.000 - 20.000đ",
    min: 10000,
    max: 20000,
  },
  {
    value: "20000-50000",
    label: "20.000 - 50.000đ",
    min: 20000,
    max: 50000,
  },
  {
    value: "50000-100000",
    label: "50.000 - 100.000đ",
    min: 50000,
    max: 100000,
    inclusiveMax: true,
  },
  {
    value: "100000+",
    label: "Trên 100.000đ",
    min: 100000,
    exclusiveMin: true,
  },
];

// 2. COMPONENT IMPLEMENTATION

export function PromotionsPage() {
  // A. UI STATE & FORMS
  const [edit, setEdit] = useState<Partial<Promotion> | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<PromotionScope>();
  const [typeFilter, setTypeFilter] = useState<PromotionType>();
  const [selectedCoffeeId, setSelectedCoffeeId] = useState<number>();
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [selectedPromotionCoffeeIds, setSelectedPromotionCoffeeIds] = useState<
    number[]
  >([]);
  const [bulkDiscount, setBulkDiscount] = useState<number | null>(null);
  const [bulkDiscountHasValue, setBulkDiscountHasValue] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState<number | null>(null);
  const [promotionCoffeeSearch, setPromotionCoffeeSearch] = useState("");
  const [promotionDiscountBand, setPromotionDiscountBand] = useState<string>();

  const [form] = Form.useForm();
  const scope = Form.useWatch("applyScope", form);
  const discountType = Form.useWatch("discountType", form);

  // B. QUERIES (DATA FETCHING)
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

  // C. MUTATIONS & ACTIONS
  const mutationKeys = [["promotions"], ["menu"]];

  const act = useAction(
    (v: { id: number; op: "active" | "pause" | "end" | "clone" | "remove" }) =>
      promotionsApi[v.op](v.id),
    mutationKeys,
    "Đã cập nhật",
  );

  const save = useAction(promotionsApi.save, mutationKeys);

  // D. DERIVED DATA & COMPUTATIONS
  const normalizedNameSearch = nameSearch.trim().toLocaleLowerCase("vi");

  const visiblePromotions = data.filter(
    (promotion) =>
      (!normalizedNameSearch ||
        promotion.name
          .toLocaleLowerCase("vi")
          .includes(normalizedNameSearch)) &&
      (!scopeFilter || promotion.applyScope === scopeFilter) &&
      (!typeFilter || promotion.discountType === typeFilter),
  );

  const hasPromotionFilters =
    !!normalizedNameSearch || !!scopeFilter || !!typeFilter;

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

  const discountTypes: PromotionType[] =
    scope === "COFFEE"
      ? ["PERCENTAGE", "FIXED_AMOUNT", "SPECIAL"]
      : ["PERCENTAGE", "FIXED_AMOUNT"];

  const discountBands =
    discountType === "PERCENTAGE"
      ? PERCENTAGE_DISCOUNT_BANDS
      : AMOUNT_DISCOUNT_BANDS;
  const normalizedCoffeeSearch = promotionCoffeeSearch
    .trim()
    .toLocaleLowerCase("vi");
  const selectedDiscountBand = discountBands.find(
    (band) => band.value === promotionDiscountBand,
  );
  const visiblePromotionItems = promotionItems.filter((item) => {
    const matchesName =
      !normalizedCoffeeSearch ||
      item.coffeeName.toLocaleLowerCase("vi").includes(normalizedCoffeeSearch);
    const discount = Number(item.customDiscount ?? 0);
    const matchesDiscount =
      !selectedDiscountBand ||
      ((selectedDiscountBand.exclusiveMin
        ? discount > selectedDiscountBand.min
        : discount >= selectedDiscountBand.min) &&
        (selectedDiscountBand.max === undefined ||
          (selectedDiscountBand.inclusiveMax
            ? discount <= selectedDiscountBand.max
            : discount < selectedDiscountBand.max)));
    return matchesName && matchesDiscount;
  });

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

  // E. HANDLERS & FORM ACTIONS
  const openPromotion = (promotion: Partial<Promotion>) => {
    form.resetFields();
    setSelectedCoffeeId(undefined);
    setPromotionItems(promotion.items ?? []);
    setSelectedPromotionCoffeeIds([]);
    setBulkDiscount(null);
    setBulkDiscountHasValue(false);
    setBulkQuantity(null);
    setPromotionCoffeeSearch("");
    setPromotionDiscountBand(undefined);
    form.setFieldsValue(
      promotion.id !== undefined
        ? {
            name: promotion.name,
            description: promotion.description,
            applyScope: promotion.applyScope ?? "ORDER",
            discountType: promotion.discountType ?? "PERCENTAGE",
            discountPercent: promotion.discountPercent,
            minOrderAmount: promotion.minOrderAmount,
            period: [
              dayjs(promotion.startDate),
              dayjs(promotion.endDate),
            ],
          }
        : {
            name: promotion.name,
            description: promotion.description,
            applyScope: promotion.applyScope ?? "ORDER",
            discountType: promotion.discountType ?? "PERCENTAGE",
            discountPercent: promotion.discountPercent,
            minOrderAmount: promotion.minOrderAmount,
            period: [dayjs(), dayjs().add(30, "day")],
          },
    );
    setEdit(promotion);
  };

  const calculateSalePrice = (
    coffeePrice: number,
    discount: number,
    type: PromotionType = discountType,
  ) => {
    const salePrice =
      type === "SPECIAL"
        ? discount
        : type === "FIXED_AMOUNT"
          ? Math.max(0, coffeePrice - discount)
          : Math.max(0, Math.round((coffeePrice * (100 - discount)) / 100));
    return salePrice;
  };

  const addCoffeeToPromotion = () => {
    if (!selectedCoffeeId) return;
    if (promotionItems.some((item) => item.coffeeId === selectedCoffeeId))
      return;

    const coffee = coffees.find(
      (candidate) => candidate.id === selectedCoffeeId,
    );
    if (!coffee) return;

    const discount = Number(form.getFieldValue("discountPercent") ?? 0);
    setPromotionItems((items) => [
      ...items,
      {
        coffeeId: coffee.id,
        coffeeName: coffee.name,
        customDiscount: discount,
        salePrice: calculateSalePrice(coffee.price, discount),
        maxQuantity: 1,
      },
    ]);
    setSelectedCoffeeId(undefined);
  };

  const updatePromotionItem = (
    coffeeId: number,
    patch: Partial<PromotionItem>,
  ) => {
    setPromotionItems((items) =>
      items.map((item) => {
        if (item.coffeeId !== coffeeId) return item;

        const updated = { ...item, ...patch };
        if (patch.customDiscount !== undefined) {
          const coffee = coffees.find((candidate) => candidate.id === coffeeId);
          if (coffee) {
            updated.salePrice = calculateSalePrice(
              coffee.price,
              Number(patch.customDiscount ?? 0),
            );
          }
        }
        return updated;
      }),
    );
  };

  const updateSelectedPromotionItems = (patch: Partial<PromotionItem>) => {
    const selectedIds = new Set(selectedPromotionCoffeeIds);
    if (selectedIds.size === 0) return;

    setPromotionItems((items) =>
      items.map((item) => {
        if (!selectedIds.has(item.coffeeId)) return item;

        const updated = { ...item, ...patch };
        if (patch.customDiscount !== undefined) {
          const coffee = coffees.find(
            (candidate) => candidate.id === item.coffeeId,
          );
          if (coffee) {
            updated.salePrice = calculateSalePrice(
              coffee.price,
              patch.customDiscount,
            );
          }
        }
        return updated;
      }),
    );
  };

  const removeSelectedPromotionItems = () => {
    const selectedIds = new Set(selectedPromotionCoffeeIds);
    setPromotionItems((items) =>
      items.filter((item) => !selectedIds.has(item.coffeeId)),
    );
    setSelectedPromotionCoffeeIds([]);
  };

  const hasBulkChanges = bulkDiscountHasValue || bulkQuantity !== null;

  // F. RENDER COMPONENT
  return (
    <>
      {/* Page Header */}
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

      {/* Main Content & Filters */}
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            allowClear
            aria-label="Tìm khuyến mãi theo tên"
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên khuyến mãi"
            value={nameSearch}
            onChange={(event) => setNameSearch(event.target.value)}
            style={{ width: 300 }}
          />
          <Select<PromotionScope>
            allowClear
            aria-label="Lọc theo phạm vi áp dụng"
            placeholder="Áp dụng cho"
            value={scopeFilter}
            onChange={setScopeFilter}
            options={SCOPE_FILTER_OPTIONS}
            style={{ width: 190 }}
          />
          <Select<PromotionType>
            allowClear
            aria-label="Lọc theo hình thức giảm"
            placeholder="Hình thức giảm"
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
            style={{ width: 190 }}
          />
        </Space>

        <Table
          className="promotions-table"
          rowKey="id"
          dataSource={visiblePromotions}
          locale={{
            emptyText: hasPromotionFilters
              ? "Không tìm thấy khuyến mãi phù hợp"
              : "Chưa có chương trình khuyến mãi",
          }}
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
                const scopeItem = DISCOUNT_SCOPE[p.applyScope];
                return <Tag color={scopeItem?.color}>{scopeItem?.label}</Tag>;
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
                      : money(p.discountPercent);
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
                    {p.status !== "ENDED" && p.status !== "ACTIVE" && (
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
                            ? [{ key: "remove", label: "Xóa bản nháp", danger: true }]
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
                      <Button className="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  </Space>
                );
              },
            },
          ]}
        />
      </ServiceGate>

      {/* Modal Create / Edit Promotion */}
      <Modal
        open={!!edit}
        title={edit?.id ? "Sửa đợt giảm giá" : "Tạo đợt giảm giá"}
        footer={null}
        onCancel={() => {
          setEdit(null);
          setSelectedCoffeeId(undefined);
          setPromotionItems([]);
          setSelectedPromotionCoffeeIds([]);
          setBulkDiscount(null);
          setBulkDiscountHasValue(false);
          setBulkQuantity(null);
        }}
        destroyOnHidden
        centered
        width={1200}
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
                items: v.applyScope === "COFFEE" ? promotionItems : [],
              },
              {
                onSuccess: () => {
                  setEdit(null);
                  setSelectedCoffeeId(undefined);
                  setPromotionItems([]);
                  setSelectedPromotionCoffeeIds([]);
                  setBulkDiscount(null);
                  setBulkDiscountHasValue(false);
                  setBulkQuantity(null);
                },
              },
            )
          }
        >
          <div className="promotion-form-layout">
            <div>
              <Form.Item
                name="name"
                label="Tên chương trình"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="description" label="Mô tả">
                <Input.TextArea rows={5} />
              </Form.Item>
            </div>

            <div>
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
                      setPromotionDiscountBand(undefined);
                      setBulkDiscount(null);
                      setBulkDiscountHasValue(false);
                      setPromotionItems((items) =>
                        items.map((item) => {
                          const coffee = coffees.find(
                            (candidate) => candidate.id === item.coffeeId,
                          );
                          return coffee
                            ? {
                                ...item,
                                salePrice: calculateSalePrice(
                                  coffee.price,
                                  item.customDiscount,
                                  selectedType,
                                ),
                              }
                            : item;
                        }),
                      );
                    }
                  }}
                />
              </Form.Item>

              <div className="a-grid-2">
                <Form.Item
                  name="discountPercent"
                  label={discountFieldLabel}
                  rules={[{ required: scope === "ORDER" }]}
                >
                  {discountType === "FIXED_AMOUNT" ||
                  discountType === "SPECIAL" ? (
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
                  <DatePicker.RangePicker
                    showTime
                    format="DD/MM HH:mm"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          {scope === "COFFEE" && (
            <div>
              <div className="promotion-coffee-controls">
                <Space.Compact style={{ width: "100%" }}>
                  <Select
                    showSearch
                    allowClear
                    value={selectedCoffeeId}
                    onChange={setSelectedCoffeeId}
                    placeholder="Chọn cà phê"
                    optionFilterProp="label"
                    options={coffees
                      .filter(
                        (coffee) =>
                          !promotionItems.some(
                            (item) => item.coffeeId === coffee.id,
                          ),
                      )
                      .map((coffee) => ({
                        value: coffee.id,
                        label: coffee.name,
                      }))}
                    optionRender={(option) => {
                      const coffee = coffees.find(
                        (candidate) => candidate.id === option.value,
                      );
                      return (
                        <Space>
                          <Avatar
                            shape="square"
                            size={32}
                            src={imageSrc(coffee?.imageUrl)}
                          >
                            ☕
                          </Avatar>
                          <span>{coffee?.name}</span>
                        </Space>
                      );
                    }}
                    style={{ width: "calc(100% - 150px)" }}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={addCoffeeToPromotion}
                    disabled={!selectedCoffeeId}
                    style={{ width: 150 }}
                  >
                    Thêm cà phê
                  </Button>
                </Space.Compact>

                <div className="promotion-coffee-filters">
                  <Input.Search
                    allowClear
                    aria-label="Tìm cà phê trong khuyến mãi"
                    placeholder="Tìm tên cà phê"
                    prefix={<SearchOutlined />}
                    value={promotionCoffeeSearch}
                    onChange={(event) =>
                      setPromotionCoffeeSearch(event.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                  <Select
                    allowClear
                    aria-label="Lọc cà phê theo mức giảm"
                    placeholder={
                      discountType === "PERCENTAGE"
                        ? "Lọc theo phần trăm giảm"
                        : discountType === "SPECIAL"
                          ? "Lọc theo giá đặc biệt"
                          : "Lọc theo số tiền giảm"
                    }
                    value={promotionDiscountBand}
                    onChange={setPromotionDiscountBand}
                    options={discountBands.map(({ value, label }) => ({
                      value,
                      label,
                    }))}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {selectedPromotionCoffeeIds.length > 0 && (
                <Space
                  className="promotion-bulk-actions"
                  wrap
                  style={{ width: "720px", marginBottom: 12 }}
                >
                  <span
                    aria-live="polite"
                    style={{ marginTop: 12, marginRight: 12 }}
                  >
                    <b> Đã chọn: {selectedPromotionCoffeeIds.length} cà phê</b>
                  </span>
                  {discountType === "PERCENTAGE" ? (
                    <InputNumber
                      min={0}
                      max={100}
                      addonAfter="%"
                      placeholder="Phần trăm giảm"
                      value={bulkDiscount}
                      onChange={(value) => {
                        setBulkDiscount(value);
                        setBulkDiscountHasValue(value !== null);
                      }}
                      style={{ width: 180 }}
                    />
                  ) : (
                    <InputNumber<number>
                      min={0}
                      step={1000}
                      addonAfter="đ"
                      placeholder={
                        discountType === "SPECIAL"
                          ? "Giá đặc biệt"
                          : "Số tiền giảm"
                      }
                      value={bulkDiscount}
                      onChange={setBulkDiscount}
                      onInput={(value) =>
                        setBulkDiscountHasValue(value.trim() !== "")
                      }
                      formatter={(value) =>
                        `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                      }
                      parser={(value) => {
                        const parsedValue = (value ?? "").replace(/\./g, "");
                        return parsedValue === "" ? 0 : Number(parsedValue);
                      }}
                      style={{ width: 180 }}
                    />
                  )}
                  <InputNumber
                    min={1}
                    precision={0}
                    placeholder="Số lượng tối đa"
                    value={bulkQuantity}
                    onChange={setBulkQuantity}
                    style={{ width: 180 }}
                  />
                  <Button
                    danger={!hasBulkChanges}
                    type={hasBulkChanges ? "primary" : "default"}
                    icon={hasBulkChanges ? undefined : <DeleteOutlined />}
                    onClick={() => {
                      if (hasBulkChanges) {
                        const patch: Partial<PromotionItem> = {};
                        if (bulkDiscountHasValue) {
                          patch.customDiscount = bulkDiscount ?? 0;
                        }
                        if (bulkQuantity !== null) {
                          patch.maxQuantity = bulkQuantity;
                        }
                        updateSelectedPromotionItems(patch);
                      } else {
                        removeSelectedPromotionItems();
                      }
                    }}
                  >
                    {hasBulkChanges ? "Chỉnh sửa" : "Xóa"}
                  </Button>
                </Space>
              )}

              <Table<PromotionItem>
                className="promotion-items-table"
                size="small"
                rowKey="coffeeId"
                pagination={false}
                scroll={{ y: 256 }}
                dataSource={visiblePromotionItems}
                locale={{
                  emptyText:
                    promotionItems.length === 0
                      ? "Chưa có cà phê trong khuyến mãi"
                      : "Không tìm thấy cà phê phù hợp",
                }}
                columns={[
                  {
                    title: (
                      <Checkbox
                        aria-label="Chọn tất cả cà phê đang hiển thị"
                        disabled={visiblePromotionItems.length === 0}
                        checked={
                          visiblePromotionItems.length > 0 &&
                          visiblePromotionItems.every((item) =>
                            selectedPromotionCoffeeIds.includes(item.coffeeId),
                          )
                        }
                        indeterminate={
                          visiblePromotionItems.some((item) =>
                            selectedPromotionCoffeeIds.includes(item.coffeeId),
                          ) &&
                          !visiblePromotionItems.every((item) =>
                            selectedPromotionCoffeeIds.includes(item.coffeeId),
                          )
                        }
                        onChange={(event) => {
                          const visibleIds = new Set(
                            visiblePromotionItems.map((item) => item.coffeeId),
                          );
                          setSelectedPromotionCoffeeIds((selectedIds) =>
                            event.target.checked
                              ? Array.from(
                                  new Set([...selectedIds, ...visibleIds]),
                                )
                              : selectedIds.filter((id) => !visibleIds.has(id)),
                          );
                        }}
                      />
                    ),
                    width: 48,
                    align: "center",
                    render: (_, item) => (
                      <Checkbox
                        aria-label={`Chọn ${item.coffeeName}`}
                        checked={selectedPromotionCoffeeIds.includes(
                          item.coffeeId,
                        )}
                        onChange={(event) =>
                          setSelectedPromotionCoffeeIds((selectedIds) =>
                            event.target.checked
                              ? [...selectedIds, item.coffeeId]
                              : selectedIds.filter(
                                  (id) => id !== item.coffeeId,
                                ),
                          )
                        }
                      />
                    ),
                  },
                  {
                    title: "Hình ảnh",
                    width: 90,
                    render: (_, item) => {
                      const coffee = coffees.find(
                        (candidate) => candidate.id === item.coffeeId,
                      );
                      return (
                        <Avatar
                          shape="square"
                          size={48}
                          src={imageSrc(coffee?.imageUrl)}
                        >
                          ☕
                        </Avatar>
                      );
                    },
                  },
                  {
                    title: "Tên cà phê",
                    dataIndex: "coffeeName",
                    width: 250,
                  },
                  {
                    title: "Giá coffee",
                    width: 160,
                    align: "right",
                    render: (_, item) => {
                      const coffee = coffees.find(
                        (candidate) => candidate.id === item.coffeeId,
                      );
                      return money(coffee?.price ?? 0);
                    },
                  },
                  {
                    title:
                      discountType === "PERCENTAGE"
                        ? "Giảm (%)"
                        : discountType === "FIXED_AMOUNT"
                          ? "Số tiền giảm"
                          : "Giá đặc biệt",
                    dataIndex: "customDiscount",
                    width: 200,
                    render: (value, item) =>
                      discountType === "PERCENTAGE" ? (
                        <InputNumber
                          min={1}
                          max={100}
                          addonAfter="%"
                          value={value}
                          onChange={(next) =>
                            updatePromotionItem(item.coffeeId, {
                              customDiscount: Number(next ?? 0),
                            })
                          }
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <MoneyInput
                          value={value}
                          onChange={(next) =>
                            updatePromotionItem(item.coffeeId, {
                              customDiscount: Number(next ?? 0),
                            })
                          }
                        />
                      ),
                  },
                  {
                    title: "Giá sau giảm",
                    dataIndex: "salePrice",
                    width: 180,
                    align: "right",
                    render: (value) => money(value ?? 0),
                  },
                  {
                    title: "Số lượng tối đa",
                    dataIndex: "maxQuantity",
                    width: 200,
                    render: (value, item) => (
                      <InputNumber
                        min={1}
                        precision={0}
                        value={value}
                        onChange={(next) =>
                          updatePromotionItem(item.coffeeId, {
                            maxQuantity: Number(next ?? 1),
                          })
                        }
                        style={{ width: "100%" }}
                      />
                    ),
                  },
                ]}
              />
            </div>
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
