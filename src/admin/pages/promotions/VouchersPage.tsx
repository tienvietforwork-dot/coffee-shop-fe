import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Space,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Dropdown,
  Input,
  InputNumber,
  Select,
  Segmented,
  Popconfirm,
  Tabs,
  DatePicker,
} from "antd";
import {
  promotionsApi,
  type VoucherType,
  type VoucherStatus,
  type VoucherDetail,
  type VoucherDetailRequest,
  type Voucher,
  type Customer,
  type CustomerGroup,
  type CustomerGroupMember,
  type VoucherTemplates,
  type VoucherTemplatePayload,
  type VoucherTemplateCustomerType,
  type VoucherTemplateOrderType,
} from "@/api/promotions";

import { date, INCIDENT_SEVERITY, INCIDENT_TYPE, money } from "@/lib/format";
import { PageHeader } from "../../components/PageHeader";
import { ServiceGate } from "../../components/ServiceGate";
import { useState } from "react";
import type { Key } from "react";
import { MoreOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useAction } from "@/admin/components/useCrud";
import { MoneyInput } from "@/admin/components/MoneyInput";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";

// 1. CONSTANTS & MAPPINGS

const DISCOUNT_TYPE: Record<VoucherType, { label: string; color: string }> = {
  PERCENTAGE: { label: "Giảm theo phần trăm", color: "#FF5722" },
  FIXED_AMOUNT: { label: "Giảm số tiền cố định", color: "#009688" },
};

const VOUCHER_STATUS: Record<VoucherStatus, { label: string; color: string }> =
  {
    ISSUED: { label: "Chưa dùng", color: "#8c8c8c" },
    USED: { label: "Đã dùng", color: "#52c41a" },
    EXPIRED: { label: "Hết hạn", color: "#ff4d4f" },
    REVOKED: { label: "Đã thu hồi", color: "#faad14" },
  };

const VOUCHER_TYPE_STATUS = {
  DRAFT: { label: "Nháp", color: "#8c8c8c" },
  ACTIVE: { label: "Đang hoạt động", color: "#52c41a" },
  ENDED: { label: "Ngừng hoạt động", color: "#ff4d4f" },
} as const;

const VOUCHER_TEMPLATE_STATUS: Record<
  string,
  { label: string; color: string }
> = {
  DRAFT: { label: "Nháp", color: "#8c8c8c" },
  ACTIVE: { label: "Đang hoạt động", color: "#52c41a" },
  ENDED: { label: "Ngừng hoạt động", color: "#ff4d4f" },
};

const VOUCHER_TEMPLATE_CUSTOMER_TYPE_FILTER: Record<
  VoucherTemplateCustomerType,
  { label: string; color: string }
> = {
  ALL: { label: "Tất cả khách hàng", color: "#1677ff" },
  CUSTOMER_GROUP: { label: "Nhóm khách hàng", color: "#722ed1" },
};

const VOUCHER_TEMPLATE_ORDER_TYPE_FILTER: Record<
  VoucherTemplateOrderType,
  { label: string; color: string }
> = {
  ALL: { label: "Không yêu cầu", color: "#8c8c8c" },
  COUNT: { label: "Theo số đơn hoàn tất", color: "#1677ff" },
  AMOUNT: { label: "Theo giá trị đơn", color: "#52c41a" },
  COUNT_AMOUNT: { label: "Theo số đơn và giá trị", color: "#722ed1" },
};

const VOUCHER_TEMPLATE_ORDER_TYPE_FILTER_OPTIONS = (
  Object.keys(VOUCHER_TEMPLATE_ORDER_TYPE_FILTER) as VoucherTemplateOrderType[]
).map((value) => ({
  value,
  label: VOUCHER_TEMPLATE_ORDER_TYPE_FILTER[value].label,
}));

type MinOrderRange =
  | "none"
  | "1-50"
  | "50-100"
  | "100-200"
  | "200-500"
  | "500-1000"
  | "over-1000";

type CustomerTargetType = "INDIVIDUAL" | "GROUP";
type VoucherTemplateFormValues = Omit<
  VoucherTemplatePayload,
  "startDate" | "endDate"
> & { dates: [Dayjs, Dayjs] };

const DISCOUNT_FILTER_OPTIONS = (
  Object.keys(DISCOUNT_TYPE) as VoucherType[]
).map((value) => ({ value, label: DISCOUNT_TYPE[value].label }));

const MIN_ORDER_FILTER_OPTIONS: { value: MinOrderRange; label: string }[] = [
  { value: "none", label: "Không yêu cầu đơn tối thiểu" },
  { value: "1-50", label: "1.000 – 50.000đ" },
  { value: "50-100", label: "50.000 – 100.000đ" },
  { value: "100-200", label: "100.000 – 200.000đ" },
  { value: "200-500", label: "200.000 – 500.000đ" },
  { value: "500-1000", label: "500.000 – 1.000.000đ" },
  { value: "over-1000", label: "Trên 1.000.000đ" },
];

// 2. HELPER FUNCTIONS

function matchesMinOrderRange(
  voucher: Voucher,
  filter: MinOrderRange | undefined,
) {
  const minOrder = voucher.minOrderValue ?? 0;

  switch (filter) {
    case "none":
      return minOrder <= 0;
    case "1-50":
      return minOrder >= 1_000 && minOrder <= 50_000;
    case "50-100":
      return minOrder > 50_000 && minOrder <= 100_000;
    case "100-200":
      return minOrder > 100_000 && minOrder <= 200_000;
    case "200-500":
      return minOrder > 200_000 && minOrder <= 500_000;
    case "500-1000":
      return minOrder > 500_000 && minOrder <= 1_000_000;
    case "over-1000":
      return minOrder > 1_000_000;
    default:
      return true;
  }
}

// 3. COMPONENT IMPLEMENTATION

export function VouchersPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const isVoucherTemplatesPage =
    location.pathname.endsWith("/voucher-templates");

  // A. UI STATE
  const [edit, setEdit] = useState<Partial<Voucher> | null>(null);
  const [templateEdit, setTemplateEdit] =
    useState<Partial<VoucherTemplates> | null>(null);
  const [voucherForCustomer, setVoucherForCustomer] = useState<number | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerTargetType, setCustomerTargetType] =
    useState<CustomerTargetType>("INDIVIDUAL");
  const [customerGroupId, setCustomerGroupId] = useState<number>();
  const [voucherHolderSearch, setVoucherHolderSearch] = useState("");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<VoucherType>();
  const [minOrderRangeFilter, setMinOrderRangeFilter] =
    useState<MinOrderRange>();
  const [voucherTemplateNameSearch, setVoucherTemplateNameSearch] =
    useState("");
  const [templateCustomerTypeFilter, setTemplateCustomerTypeFilter] =
    useState<VoucherTemplateCustomerType>();
  const [templateOrderTypeFilter, setTemplateOrderTypeFilter] =
    useState<VoucherTemplateOrderType>();
  const [expandedVoucherKeys, setExpandedVoucherKeys] = useState<Key[]>([]);

  // Forms
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const discountType = Form.useWatch("discountType", form);
  const templateCustomerType = Form.useWatch("customerType", templateForm);
  const templateOrderType = Form.useWatch("orderType", templateForm);

  // B. QUERIES (DATA FETCHING)
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vouchers"],
    queryFn: promotionsApi.vouchers,
    retry: false,
  });

  const {
    data: voucherTemplates = [],
    isLoading: isLoadingVoucherTemplates,
    error: voucherTemplatesError,
  } = useQuery<VoucherTemplates[]>({
    queryKey: ["voucher-templates"],
    queryFn: promotionsApi.voucherTemplates,
    enabled: isVoucherTemplatesPage,
    retry: false,
  });

  const {
    data: customerGroups = [],
    isLoading: isLoadingCustomerGroups,
    error: customerGroupsError,
  } = useQuery<CustomerGroup[]>({
    queryKey: ["promotion-customer-groups"],
    queryFn: promotionsApi.customerGroups,
    enabled:
      voucherForCustomer !== null ||
      (templateEdit !== null && templateCustomerType === "CUSTOMER_GROUP"),
    retry: false,
  });

  const {
    data: allCustomerGroupMembers = [],
    isFetching: isLoadingCustomerGroupMembers,
    error: customerGroupMembersError,
  } = useQuery<CustomerGroupMember[]>({
    queryKey: ["promotion-customer-group-members"],
    queryFn: promotionsApi.customerGroupMembers,
    enabled: voucherForCustomer !== null && customerTargetType === "GROUP",
    retry: false,
  });

  const {
    data: allCustomers = [],
    isFetching: isLoadingCustomers,
    error: customerError,
  } = useQuery<Customer[]>({
    queryKey: ["promotion-customers"],
    queryFn: promotionsApi.customers,
    enabled: voucherForCustomer !== null,
    retry: false,
  });

  const selectedVoucher =
    voucherForCustomer === null
      ? undefined
      : data.find((voucher) => voucher.id === voucherForCustomer);

  const existingCustomerIds = new Set(
    (selectedVoucher?.items ?? []).map((item) => item.customerId),
  );

  const remainingVoucherQuantity = selectedVoucher
    ? Math.max(
        (selectedVoucher.maxQuantity ?? 0) - (selectedVoucher.quantity ?? 0),
        0,
      )
    : 0;

  // C. MUTATIONS & ACTIONS
  const key = [["vouchers"], ["menu"]];
  const act = useAction(
    (v: {
      id: number;
      op: "activeVoucher" | "endVoucher" | "cloneVoucher" | "removeVoucher";
    }) => promotionsApi[v.op](v.id),
    key,
    "Đã cập nhật",
  );
  const revokeVoucher = useAction(
    promotionsApi.revokeVoucher,
    key,
    "Đã thu hồi voucher",
  );
  const saveVoucher = useAction(promotionsApi.saveVoucher, key);
  const saveVoucherTemplate = useAction(
    promotionsApi.saveVoucherTemplate,
    [["voucher-templates"]],
    "Đã lưu nhiệm vụ Voucher",
  );
  const voucherTemplateAct = useAction(
    (action: {
      id: number;
      op:
        | "activeVoucherTemplate"
        | "endVoucherTemplate"
        | "cloneVoucherTemplate"
        | "removeVoucherTemplate";
    }) => promotionsApi[action.op](action.id),
    [["voucher-templates"]],
    "Đã cập nhật nhiệm vụ Voucher",
  );

  const saveCustomer = useAction(
    (b: { id: number; customerId: number }) =>
      promotionsApi.createVoucherDetails(b.id, [{ customerId: b.customerId }]),
    key,
    "Đã thêm khách hàng vào voucher",
  );

  const saveCustomers = useAction(
    (b: { id: number; customerIds: number[] }) =>
      promotionsApi.createVoucherDetails(
        b.id,
        b.customerIds.map((customerId) => ({ customerId })),
      ),
    key,
    "Đã thêm danh sách khách hàng vào voucher",
  );

  // D. DERIVED DATA & COMPUTATIONS
  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase();
  const filteredCustomers = allCustomers.filter((customer) => {
    if (!normalizedCustomerSearch) return true;
    return [customer.fullName, customer.phone, customer.email].some((value) =>
      String(value ?? "")
        .toLocaleLowerCase()
        .includes(normalizedCustomerSearch),
    );
  });

  const customerGroupMembers =
    customerGroupId === undefined
      ? []
      : allCustomerGroupMembers.filter(
          (member) => member.groupId === customerGroupId && !member.isExcluded,
        );

  const eligibleCustomerIds =
    voucherForCustomer === null
      ? []
      : (() => {
          return customerGroupMembers
            .map((member) => member.customerId)
            .filter(
              (customerId, index, ids) =>
                ids.indexOf(customerId) === index &&
                !existingCustomerIds.has(customerId),
            )
            .slice(0, remainingVoucherQuantity);
        })();

  const normalizedHolderSearch = voucherHolderSearch.trim().toLocaleLowerCase();

  const matchingVoucherDetails = (voucher: Voucher) =>
    (voucher.items ?? []).filter((item) =>
      [item.customerName, item.customerPhone, item.code].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase()
          .includes(normalizedHolderSearch),
      ),
    );

  const visibleVouchers = data.filter(
    (voucher) =>
      (!normalizedHolderSearch || matchingVoucherDetails(voucher).length > 0) &&
      (!discountTypeFilter ||
        (voucher.discountType ??
          (voucher.discountValue > 100 ? "FIXED_AMOUNT" : undefined)) ===
          discountTypeFilter) &&
      matchesMinOrderRange(voucher, minOrderRangeFilter),
  );

  const hasVoucherFilters =
    !!normalizedHolderSearch || !!discountTypeFilter || !!minOrderRangeFilter;

  const normalizedVoucherTemplateNameSearch = voucherTemplateNameSearch
    .trim()
    .toLocaleLowerCase();
  const visibleVoucherTemplates = voucherTemplates.filter(
    (template) =>
      (!normalizedVoucherTemplateNameSearch ||
        (template.name ?? "")
          .toLocaleLowerCase()
          .includes(normalizedVoucherTemplateNameSearch)) &&
      (!templateCustomerTypeFilter ||
        template.customerType === templateCustomerTypeFilter) &&
      (!templateOrderTypeFilter ||
        template.orderType === templateOrderTypeFilter),
  );

  // E. HANDLERS & FORM ACTIONS
  const openVoucher = (v: Partial<Voucher>) => {
    form.resetFields();
    form.setFieldsValue(
      v.id !== undefined
        ? {
            name: v.name,
            discountType: v.discountType ?? "PERCENTAGE",
            discountValue: v.discountValue,
            minOrderValue: v.minOrderValue ?? 0,
            quantity: v.quantity ?? 0,
            maxQuantity: v.maxQuantity ?? 1,
            validDays: v.validDays ?? 30,
          }
        : {
            name: "",
            discountType: "PERCENTAGE",
            discountValue: undefined,
            minOrderValue: 0,
            quantity: 0,
            maxQuantity: 1,
            validDays: 30,
          },
    );
    setEdit(v);
  };

  const openVoucherTemplate = (template?: VoucherTemplates) => {
    templateForm.resetFields();
    templateForm.setFieldsValue(
      template
        ? {
            name: template.name,
            voucherId: template.voucherId,
            customerType: template.customerType,
            customerGroupId: template.customerGroupId,
            orderType: template.orderType,
            completedOrderCount: template.completedOrderCount,
            minOrderAmount: template.minOrderAmount,
            requiredPoints: template.requiredPoints,
            maxQuantity: template.maxQuantity,
            dates: [dayjs(template.startDate), dayjs(template.endDate)],
          }
        : {
            name: "",
            voucherId: data.find((voucher) => voucher.id !== undefined)?.id,
            customerType: "ALL",
            customerGroupId: null,
            orderType: "ALL",
            completedOrderCount: null,
            minOrderAmount: null,
            requiredPoints: 0,
            maxQuantity: 1,
            dates: [dayjs(), dayjs().add(30, "day")],
          },
    );
    setTemplateEdit(template ?? {});
  };

  const discountOptions = (["PERCENTAGE", "FIXED_AMOUNT"] as VoucherType[]).map(
    (value) => ({
      value,
      label: (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: "50%",
              backgroundColor: DISCOUNT_TYPE[value].color,
            }}
          />
          {DISCOUNT_TYPE[value].label}
        </span>
      ),
    }),
  );

  const completedOrderCountField = (
    <Form.Item
      name="completedOrderCount"
      label="Số đơn hoàn tất tối thiểu"
      rules={[{ required: true, message: "Nhập số đơn tối thiểu" }]}
    >
      <InputNumber min={0} style={{ width: "100%" }} />
    </Form.Item>
  );
  const minOrderAmountField = (
    <Form.Item
      name="minOrderAmount"
      label={
        templateOrderType === "AMOUNT"
          ? "Tổng giá trị mua tối thiểu"
          : "Giá trị đơn tối thiểu trên 1 đơn"
      }
      rules={[
        {
          required: true,
          message:
            templateOrderType === "AMOUNT"
              ? "Nhập tổng giá trị mua tối thiểu"
              : "Nhập giá trị đơn tối thiểu",
        },
      ]}
    >
      <MoneyInput min={0} />
    </Form.Item>
  );
  const maxQuantityField = (
    <Form.Item
      name="maxQuantity"
      label="Số lượng đổi tối đa"
      rules={[{ required: true, message: "Nhập số lượng tối đa" }]}
    >
      <InputNumber min={1} style={{ width: "100%" }} />
    </Form.Item>
  );

  // F. RENDER COMPONENT
  return (
    <>
      <PageHeader
        title="Voucher"
        subtitle="Phát hành, gán cho khách hàng và theo dõi tình trạng sử dụng"
      />
      <Tabs
        activeKey={isVoucherTemplatesPage ? "templates" : "vouchers"}
        onChange={(key) =>
          navigate(
            key === "templates"
              ? "/admin/vouchers/voucher-templates"
              : "/admin/vouchers",
          )
        }
        items={[
          {
            key: "vouchers",
            label: "Voucher",
            children: (
              <ServiceGate
                module="Khuyến mãi"
                loading={isLoading}
                error={error}
              >
                {/* Bộ lọc tìm kiếm */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <Space wrap style={{ flex: "1 1 auto" }}>
                    <Input
                      allowClear
                      aria-label="Tìm người dùng voucher"
                      prefix={<SearchOutlined />}
                      placeholder="Tìm người dùng theo tên, số điện thoại hoặc mã voucher"
                      value={voucherHolderSearch}
                      onChange={(event) =>
                        setVoucherHolderSearch(event.target.value)
                      }
                      style={{ width: 300 }}
                    />
                    <Select<VoucherType>
                      allowClear
                      aria-label="Lọc theo hình thức giảm"
                      placeholder="Hình thức giảm"
                      value={discountTypeFilter}
                      onChange={setDiscountTypeFilter}
                      options={DISCOUNT_FILTER_OPTIONS}
                      style={{ width: 190 }}
                    />
                    <Select<MinOrderRange>
                      allowClear
                      aria-label="Lọc theo đơn tối thiểu"
                      placeholder="Đơn tối thiểu"
                      value={minOrderRangeFilter}
                      onChange={setMinOrderRangeFilter}
                      options={MIN_ORDER_FILTER_OPTIONS}
                      style={{ width: 190 }}
                    />
                  </Space>
                  {!isVoucherTemplatesPage && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openVoucher({})}
                      style={{ marginLeft: "auto" }}
                    >
                      Phát hành Voucher
                    </Button>
                  )}
                </div>

                {/* Bảng danh sách Voucher chính */}
                <Table
                  className="promotion-table"
                  rowKey="id"
                  dataSource={visibleVouchers}
                  locale={{
                    emptyText: hasVoucherFilters
                      ? "Không tìm thấy voucher phù hợp"
                      : "Chưa có chương trình Voucher",
                  }}
                  expandable={{
                    expandedRowKeys: normalizedHolderSearch
                      ? visibleVouchers.flatMap((voucher) =>
                          voucher.id === undefined ? [] : [voucher.id],
                        )
                      : expandedVoucherKeys,
                    onExpandedRowsChange: (keys) =>
                      setExpandedVoucherKeys([...keys]),
                    expandedRowRender: (v) => (
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={
                          normalizedHolderSearch
                            ? matchingVoucherDetails(v)
                            : v.items
                        }
                        columns={[
                          {
                            title: "Mã Voucher",
                            dataIndex: "code",
                          },
                          {
                            title: "Mã hóa đơn",
                            render: (_, v) => {
                              return v.orderId ? v.orderCode : "_";
                            },
                          },
                          {
                            title: "Khách hàng",
                            dataIndex: "customerName",
                            render: (d, v) => (
                              <>
                                <b>{d}</b>
                                <div className="a-muted small">
                                  SĐT: {v.customerPhone}
                                </div>
                              </>
                            ),
                          },
                          {
                            title: "Đền bù",
                            render: (_, v) => {
                              if (v.incidentId != null) {
                                return (
                                  <>
                                    {v.incidentSeverity && (
                                      <Tag
                                        color={
                                          INCIDENT_SEVERITY[v.incidentSeverity]
                                            .color
                                        }
                                      >
                                        {
                                          INCIDENT_SEVERITY[v.incidentSeverity]
                                            .text
                                        }
                                      </Tag>
                                    )}
                                    <div className="a-muted small">
                                      {v.incidentType
                                        ? INCIDENT_TYPE[v.incidentType]
                                        : "_"}
                                    </div>
                                  </>
                                );
                              }
                              return "_";
                            },
                          },
                          {
                            title: "Thời gian",
                            render: (_, p) =>
                              `${date(p.issuedAt)} -> ${date(p.expiresAt)}`,
                          },
                          {
                            title: "Trạng thái",
                            render: (_, v) => {
                              const status = VOUCHER_STATUS[v.status];
                              return status ? (
                                <Tag color={status.color}>{status.label}</Tag>
                              ) : (
                                <Tag>{v.status || "_"}</Tag>
                              );
                            },
                          },
                          {
                            title: "Thao tác",
                            render: (_, voucherDetail: VoucherDetail) => {
                              return (
                                <Space>
                                  {voucherDetail.status === "ISSUED" && (
                                    <Popconfirm
                                      title="Thu hồi voucher này?"
                                      description="Khách hàng sẽ không thể sử dụng voucher sau khi thu hồi."
                                      okText="Thu hồi"
                                      cancelText="Hủy"
                                      okButtonProps={{ danger: true }}
                                      onConfirm={() =>
                                        revokeVoucher.mutate(voucherDetail.id)
                                      }
                                    >
                                      <Button
                                        danger
                                        loading={
                                          revokeVoucher.isPending &&
                                          revokeVoucher.variables ===
                                            voucherDetail.id
                                        }
                                      >
                                        Thu hồi
                                      </Button>
                                    </Popconfirm>
                                  )}
                                </Space>
                              );
                            },
                          },
                        ]}
                      />
                    ),
                  }}
                  columns={[
                    {
                      title: "Tên voucher",
                      dataIndex: "name",
                      render: (v: string) => <b>{v}</b>,
                    },
                    {
                      title: "Hình thức giảm",
                      render: (_, v) => {
                        const discountType =
                          v.discountType ??
                          (v.discountValue > 100 ? "FIXED_AMOUNT" : undefined);
                        const type = discountType
                          ? DISCOUNT_TYPE[discountType]
                          : undefined;
                        const value =
                          v.discountType === "PERCENTAGE"
                            ? `${v.discountValue}%`
                            : money(v.discountValue);

                        return (
                          <Tag color={type?.color ?? "default"}>
                            {type ? `${type.label}: ${value}` : value}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: "Đơn tối thiểu",
                      dataIndex: "minOrderValue",
                      render: money,
                    },
                    {
                      title: "Số lượt / Tối đa",
                      render: (_, v) =>
                        `${v.quantity ?? 0} / ${v.maxQuantity ?? 0}`,
                    },
                    { title: "Hạn dùng (ngày)", dataIndex: "validDays" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      render: (_, v) => {
                        const value = VOUCHER_TYPE_STATUS[v.status];
                        return <Tag color={value.color}>{value.label}</Tag>;
                      },
                    },
                    {
                      title: "Thao tác",
                      render: (_, v) => {
                        return (
                          <Space>
                            {v.status === "ACTIVE" && v.id !== undefined && (
                              <Button
                                onClick={() => {
                                  customerForm.resetFields();
                                  setCustomerSearch("");
                                  setCustomerTargetType("INDIVIDUAL");
                                  setCustomerGroupId(undefined);
                                  customerForm.setFieldsValue({
                                    targetType: "INDIVIDUAL",
                                  });
                                  setVoucherForCustomer(v.id!);
                                }}
                              >
                                Thêm khách hàng
                              </Button>
                            )}
                            {v.status === "DRAFT" && (
                              <Button onClick={() => openVoucher(v)}>
                                Sửa
                              </Button>
                            )}
                            <Dropdown
                              menu={{
                                items: [
                                  ...(v.status === "DRAFT"
                                    ? [
                                        {
                                          key: "activeVoucher",
                                          label: "Kích hoạt",
                                        },
                                      ]
                                    : []),
                                  ...(v.status === "ACTIVE"
                                    ? [
                                        {
                                          key: "endVoucher",
                                          label: "Kết thúc",
                                          danger: true,
                                        },
                                      ]
                                    : []),
                                  ...(v.status === "ENDED"
                                    ? [
                                        {
                                          key: "cloneVoucher",
                                          label: "Nhân bản",
                                        },
                                      ]
                                    : []),
                                  ...(v.status === "DRAFT"
                                    ? [
                                        {
                                          key: "removeVoucher",
                                          label: "Xóa bản nháp",
                                          danger: true,
                                        },
                                      ]
                                    : []),
                                ],
                                onClick: ({ key }) => {
                                  if (
                                    v.id === undefined ||
                                    (key !== "activeVoucher" &&
                                      key !== "endVoucher" &&
                                      key !== "cloneVoucher" &&
                                      key !== "removeVoucher")
                                  ) {
                                    return;
                                  }
                                  act.mutate({ id: v.id, op: key });
                                },
                              }}
                            >
                              <Button
                                className="small"
                                icon={<MoreOutlined />}
                              />
                            </Dropdown>
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              </ServiceGate>
            ),
          },
          {
            key: "templates",
            label: "Nhiệm vụ Voucher",
            children: (
              <ServiceGate
                module="Khuyến mãi"
                loading={isLoadingVoucherTemplates}
                error={voucherTemplatesError}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <Space wrap>
                    <Input
                      allowClear
                      aria-label="Tìm nhiệm vụ Voucher theo tên"
                      prefix={<SearchOutlined />}
                      placeholder="Tìm theo tên nhiệm vụ"
                      value={voucherTemplateNameSearch}
                      onChange={(event) =>
                        setVoucherTemplateNameSearch(event.target.value)
                      }
                      style={{ width: 240 }}
                    />
                    <Select<VoucherTemplateCustomerType>
                      allowClear
                      aria-label="Lọc nhiệm vụ theo đối tượng nhận"
                      placeholder="Đối tượng nhận"
                      value={templateCustomerTypeFilter}
                      onChange={setTemplateCustomerTypeFilter}
                      options={(
                        Object.keys(
                          VOUCHER_TEMPLATE_CUSTOMER_TYPE_FILTER,
                        ) as VoucherTemplateCustomerType[]
                      ).map((value) => ({
                        value,
                        label:
                          VOUCHER_TEMPLATE_CUSTOMER_TYPE_FILTER[value].label,
                      }))}
                      style={{ width: 190 }}
                    />
                    <Select<VoucherTemplateOrderType>
                      allowClear
                      aria-label="Lọc nhiệm vụ theo điều kiện đơn hàng"
                      placeholder="Điều kiện đơn hàng"
                      value={templateOrderTypeFilter}
                      onChange={setTemplateOrderTypeFilter}
                      options={VOUCHER_TEMPLATE_ORDER_TYPE_FILTER_OPTIONS}
                      style={{ width: 210 }}
                    />
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => openVoucherTemplate()}
                  >
                    Tạo nhiệm vụ Voucher
                  </Button>
                </div>
                <Table<VoucherTemplates>
                  className="promotion-table"
                  rowKey="id"
                  dataSource={visibleVoucherTemplates}
                  locale={{ emptyText: "Chưa có nhiệm vụ voucher" }}
                  scroll={{ x: 900 }}
                  columns={[
                    {
                      title: "Tên nhiệm vụ",
                      dataIndex: "name",
                      render: (name: string) => <b>{name || "—"}</b>,
                    },
                    {
                      title: "Voucher áp dụng",
                      render: (_: unknown, template: VoucherTemplates) => (
                        <>
                          {template.voucherName ||
                            `Voucher #${template.voucherId}`}
                          <div className="a-muted small">ID: {template.id}</div>
                        </>
                      ),
                    },
                    {
                      title: "Đối tượng nhận",
                      render: (_: unknown, template: VoucherTemplates) =>
                        template.customerType === "CUSTOMER_GROUP"
                          ? template.customerGroupName || "Nhóm khách hàng"
                          : "Tất cả khách hàng",
                    },
                    {
                      title: "Điều kiện đơn hàng",
                      render: (_: unknown, template: VoucherTemplates) => {
                        const conditions: string[] = [];
                        if (
                          template.orderType === "COUNT" ||
                          template.orderType === "COUNT_AMOUNT"
                        ) {
                          conditions.push(
                            `${template.completedOrderCount ?? 0} đơn hoàn tất`,
                          );
                        }
                        if (
                          template.orderType === "AMOUNT" ||
                          template.orderType === "COUNT_AMOUNT"
                        ) {
                          conditions.push(
                            `Giá trị đơn từ ${money(template.minOrderAmount)}`,
                          );
                        }
                        return conditions.length
                          ? conditions.join(" · ")
                          : "Không yêu cầu";
                      },
                    },
                    { title: "Điểm yêu cầu", dataIndex: "requiredPoints" },
                    { title: "Số lượng tối đa", dataIndex: "maxQuantity" },
                    {
                      title: "Thời hạn",
                      render: (_: unknown, template: VoucherTemplates) =>
                        `${date(template.startDate)} – ${date(template.endDate)}`,
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      render: (status: string) => {
                        const value = VOUCHER_TEMPLATE_STATUS[status];
                        return value ? (
                          <Tag color={value.color}>{value.label}</Tag>
                        ) : (
                          <Tag>{status || "_"}</Tag>
                        );
                      },
                    },
                    {
                      title: "Thao tác",
                      render: (_: unknown, template: VoucherTemplates) => {
                        const actions = [
                          ...(template.status === "DRAFT"
                            ? [
                                {
                                  key: "activeVoucherTemplate",
                                  label: "Kích hoạt",
                                },
                                {
                                  key: "removeVoucherTemplate",
                                  label: "Xóa bản nháp",
                                  danger: true,
                                },
                              ]
                            : []),
                          ...(template.status === "ACTIVE"
                            ? [
                                {
                                  key: "endVoucherTemplate",
                                  label: "Kết thúc",
                                  danger: true,
                                },
                              ]
                            : []),
                          ...(template.status === "ENDED"
                            ? [
                                {
                                  key: "cloneVoucherTemplate",
                                  label: "Nhân bản",
                                },
                              ]
                            : []),
                        ];

                        return (
                          <Space>
                            {template.status === "DRAFT" && (
                              <Button
                                className="small"
                                onClick={() => openVoucherTemplate(template)}
                              >
                                Sửa
                              </Button>
                            )}
                            <Dropdown
                              menu={{
                                items: actions,
                                onClick: ({ key }) => {
                                  if (template.id === undefined) return;
                                  if (
                                    key === "activeVoucherTemplate" ||
                                    key === "endVoucherTemplate" ||
                                    key === "cloneVoucherTemplate" ||
                                    key === "removeVoucherTemplate"
                                  ) {
                                    voucherTemplateAct.mutate({
                                      id: template.id,
                                      op: key,
                                    });
                                  }
                                },
                              }}
                            >
                              <Button
                                className="small"
                                icon={<MoreOutlined />}
                                loading={
                                  voucherTemplateAct.isPending &&
                                  voucherTemplateAct.variables?.id ===
                                    template.id
                                }
                              />
                            </Dropdown>
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              </ServiceGate>
            ),
          },
        ]}
      />

      {/* Modal Tạo / Sửa Voucher */}
      <Modal
        open={edit !== null}
        title={edit?.id ? "Sửa Voucher" : "Tạo Voucher"}
        footer={null}
        onCancel={() => {
          setEdit(null);
          form.resetFields();
        }}
        destroyOnHidden
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={({ validDays, ...v }) =>
            saveVoucher.mutate(
              { ...v, validDate: validDays ?? 30, id: edit?.id },
              { onSuccess: () => setEdit(null) },
            )
          }
        >
          <Form.Item
            name="name"
            label="Tên voucher"
            rules={[{ required: true, message: "Nhập tên voucher" }]}
          >
            <Input maxLength={150} />
          </Form.Item>
          <Form.Item name="discountType" label="Hình thức giảm">
            <Segmented block options={discountOptions} />
          </Form.Item>
          <div className="a-grid-2">
            <Form.Item
              name="discountValue"
              label={
                discountType === "PERCENTAGE"
                  ? "Phần trăm giảm"
                  : "Số tiền giảm"
              }
              rules={[{ required: true, message: "Nhập giá trị giảm" }]}
            >
              {discountType === "PERCENTAGE" ? (
                <InputNumber
                  min={1}
                  max={100}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
              ) : (
                <MoneyInput min={1} />
              )}
            </Form.Item>
            <Form.Item name="minOrderValue" label="Đơn tối thiểu">
              <MoneyInput />
            </Form.Item>
            <Form.Item
              name="maxQuantity"
              label="Số lượt tối đa"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="validDays"
              label="Hạn dùng (ngày)"
              rules={[
                { required: true, message: "Nhập hạn dùng" },
                { type: "number", min: 1, message: "Hạn dùng phải từ 1 ngày" },
              ]}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saveVoucher.isPending}
          >
            Lưu Voucher
          </Button>
        </Form>
      </Modal>

      <Modal
        open={templateEdit !== null}
        title={
          templateEdit?.id ? "Sửa nhiệm vụ Voucher" : "Tạo nhiệm vụ Voucher"
        }
        footer={null}
        onCancel={() => {
          setTemplateEdit(null);
          templateForm.resetFields();
        }}
        destroyOnHidden
        width={720}
      >
        <Form<VoucherTemplateFormValues>
          form={templateForm}
          layout="vertical"
          onFinish={(values) => {
            const { dates, ...fields } = values;
            const payload: VoucherTemplatePayload & { id?: number } = {
              ...fields,
              name: values.name.trim(),
              customerGroupId:
                values.customerType === "CUSTOMER_GROUP"
                  ? (values.customerGroupId ?? null)
                  : null,
              completedOrderCount:
                values.orderType === "COUNT" ||
                values.orderType === "COUNT_AMOUNT"
                  ? (values.completedOrderCount ?? null)
                  : null,
              minOrderAmount:
                values.orderType === "AMOUNT" ||
                values.orderType === "COUNT_AMOUNT"
                  ? (values.minOrderAmount ?? null)
                  : null,
              startDate: dates[0].startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
              endDate: dates[1].endOf("day").format("YYYY-MM-DDTHH:mm:ss"),
              id: templateEdit?.id,
            };
            saveVoucherTemplate.mutate(payload, {
              onSuccess: () => {
                setTemplateEdit(null);
                templateForm.resetFields();
              },
            });
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0 12px",
            }}
          >
            <Form.Item
              name="name"
              label="Tên nhiệm vụ Voucher"
              rules={[{ required: true, message: "Nhập tên nhiệm vụ Voucher" }]}
            >
              <Input maxLength={150} />
            </Form.Item>
            <Form.Item
              name="voucherId"
              label="Voucher"
              rules={[{ required: true, message: "Chọn voucher" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn voucher"
                options={data.flatMap((voucher) =>
                  voucher.id === undefined || voucher.status !== "ACTIVE"
                    ? []
                    : [
                        {
                          value: voucher.id,
                          label: `${voucher.name}`,
                        },
                      ],
                )}
              />
            </Form.Item>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0 12px",
            }}
          >
            <Form.Item
              name="customerType"
              label="Đối tượng nhận"
              rules={[{ required: true }]}
            >
              <Segmented
                block
                options={[
                  { value: "ALL", label: "Tất cả khách hàng" },
                  { value: "CUSTOMER_GROUP", label: "Nhóm khách hàng" },
                ]}
              />
            </Form.Item>
            {templateCustomerType === "CUSTOMER_GROUP" && (
              <Form.Item
                name="customerGroupId"
                label="Nhóm khách hàng"
                rules={[{ required: true, message: "Chọn nhóm khách hàng" }]}
                help={
                  customerGroupsError
                    ? "Không thể tải danh sách nhóm khách hàng"
                    : undefined
                }
                validateStatus={customerGroupsError ? "error" : undefined}
              >
                <Select
                  loading={isLoadingCustomerGroups}
                  placeholder="Chọn nhóm khách hàng"
                  options={customerGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  }))}
                />
              </Form.Item>
            )}
          </div>
          <Form.Item
            name="orderType"
            label="Điều kiện đơn hàng"
            rules={[{ required: true }]}
          >
            <Segmented
              block
              options={[
                { value: "ALL", label: "Không yêu cầu" },
                { value: "COUNT", label: "Theo số đơn hoàn tất" },
                { value: "AMOUNT", label: "Theo giá trị đơn" },
                { value: "COUNT_AMOUNT", label: "Theo số đơn và giá trị" },
              ]}
            />
          </Form.Item>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0 12px",
            }}
          >
            {templateOrderType === "COUNT" && (
              <>
                {completedOrderCountField}
                {maxQuantityField}
              </>
            )}
            {templateOrderType === "AMOUNT" && (
              <>
                {minOrderAmountField}
                {maxQuantityField}
              </>
            )}
            {templateOrderType === "COUNT_AMOUNT" && (
              <>
                {completedOrderCountField}
                {minOrderAmountField}
              </>
            )}
            {templateOrderType === "ALL" && maxQuantityField}
          </div>
          {templateOrderType === "COUNT_AMOUNT" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0 12px",
              }}
            >
              {maxQuantityField}
            </div>
          )}
          <div className="a-grid-2">
            <Form.Item
              name="requiredPoints"
              label="Điểm yêu cầu"
              rules={[{ required: true, message: "Nhập điểm yêu cầu" }]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="dates"
              label="Thời gian áp dụng"
              rules={[{ required: true, message: "Chọn thời gian áp dụng" }]}
            >
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </div>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saveVoucherTemplate.isPending}
          >
            Lưu nhiệm vụ Voucher
          </Button>
        </Form>
      </Modal>

      {/* Modal Thêm Khách Hàng vào Voucher */}
      <Modal
        open={voucherForCustomer !== null}
        title="Thêm khách hàng vào voucher"
        footer={null}
        onCancel={() => {
          setVoucherForCustomer(null);
          setCustomerTargetType("INDIVIDUAL");
          setCustomerGroupId(undefined);
          customerForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form
          form={customerForm}
          layout="vertical"
          initialValues={{ targetType: "INDIVIDUAL" }}
          onFinish={(
            values: VoucherDetailRequest & {
              targetType: "INDIVIDUAL" | "GROUP";
              groupId?: number;
            },
          ) => {
            if (voucherForCustomer === null) return;

            if (values.targetType === "GROUP") {
              if (
                remainingVoucherQuantity === 0 ||
                eligibleCustomerIds.length === 0
              ) {
                return;
              }
              saveCustomers.mutate(
                { id: voucherForCustomer, customerIds: eligibleCustomerIds },
                {
                  onSuccess: () => {
                    setVoucherForCustomer(null);
                    setCustomerTargetType("INDIVIDUAL");
                    setCustomerGroupId(undefined);
                    customerForm.resetFields();
                  },
                  onError: () => {
                    void queryClient.invalidateQueries({
                      queryKey: ["vouchers"],
                    });
                  },
                },
              );
              return;
            }

            if (
              remainingVoucherQuantity === 0 ||
              values.customerId === undefined ||
              existingCustomerIds.has(values.customerId)
            ) {
              return;
            }

            saveCustomer.mutate(
              { id: voucherForCustomer, customerId: values.customerId },
              {
                onSuccess: () => {
                  setVoucherForCustomer(null);
                  setCustomerTargetType("INDIVIDUAL");
                  setCustomerGroupId(undefined);
                  customerForm.resetFields();
                },
              },
            );
          }}
        >
          <Form.Item name="targetType" label="Phương thức thêm">
            <Segmented
              block
              options={[
                { value: "INDIVIDUAL", label: "Theo khách hàng" },
                { value: "GROUP", label: "Theo nhóm khách hàng" },
              ]}
              onChange={(value) => {
                const targetType = value as "INDIVIDUAL" | "GROUP";
                setCustomerTargetType(targetType);
                customerForm.setFieldValue("customerId", undefined);
                customerForm.setFieldValue("groupId", undefined);
                setCustomerGroupId(undefined);
              }}
            />
          </Form.Item>

          {customerTargetType === "INDIVIDUAL" ? (
            <Form.Item
              name="customerId"
              label="Thông tin khách hàng"
              rules={[{ required: true, message: "Vui lòng chọn khách hàng" }]}
              help={
                remainingVoucherQuantity === 0
                  ? "Voucher đã phát hành hết số lượt cho phép"
                  : customerError
                    ? "Không thể tải danh sách khách hàng. Vui lòng thử lại."
                    : undefined
              }
              validateStatus={
                customerError || remainingVoucherQuantity === 0
                  ? "error"
                  : undefined
              }
            >
              <Select
                showSearch
                filterOption={false}
                onSearch={setCustomerSearch}
                loading={isLoadingCustomers}
                placeholder="Tìm theo tên hoặc số điện thoại"
                notFoundContent={
                  customerError
                    ? "Không thể tải khách hàng"
                    : isLoadingCustomers
                      ? "Đang tải..."
                      : "Không tìm thấy khách hàng"
                }
                options={filteredCustomers
                  .filter((customer) => !existingCustomerIds.has(customer.id))
                  .map((customer) => ({
                    value: customer.id,
                    label: `${customer.fullName || "Chưa có tên"} · ${customer.phone}`,
                  }))}
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="groupId"
                label="Nhóm khách hàng"
                rules={[
                  { required: true, message: "Vui lòng chọn nhóm khách hàng" },
                ]}
                help={
                  customerGroupsError
                    ? "Không thể tải danh sách nhóm khách hàng."
                    : undefined
                }
                validateStatus={customerGroupsError ? "error" : undefined}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  loading={isLoadingCustomerGroups}
                  placeholder="Chọn nhóm khách hàng"
                  onChange={(groupId: number) => setCustomerGroupId(groupId)}
                  options={customerGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  }))}
                />
              </Form.Item>
              {customerGroupId !== undefined && (
                <div className="a-muted small" style={{ marginBottom: 12 }}>
                  {customerGroupMembersError
                    ? "Không thể tải danh sách thành viên."
                    : isLoadingCustomerGroupMembers
                      ? "Đang tải danh sách thành viên..."
                      : eligibleCustomerIds.length > 0
                        ? `Sẽ thêm ${eligibleCustomerIds.length} khách hàng chưa có voucher trong nhóm`
                        : remainingVoucherQuantity === 0
                          ? "Voucher đã phát hành hết số lượt cho phép"
                          : "Tất cả khách trong nhóm đã có voucher hoặc nhóm không có thành viên"}
                </div>
              )}
            </>
          )}

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={
              customerTargetType === "GROUP"
                ? saveCustomers.isPending
                : saveCustomer.isPending
            }
            disabled={
              remainingVoucherQuantity === 0 ||
              (customerTargetType === "GROUP" &&
                (customerGroupId === undefined ||
                  isLoadingCustomerGroupMembers ||
                  !!customerGroupMembersError ||
                  eligibleCustomerIds.length === 0))
            }
          >
            {customerTargetType === "GROUP"
              ? "Thêm toàn bộ nhóm"
              : "Thêm khách hàng"}
          </Button>
        </Form>
      </Modal>
    </>
  );
}
