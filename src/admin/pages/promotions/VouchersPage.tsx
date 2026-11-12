import { useQuery } from "@tanstack/react-query";
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
  Voucher,
} from "@/api/promotions";

import { date, INCIDENT_SEVERITY, INCIDENT_TYPE, money } from "@/lib/format";
import { PageHeader } from "../../components/PageHeader";
import { ServiceGate } from "../../components/ServiceGate";
import { useState } from "react";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useAction } from "@/admin/components/useCrud";
import { MoneyInput } from "@/admin/components/MoneyInput";
import { crmApi } from "@/api/crm";

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

export function VouchersPage() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["vouchers"],
    queryFn: promotionsApi.vouchers,
    retry: false,
  });

  const act = useAction(
    (v: {
      id: number;
      op:
        | "activeVoucher"
        | "endVoucher"
        | "cloneVoucher"
        | "removeVoucher";
    }) => promotionsApi[v.op](v.id),
    [["vouchers"], ["menu"]],
    "Đã cập nhật",
  );

  const [edit, setEdit] = useState<Partial<Voucher> | null>(null);
  const [voucherForCustomer, setVoucherForCustomer] = useState<number | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();
  const key = [["vouchers"], ["menu"]];
  const revokeVoucher = useAction(
    promotionsApi.revokeVoucher,
    key,
    "Đã thu hồi voucher",
  );
  const saveVoucher = useAction(promotionsApi.saveVoucher, key);
  const saveCustomer = useAction(
    promotionsApi.saveCustomer,
    key,
    "Đã thêm khách hàng vào voucher",
  );
  const {
    data: customers = [],
    isFetching: isLoadingCustomers,
    error: customerError,
  } = useQuery({
    queryKey: ["crm-customers", "voucher", customerSearch],
    queryFn: () => crmApi.customers(customerSearch || undefined),
    enabled: voucherForCustomer !== null,
    retry: false,
  });
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
  const discountType = Form.useWatch("discountType", form);

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
        <Table
          className="promotion-table"
          rowKey="id"
          dataSource={data}
          locale={{ emptyText: "Chưa có chương trình Voucher" }}
          expandable={{
            expandedRowRender: (v) => (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={v.items}
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
                    {v.status !== "ENDED" && v.id !== undefined && (
                      <Button
                        onClick={() => {
                          customerForm.resetFields();
                          setCustomerSearch("");
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
        open={voucherForCustomer !== null}
        title="Thêm khách hàng vào voucher"
        footer={null}
        onCancel={() => {
          setVoucherForCustomer(null);
          customerForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form
          form={customerForm}
          layout="vertical"
          onFinish={(values: { customerId: number }) => {
            if (voucherForCustomer === null) return;
            saveCustomer.mutate(
              { id: voucherForCustomer, customerId: values.customerId },
              {
                onSuccess: () => {
                  setVoucherForCustomer(null);
                  customerForm.resetFields();
                },
              },
            );
          }}
        >
          <Form.Item
            name="customerId"
            label="Thông tin khách hàng"
            rules={[{ required: true, message: "Vui lòng chọn khách hàng" }]}
            help={
              customerError
                ? "Không thể tải danh sách khách hàng. Vui lòng thử lại."
                : undefined
            }
            validateStatus={customerError ? "error" : undefined}
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
              options={customers.map((customer) => ({
                value: customer.id,
                label: `${customer.fullName || "Chưa có tên"} · ${customer.phone}`,
              }))}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={saveCustomer.isPending}
          >
            Thêm khách hàng
          </Button>
        </Form>
      </Modal>
    </>
  );
}
