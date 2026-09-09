# Kết nối Firebase cho Điểm danh V1.4

Thiết lập **một lần bằng tài khoản Google của giảng viên**. Sinh viên quét bằng liên kết riêng của sự kiện; trang chính dùng để tra cứu lịch sử điểm danh bằng email trường. Website vẫn ở địa chỉ hiện tại; không phải chuyển sang Firebase Hosting.

## 1. Tạo dự án miễn phí

- Mở [Firebase Console](https://console.firebase.google.com/), chọn **Create a project / Tạo dự án**.
- Đặt tên, ví dụ `diem-danh-tdtu`. Có thể bỏ Google Analytics.
- Giữ gói **Spark**, không cần liên kết thanh toán cho chức năng trong ứng dụng này.

## 2. Tạo cơ sở dữ liệu

- Vào **Build → Firestore Database → Create database**.
- Chọn **Standard edition**, database mặc định `(default)`, chế độ **Production**.
- Chọn vị trí gần Việt Nam, chẳng hạn Singapore nếu có trong danh sách.
- Mở tab **Rules**, thay nội dung bằng toàn bộ [firestore.rules](./firestore.rules), rồi nhấn **Publish**.

Quy tắc bảo vệ dữ liệu người quét, quản lý phụ và admin. Chỉ chủ sở hữu được thêm hoặc xóa admin; admin chỉ được xóa sự kiện do chính mình tạo.

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
- Cấu hình Web của dự án `diem-danh-tknt` đã được lưu sẵn trong ứng dụng V1.4.
- Đây là cấu hình Web công khai của ứng dụng; **không lấy tệp Service Account hoặc private key**.

## 5. Kết nối ứng dụng

- Mở [trang quản lý](https://tranquanghai-ops.github.io/diem-danh/admin/), kiểm tra **V1.4**.
- Nhấn **Đăng nhập Google**, chọn tài khoản giảng viên. Không cần dán lại `firebaseConfig`.
- Chọn ngày, nhấn **Tạo sự kiện**, nhập tên sự kiện và danh sách thành viên, mỗi dòng một họ tên.
- Nút **Sao chép link sự kiện** tạo liên kết riêng ngắn gọn để gửi sinh viên. Trang chính `https://tranquanghai-ops.github.io/diem-danh/` không cho phép quét.
- Trên điện thoại SV, mở đúng link riêng của sự kiện bằng Chrome.
- Khi đổi điện thoại quản lý, mở cùng liên kết và đăng nhập đúng tài khoản Google ban đầu.

## Thêm admin

- Đăng nhập trang quản lý bằng tài khoản chủ sở hữu.
- Trong **Quản lý admin**, nhập đúng Gmail/email Google của người cần cấp quyền rồi bấm **Thêm admin**.
- Admin dùng chính tài khoản Google đó để đăng nhập tại cùng địa chỉ `/admin/`.
- Admin được tạo, sửa, kích hoạt và quản lý dữ liệu sự kiện; không được thêm/xóa admin khác và chỉ được xóa sự kiện do chính mình tạo.
- Sự kiện mới ghi tên người tạo. Nút **Tất cả sự kiện** mở danh sách lịch sử, xếp sự kiện mới nhất lên trên để truy xuất lại dữ liệu cũ.

## Cách dùng mỗi ngày

- Mỗi sự kiện có tên, ngày, danh sách thành viên, liên kết và dữ liệu điểm danh riêng. Có thể tạo nhiều sự kiện trong cùng ngày.
- Mọi người có đúng liên kết sự kiện đều được quét sau khi nhập tên người quét. Danh sách tên do GV nhập chỉ dùng để cấp quyền **SV quản lý phụ**: xem/tải toàn bộ dữ liệu sự kiện và xóa từng lượt sai. Chỉ GV được sửa sự kiện, sửa danh sách quyền hoặc dùng chức năng xóa toàn bộ.
- Mỗi sự kiện bắt buộc dùng link riêng. Link mới có dạng ngắn `?e=xxxxxxxxxx`; sự kiện cũ tự tạo mã ngắn khi Admin mở lại.
- Danh sách trên màn hình hiển thị mới nhất ở trên; Excel/CSV sắp xếp MSSV từ nhỏ đến lớn và dùng thứ tự cột: STT, MSSV, Sự kiện, Thành viên quét, Thời gian.
- Ảnh chụp không quét được lấy toàn bộ vùng camera đang hiển thị để thấy cả MSSV và mã vạch. Người chụp có thể mở lại, phóng to và nhập MSSV; người quản lý vẫn có thể xem, hiệu chỉnh hoặc xóa từng ảnh.
- **Đã nhận mã — chờ gửi**: mã đã được lưu vào hàng đợi của điện thoại, chưa được máy chủ xác nhận.
- **Đã lưu trực tuyến**: máy chủ đã xác nhận. Có thể đổi người hoặc máy mà không mất bản ghi này.
- **Đã điểm danh trên danh sách chung**: MSSV đã tồn tại; không thêm dòng và không ghi đè thời gian.
- Nếu mất mạng sau khi đã kết nối, lượt quét mới được giữ trên máy. Khi có mạng, ứng dụng gửi lại tự động. Nếu tải lại trang khi đang mất mạng, cần kết nối lại Firebase trước khi nhận lượt quét mới; các lượt chờ cũ vẫn còn.
- Trước khi bàn giao điện thoại, kiểm tra **0 lượt chờ gửi**. Đừng xóa dữ liệu trình duyệt khi còn lượt chờ.
- **Excel/CSV/JSON** xuất sự kiện đang chọn. Tên tệp gồm tên sự kiện và ngày.
- Người quản lý có thể xóa từng lượt quét sai hoặc xóa toàn bộ lượt điểm danh của sự kiện đang chọn.

## Danh sách sinh viên dùng chung và trang tra cứu

- Chủ sở hữu hoặc Admin cấp cao mở **Danh sách sinh viên dùng chung** trên trang quản lý để nhập Excel/CSV, thêm hoặc cập nhật thủ công, xóa từng sinh viên và xuất lại Excel.
- Tệp nhập cần có cột `Mã SV` hoặc `MSSV`; tên có thể nằm trong cột `Họ tên`, hoặc tách thành `Họ lót` và `Tên`. Nhập lại tệp chỉ bổ sung/cập nhật, không tự xóa danh sách cũ.
- Khi quét, ứng dụng đối chiếu MSSV với danh sách này và hiển thị họ tên. MSSV ngoài danh sách hiện **Không có dữ liệu tên**.
- Mỗi sinh viên trong danh sách được ánh xạ tới email `mssv@student.tdtu.edu.vn`. Sinh viên mở [trang tra cứu](https://tranquanghai-ops.github.io/diem-danh/), đăng nhập đúng email trường và chỉ xem được lịch sử của chính mình.
- Chủ sở hữu và Admin cấp cao mở cùng trang tra cứu sẽ có ô nhập MSSV để xem thử đúng giao diện sinh viên. Sub Admin không có quyền này.
- Sau khi thay `firestore.rules`, bắt buộc nhấn **Publish** trong Firebase Console trước khi dùng tính năng danh sách và tra cứu mới.

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
