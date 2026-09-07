# Kết nối Firebase cho Điểm danh V2.3

Thiết lập **một lần bằng tài khoản Google của giảng viên**. Sau đó SV chỉ cần mở `https://tranquanghai-ops.github.io/diem-danh/` để quét, không cần tài khoản Firebase. Website vẫn ở địa chỉ hiện tại; không phải chuyển sang Firebase Hosting.

## 1. Tạo dự án miễn phí

- Mở [Firebase Console](https://console.firebase.google.com/), chọn **Create a project / Tạo dự án**.
- Đặt tên, ví dụ `diem-danh-tdtu`. Có thể bỏ Google Analytics.
- Giữ gói **Spark**, không cần liên kết thanh toán cho chức năng trong ứng dụng này.

## 2. Tạo cơ sở dữ liệu

- Vào **Build → Firestore Database → Create database**.
- Chọn **Standard edition**, database mặc định `(default)`, chế độ **Production**.
- Chọn vị trí gần Việt Nam, chẳng hạn Singapore nếu có trong danh sách.
- Mở tab **Rules**, thay nội dung bằng toàn bộ [firestore.rules](./firestore.rules), rồi nhấn **Publish**.

Quy tắc cho phép người có liên kết tham gia đọc và thêm điểm danh sau khi xác thực ẩn danh. Người quét không sửa hoặc xóa bản ghi đã có. Chỉ tài khoản tạo danh sách được xóa. Liên kết tham gia cấp quyền vào danh sách, nên gửi cho những SV phụ trách quét.

## 3. Bật đăng nhập

- Vào **Build → Authentication → Get started → Sign-in method**.
- Bật **Anonymous** để SV quét mà không phải đăng ký tài khoản.
- Bật **Google**, chọn email hỗ trợ của giảng viên và lưu.
- Trong **Authentication → Settings → Authorized domains**, thêm:

```
tranquanghai-ops.github.io
```

## 4. Cấu hình Web

- Vào **Project settings → General → Your apps**, chọn biểu tượng **Web `</>`**.
- Đặt tên ứng dụng `Diem danh`, chọn **Register app**. Không cần bật Hosting.
- Cấu hình Web của dự án `diem-danh-tknt` đã được lưu sẵn trong ứng dụng V2.3.
- Đây là cấu hình Web công khai của ứng dụng; **không lấy tệp Service Account hoặc private key**.

## 5. Kết nối ứng dụng

- Mở [trang quản lý](https://tranquanghai-ops.github.io/diem-danh/admin/), kiểm tra **V2.3**.
- Nhấn **Đăng nhập Google**, chọn tài khoản giảng viên. Danh sách dùng chung được thiết lập tự động, không có bước tạo đợt và không cần dán lại `firebaseConfig`.
- Khi thấy **Đã đồng bộ danh sách chung**, hệ thống đã kích hoạt trang quét mặc định. Nút **Lấy link cho SV quét** sao chép địa chỉ ngắn, không chứa mã cấu hình.
- Trên điện thoại SV, mở `https://tranquanghai-ops.github.io/diem-danh/` bằng Chrome. Trang tự tìm danh sách chung và ghi nhớ kết nối.
- Khi đổi điện thoại quản lý, mở cùng liên kết và đăng nhập đúng tài khoản Google ban đầu.

## Cách dùng mỗi ngày

- Danh sách mặc định theo **ngày tại Việt Nam (UTC+7)**. Mỗi MSSV được ghi một lần trong ngày; ngày tiếp theo có thể điểm danh lại, không cần tạo đợt.
- Trang quản lý cho phép đặt một **tên sự kiện riêng cho từng ngày**; tên được lưu trên Firebase và chỉ tài khoản quản lý được sửa.
- Các máy phải dùng cùng liên kết và cùng ngày. Có thể chọn ngày cũ để xem/xuất Excel; việc quét chỉ dành cho ngày hôm nay.
- Nếu để trang qua nửa đêm hoặc đang xem ngày cũ, lượt quét mới sẽ tự chuyển về danh sách hôm nay.
- **Đã nhận mã — chờ gửi**: mã đã được lưu vào hàng đợi của điện thoại, chưa được máy chủ xác nhận.
- **Đã lưu trực tuyến**: máy chủ đã xác nhận. Có thể đổi người hoặc máy mà không mất bản ghi này.
- **Đã điểm danh trên danh sách chung**: MSSV đã tồn tại; không thêm dòng và không ghi đè thời gian.
- Nếu mất mạng sau khi đã kết nối, lượt quét mới được giữ trên máy. Khi có mạng, ứng dụng gửi lại tự động. Nếu tải lại trang khi đang mất mạng, cần kết nối lại Firebase trước khi nhận lượt quét mới; các lượt chờ cũ vẫn còn.
- Trước khi bàn giao điện thoại, kiểm tra **0 lượt chờ gửi**. Đừng xóa dữ liệu trình duyệt khi còn lượt chờ.
- Dữ liệu quét cũ ở chế độ lưu trên máy được giữ riêng, không tự đưa lên Firebase. Chuyển về lưu trên máy để xem lại.
- **Excel/CSV/JSON** xuất danh sách đang xem; dòng chờ gửi được ghi rõ trạng thái. JSON có thêm danh sách chờ và dữ liệu cục bộ để đối chiếu. Khôi phục JSON chỉ áp dụng ở chế độ cục bộ, không ghi đè Firebase và không tự gửi hàng đợi từ file.
- Người quản lý có thể xóa các bản ghi đang hiển thị: dừng quét trên tất cả máy, đợi gửi hết hàng đợi, xuất file rồi xóa. Bản ghi đến sau thời điểm xác nhận xóa không nằm trong danh sách xóa này.

## Lưu lượng

Mỗi điểm danh mới dùng **1 lượt ghi**, không có bộ đếm ghi riêng trên máy chủ. Quét trùng không ghi lại. Lượt đọc vẫn phát sinh khi kiểm tra trùng, kiểm tra quyền, tải danh sách và nhận cập nhật trên mỗi máy.

Theo hạn mức Cloud Firestore Standard: 20.000 lượt ghi/ngày, 50.000 lượt đọc/ngày, 1 GiB lưu trữ miễn phí. Hạn mức áp dụng chung cho dự án, không phải riêng từng máy. Khi không có mạng hoặc chạm hạn mức, không xem hàng đợi là dữ liệu đã lưu trực tuyến.

Nguồn: [Thiết lập Firebase Web](https://firebase.google.com/docs/web/setup), [đăng nhập ẩn danh](https://firebase.google.com/docs/auth/web/anonymous-auth), [giao dịch chống trùng](https://firebase.google.com/docs/firestore/manage-data/transactions), [hạn mức](https://firebase.google.com/docs/firestore/quotas).

## Kiểm tra kỹ thuật

Trang là HTML và ES modules, không cần build để chạy trên GitHub Pages. Có thể chạy bộ kiểm tra với Node.js và Java 17+:

```
npm install
npm run test:core
npm run test:rules
```

Các bài kiểm tra dùng dự án emulator `demo-attendance`, không ghi vào Firebase thật. Kiểm tra trên dự án thật bằng hai điện thoại vẫn cần thực hiện sau khi nhập cấu hình.
