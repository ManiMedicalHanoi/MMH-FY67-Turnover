# Dự trù NPP (nhánh của Turnover)

App cho nhân sự MMH theo dõi **dự trù cố định · đặt hàng dự kiến · đặt hàng thực tế** của từng nhà phân phối và cảnh báo
**dự trù chưa đặt hàng** theo từng mã. Không đụng giao diện Turnover hiện tại (trang riêng `du-tru/`).

- Link: https://manimedicalhanoi.github.io/MMH-FY67-Turnover/du-tru/
- Máy chủ: kho riêng tư `ManiMedicalHanoi/mmh-backend` ▸ `backends/du-tru-npp/WebApp.gs` (web app của file gốc
  "Dự trù NPP Dashboard"); URL đặt ở `window.DT_API` trong `index.html`.
- Đăng nhập: email công ty (phiên `mmh_tk` dùng chung Report Hub / CRM). Quyền: Admin / Giám đốc / Trưởng bộ phận xem + sửa mọi NPP;
  người khác theo sheet **PHÂN QUYỀN APP** của file gốc (Admin sửa ở tab Phân quyền). Nhà phân phối không đăng nhập app — mỗi NPP nhận file Excel riêng.

## Màn hình
| Tab | Nội dung |
|---|---|
| Tổng quan | Chọn NPP + "Tình hình đến hết" tháng M: ① dự trù ② thực tế ③ dự kiến ④ dự trù chưa đặt hàng; biểu đồ theo tháng; mã cần chú ý; nhóm sản phẩm |
| Mã hàng | Thẻ từng mã có ảnh (DIA-BURS theo từng mẫu, nhóm khác ảnh đại diện), lọc theo mức cảnh báo / nhóm, bấm ⇒ chi tiết từng tháng + sửa nhanh |
| Lên dự trù T | 3 bước: cập nhật dự kiến các tháng → xem đề xuất → nhập dự trù T; lưu thẳng vào file gốc |
| Đặt hàng thực tế | Mỗi lần NPP đặt = 1 dòng (sheet 2); tiến độ tháng so với dự kiến |
| Excel cho NPP | Xuất file riêng từng NPP (công thức đề xuất sống trong file) · nhập file NPP gửi lại ⇒ xem trước ⇒ ghi |

## Cách tính (giống SUM / LÊN DỰ TRÙ của file gốc)
- Đặt hàng dùng để tính tháng m: tháng đã qua có đơn thực tế ⇒ thực tế; còn lại ⇒ max(thực tế, dự kiến).
- Dự trù chưa đặt hàng: p = max(0, p + dự trù − đặt hàng), về 0 tháng 09.
- Mức: p ÷ Σ dự trù từ đầu kỳ ⇒ Cao ≥ ngưỡng CAO, Theo dõi ≥ ngưỡng THEO DÕI (sheet CÀI ĐẶT); Chưa dự trù; Không có đơn 6 tháng.
- Đề xuất dự trù T = max(0, dự kiến T − p đến hết T−1).

## v1.1 (09/11/2026)
- Mở nhanh hơn: máy chủ gửi dữ liệu gọn (đã cộng theo NPP + tháng + mã) và đệm 10 phút; từng lần đặt hàng thực tế chỉ tải khi mở tab Đặt hàng thực tế.
  Lần mở sau trên cùng máy hiện ngay bản lưu (IndexedDB) rồi cập nhật ngầm.
- Nút **Hướng dẫn** (tự mở lần đầu): Ai làm gì mỗi tháng (MMH / NPP) · Nhìn vào đâu thấy gì · Cách tính; dòng giải thích ngắn đầu mỗi tab (ẩn được).
  "Dự trù chưa đặt hàng" gọi gọn là **hàng chờ**.

## Phát triển
- `app.js` (lõi + màn hình), `xl.js` (Excel, ExcelJS ở `vendor/`, tải khi cần), `img/` (ảnh dựng bằng `tools/build_img.py` từ kho mmh-library).
- Kiểm thử với máy chủ giả lập (dữ liệu giả): ở thư mục gốc repo `python3 -m http.server 8790` rồi
  `NODE_PATH=$(npm root -g) node du-tru/tools/test.js [thư mục ảnh]` — phải ra "Tất cả kiểm tra đạt".
- Không đưa số dự trù / đặt hàng thật vào repo (repo công khai).
