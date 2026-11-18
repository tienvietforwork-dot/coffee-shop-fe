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
} from "antd";
import {
  promotionsApi,
  type VoucherType,
  type VoucherStatus,
  type VoucherDetail,
  type VoucherDetailRequest,
  Voucher,
} from "@/api/promotions";

import { date, INCIDENT_SEVERITY, INCIDENT_TYPE, money } from "@/lib/format";
import { PageHeader } from "../../components/PageHeader";
import { ServiceGate } from "../../components/ServiceGate";
import { useState } from "react";
import type { Key } from "react";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useAction } from "@/admin/components/useCrud";
import { MoneyInput } from "@/admin/components/MoneyInput";
import { crmApi } from "@/api/crm";

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

type MinOrderRange =
  | "none"
  | "1-50"
  | "50-100"
  | "100-200"
  | "200-500"
  | "500-1000"
  | "over-1000";

type CustomerTargetType = "INDIVIDUAL" | "GROUP";

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

  // A. UI STATE
  const [edit, setEdit] = useState<Partial<Voucher> | null>(null);
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
  const [expandedVoucherKeys, setExpandedVoucherKeys] = useState<Key[]>([]);

  // Forms
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const discountType = Form.useWatch("discountType", form);

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
    data: customerGroups = [],
    isLoading: isLoadingCustomerGroups,
    error: customerGroupsError,
  } = useQuery({
    queryKey: ["crm-groups"],
    queryFn: crmApi.groups,
    enabled: voucherForCustomer !== null,
    retry: false,
  });

  const {
    data: customerGroupMembers = [],
    isFetching: isLoadingCustomerGroupMembers,
    error: customerGroupMembersError,
  } = useQuery({
    queryKey: ["crm-members", customerGroupId],
    queryFn: () => crmApi.groupMembers(customerGroupId!),
    enabled: customerTargetType === "GROUP" && customerGroupId !== undefined,
    retry: false,
  });

  const {
    data: customerPage,
    isFetching: isLoadingCustomers,
    error: customerError,
  } = useQuery({
    queryKey: ["crm-customers", "voucher", customerSearch],
    queryFn: () =>
      crmApi.customers({ q: customerSearch || undefined, size: 20 }),
    enabled: voucherForCustomer !== null,
    retry: false,
  });
  const customers = customerPage?.content ?? [];
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
  const eligibleCustomerIds =
    voucherForCustomer === null
      ? []
      : (() => {
          return customerGroupMembers
            .filter((member) => !member.isExcluded)
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

  // E. HANDLERS & FORM ACTIONS
  const openVoucher = (v: Partial<Voucher>) => {
    form.resetFields();
    form.setFieldsValue({
      name: v.name,
      discountType: v.discountType ?? "PERCENTAGE",
      discountValue: v.discountValue,
      minOrderValue: v.minOrderValue ?? 0,
      quantity: v.quantity ?? 0,
      maxQuantity: v.maxQuantity ?? 1,
      validDays: v.validDays ?? 30,
    });
    setEdit(v);
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

  // F. RENDER COMPONENT
  return (
    <>
      <PageHeader
        title="Voucher"
        subtitle="Phát hành, gán cho khách hàng và theo dõi tình trạng sử dụng"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openVoucher({})}
          >
            Phát hành Voucher
          </Button>
        }
      />
      <ServiceGate module="Khuyến mãi" loading={isLoading} error={error}>
        {/* Bộ lọc tìm kiếm */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            aria-label="Tìm người dùng voucher"
            placeholder="Tìm người dùng theo tên, số điện thoại hoặc mã voucher"
            value={voucherHolderSearch}
            onChange={(event) => setVoucherHolderSearch(event.target.value)}
            style={{ width: 440 }}
          />
          <Select<VoucherType>
            allowClear
            aria-label="Lọc theo hình thức giảm"
            placeholder="Hình thức giảm"
            value={discountTypeFilter}
            onChange={setDiscountTypeFilter}
            options={DISCOUNT_FILTER_OPTIONS}
            style={{ width: 220 }}
          />
          <Select<MinOrderRange>
            allowClear
            aria-label="Lọc theo đơn tối thiểu"
            placeholder="Đơn tối thiểu"
            value={minOrderRangeFilter}
            onChange={setMinOrderRangeFilter}
            options={MIN_ORDER_FILTER_OPTIONS}
            style={{ width: 220 }}
          />
        </Space>

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
            onExpandedRowsChange: (keys) => setExpandedVoucherKeys([...keys]),
            expandedRowRender: (v) => (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={
                  normalizedHolderSearch ? matchingVoucherDetails(v) : v.items
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
                                  INCIDENT_SEVERITY[v.incidentSeverity].color
                                }
                              >
                                {INCIDENT_SEVERITY[v.incidentSeverity].text}
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
                                  revokeVoucher.variables === voucherDetail.id
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
              render: (_, v) => `${v.quantity ?? 0} / ${v.maxQuantity ?? 0}`,
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
                      <Button onClick={() => openVoucher(v)}>Sửa</Button>
                    )}
                    <Dropdown
                      menu={{
                        items: [
                          ...(v.status === "DRAFT"
                            ? [{ key: "activeVoucher", label: "Kích hoạt" }]
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
                            ? [{ key: "cloneVoucher", label: "Nhân bản" }]
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
                      <Button className="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  </Space>
                );
              },
            },
          ]}
        />
      </ServiceGate>

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
                options={customers
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
