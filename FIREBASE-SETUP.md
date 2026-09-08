# Kết nối Firebase cho Điểm danh V3.2

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

Quy tắc yêu cầu người quét xác nhận đúng tên trong danh sách thành viên của sự kiện. Người quét không thể tải danh sách tên, sửa hoặc xóa bản ghi đã có. Chỉ tài khoản Google của giảng viên quản lý sự kiện và dữ liệu.

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
- Cấu hình Web của dự án `diem-danh-tknt` đã được lưu sẵn trong ứng dụng V3.2.
- Đây là cấu hình Web công khai của ứng dụng; **không lấy tệp Service Account hoặc private key**.

## 5. Kết nối ứng dụng

- Mở [trang quản lý](https://tranquanghai-ops.github.io/diem-danh/admin/), kiểm tra **V3.2**.
- Nhấn **Đăng nhập Google**, chọn tài khoản giảng viên. Không cần dán lại `firebaseConfig`.
- Chọn ngày, nhấn **Tạo sự kiện**, nhập tên sự kiện và danh sách thành viên, mỗi dòng một họ tên.
- Nút **Dùng tại link chính** đưa sự kiện đang chọn lên `https://tranquanghai-ops.github.io/diem-danh/`. Nút **Sao chép link sự kiện** tạo liên kết riêng, phù hợp khi có 2–3 sự kiện hoạt động cùng ngày.
- Trên điện thoại SV, mở `https://tranquanghai-ops.github.io/diem-danh/` bằng Chrome. Trang tự tìm danh sách chung và ghi nhớ kết nối.
- Khi đổi điện thoại quản lý, mở cùng liên kết và đăng nhập đúng tài khoản Google ban đầu.

## Cách dùng mỗi ngày

- Mỗi sự kiện có tên, ngày, danh sách thành viên, liên kết và dữ liệu điểm danh riêng. Có thể tạo nhiều sự kiện trong cùng ngày.
- Mọi người có đúng liên kết sự kiện đều được quét sau khi nhập tên người quét. Danh sách tên do GV nhập chỉ dùng để cấp quyền **SV quản lý phụ**: xem/tải toàn bộ dữ liệu sự kiện và xóa từng lượt sai. Chỉ GV được sửa sự kiện, sửa danh sách quyền hoặc dùng chức năng xóa toàn bộ.
- Liên kết chính chỉ trỏ đến một sự kiện tại một thời điểm. Với nhiều sự kiện đồng thời, gửi liên kết riêng của từng sự kiện.
- Danh sách trên màn hình hiển thị mới nhất ở trên; Excel/CSV xuất theo thứ tự thời gian từ cũ đến mới.
- Ảnh chụp không quét được chỉ lấy đúng vùng trong khung. Người chụp có thể mở lại, phóng to và nhập MSSV; GV vẫn có thể xem, hiệu chỉnh hoặc xóa từng ảnh.
- **Đã nhận mã — chờ gửi**: mã đã được lưu vào hàng đợi của điện thoại, chưa được máy chủ xác nhận.
- **Đã lưu trực tuyến**: máy chủ đã xác nhận. Có thể đổi người hoặc máy mà không mất bản ghi này.
- **Đã điểm danh trên danh sách chung**: MSSV đã tồn tại; không thêm dòng và không ghi đè thời gian.
- Nếu mất mạng sau khi đã kết nối, lượt quét mới được giữ trên máy. Khi có mạng, ứng dụng gửi lại tự động. Nếu tải lại trang khi đang mất mạng, cần kết nối lại Firebase trước khi nhận lượt quét mới; các lượt chờ cũ vẫn còn.
- Trước khi bàn giao điện thoại, kiểm tra **0 lượt chờ gửi**. Đừng xóa dữ liệu trình duyệt khi còn lượt chờ.
- **Excel/CSV/JSON** xuất sự kiện đang chọn. Tên tệp gồm tên sự kiện và ngày.
- Người quản lý có thể xóa từng lượt quét sai hoặc xóa toàn bộ lượt điểm danh của sự kiện đang chọn.

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
