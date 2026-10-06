# Coffeeholic — Frontend

React 18 + TypeScript + Vite · Ant Design · React Query · Zustand · STOMP/SockJS.

Một ứng dụng, hai giao diện:

- **Trang gọi món cho khách** (`/`, không đăng nhập): thực đơn theo danh mục, giá khuyến mãi, ghi chú món,
  giỏ hàng lưu phía server, đặt hàng (tại bàn / mang về / giao hàng), voucher, theo dõi & hủy đơn, góp ý.
  Quét QR trên bàn mở `/t/{qrCode}` → giỏ hàng gắn với bàn đó. Khách có thể (không bắt buộc) đăng ký / đăng nhập
  bằng SĐT để xem đơn, điểm, voucher ở `/account`.
- **Hệ thống quản trị** (`/admin`, nút "Quản trị" ở header) cho Quản lý / Nhân viên: menu và từng màn hiện theo quyền
  (user – role – permission, `src/lib/perm.ts`), màn Phân quyền chỉnh quyền của 3 role; điều phối đơn dạng bảng cột
  (realtime), order tại quầy, giao hàng, sự cố, cà phê & công thức, nguyên liệu & lô, nhập/xuất/kiểm kê kho,
  bàn & in mã QR, nhân viên, tài khoản; cùng các màn CRM, khuyến mãi, thống kê.

## Backend mỗi màn hình gọi tới

| Thư mục | Backend | Trạng thái |
|---|---|---|
| `src/api/public.ts`, `src/api/core.ts` | app-core | Đã có |
| `src/api/crm.ts` | app-crm (`/api/crm/*`) | Chưa có backend — file này là hợp đồng API giao diện cần |
| `src/api/promotions.ts` | app-promotions (`/api/promotions/*`) | Chưa có backend — như trên |
| `src/api/stats.ts` | app-stats (`/api/stats/*`) | Chưa có backend — như trên |

Khi backend của module chưa chạy, trang tương ứng hiện thông báo "Dịch vụ … chưa sẵn sàng" (`ServiceGate`).

## Cấu trúc

```
src/
  api/        axios client + 1 file / backend (types.ts = DTO của app-core)
  guest/      trang khách: layout, thực đơn, giỏ, checkout, theo dõi đơn, góp ý
  admin/      layout, đăng nhập, realtime, components dùng chung, pages/ (crm/, promotions/)
  lib/        format tiền/ngày, nhãn tiếng Việt cho các trạng thái
  store/      authStore (JWT), guestStore (giỏ, bàn, đơn đã đặt)
```

## Chạy

```bash
cp .env.example .env.local   # VITE_API_URL=<gateway>/api, VITE_WS_URL=<app-core>/ws
npm install
npm run dev
```

`npm run build` để kiểm tra kiểu + build production. Các trang admin được lazy-load nên khách không phải
tải thư viện biểu đồ.
