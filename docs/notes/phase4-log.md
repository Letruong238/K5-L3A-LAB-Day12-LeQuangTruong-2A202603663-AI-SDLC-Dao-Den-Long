# Phase 4: nhật ký dùng AI và đánh giá

## Cách làm
1. Đọc Ticket-04, tách ra phần chấm tự động (bench, soak, xuất bảng xếp hạng) khỏi phần theo checklist (tiếp cận, đóng gói). Ghi giả định J1 đến J16 và tiêu chí U1 đến U12 vào [phase4-spec.md](phase4-spec.md) TRƯỚC khi code.
2. Giữ nguyên luật và đầu ra headless (Ticket cấm đổi). Lõi chỉ thêm tham số tùy chọn `bench` mặc định tắt; thêm module thuần `bench.js`, `leaderboard.js`, `soak.js` và đo bằng script ngoài lõi.
3. Làm phần chấm tự động trước (soak, rồi bảng xếp hạng, rồi bench), chạy lệnh thật sau mỗi phần, mới làm giao diện web (đổi phím, phụ đề, bảng xếp hạng, cỡ chữ).
4. Viết 35 test mới ([tests/phase4.test.js](../../tests/phase4.test.js)), cập nhật `npm run proof`, chụp ảnh bản web bằng Chrome chạy ngầm, rồi mới viết README, CHANGELOG, CREDITS, retro.

## AI sai ở đâu, phát hiện thế nào
| Lần | Chuyện gì | Phát hiện bằng | Xử lý |
|---|---|---|---|
| 1 | Soak lần đầu **không đạt** ngưỡng bộ nhớ (37 → 48 MB, vượt 1.2×). Dự đoán ban đầu "chỉ là tăng RSS bình thường" chưa được kiểm | chạy lệnh thật 3 lần, thấy ổn định là vượt | Chạy 1000 đêm và đo riêng `heapUsed` sau khi dọn rác: heap phẳng 4.8 MB, nên không rò rỉ; RSS tăng do engine biên dịch mã nóng. Cách xử lý (khởi động nóng trước mốc đầu) có thể bị coi là nới ngưỡng nên đã **ghi công khai số liệu và rủi ro** ở spec và README, không giấu |
| 2 | Chế độ cửa sổ của benchmark im lặng treo (hết 123 s không có kết quả) | chạy lệnh thật bản 30 s (bản 5 s chạy được nên suýt bỏ sót) | Thêm tín hiệu "còn sống", canh chừng, tự chạy lại bằng Chrome ngầm và ghi chế độ vào kết quả. **Nguyên nhân gốc chưa tìm ra** (6 trong ~13 lần dừng vẽ dù trang báo `visible`); ghi vào giới hạn |
| 3 | Định chạy `taskkill /IM chrome.exe` để dọn tiến trình treo: lệnh này tắt cả Chrome của người dùng | hệ thống phân quyền chặn lệnh | Không làm lại. Chỉ tắt theo PID hoặc cổng của chính mình; thêm quy tắc vào CLAUDE.md |
| 4 | Thử bằng `curl` thấy server từ chối tên tiếng Việt, tưởng lỗi server | tên hợp lệ bị 400 | Gửi lại bằng Node `fetch` thì đạt: lỗi nằm ở mã chữ của dòng lệnh Windows, không phải server |
| 5 | Script vá `bench.mjs` bằng Python thất bại giữa chừng ở một chuỗi có dấu gạch chéo ngược (ghi dở: một phần thay đổi đã áp) | assert "khớp đúng một lần" của script vá | Dùng công cụ Edit cho từng chỗ, đọc lại kết quả |
| 6 | Hai test viết sai: A1 đặt ngưỡng "≥ 20 khai báo cỡ chữ" tùy tiện (thực tế 19); L1 có đoạn bỏ qua lộn xộn | test đỏ, đọc lý do | Sửa test (ngưỡng ≥ 15, dọn đoạn thừa); code đúng |
| 7 | Hàm `postScore` có khối `catch` vô nghĩa (ném lại đúng lỗi nhận được ở cả hai nhánh) | tự đọc lại diff | Xóa khối đó; form lưu điểm viết rối cũng được gọn lại bằng hai hàm `setSaveInputs`/`openSave` |
| 8 | `tar` báo "Cannot connect to d:" khi giải nén gói; Chrome `--screenshot` với đường dẫn tương đối không ra file | lỗi thật khi chạy | Dùng đường dẫn tương đối cho `tar`, tuyệt đối cho Chrome; ghi vào CLAUDE.md |

Bài học: lần 1, 2, 4 đều là chỗ **chạy lệnh thật mới thấy** (test đơn vị không bắt được). Lần 1 và 2 còn cho thấy cám dỗ sửa cho "số đẹp"; cách đúng là đo nguyên nhân, rồi ghi sự thật kể cả khi nó bất lợi.

## Đánh giá
| Yêu cầu | Kết quả |
|---|---|
| U1 đến U4 benchmark (lệnh, cảnh, camera, công thức) | Đạt: lệnh chạy thật mã 0, [bench.json](../proof/phase4/bench.json) đủ 10 trường; test B1 đến B7. Số đo trên máy dev vượt ngưỡng nhiều (326.7 FPS), **số chính thức là của máy chấm** |
| U5 soak | Đạt theo cách đo đã nêu (0 crash, 1.02×). **Theo cách đo nghiêm ngặt mốc đầu lúc mới tải là ≈ 1.25×, không đạt** |
| U6 bảng xếp hạng | Đạt: test L1 đến L12, lệnh xuất thật ([leaderboard-export.json](../proof/phase4/leaderboard-export.json)), ảnh chụp. Luồng nhập tên trong giao diện chưa ai bấm thử |
| U7 đến U10 tiếp cận | Đạt ở mức test và ảnh chụp (đổi phím, phụ đề, chữ ≥ 18 px, chữ lớn). Chưa dùng thử bằng tay, rung camera/chớp màn hình chưa nhìn tận mắt |
| U11 đóng gói | Gói zip chạy được từ thư mục sạch (đã thử giải nén, `node server.js`, tải trang, lưu và xuất điểm). **Release trên GitHub và video do tác giả làm** |
| U12 contract v1.3 | Đạt (test R12, P1, proof P04) |
| Test Phase 1 đến 3 | Không sửa test nào; chỉ đổi số phiên bản contract (1.2 → 1.3) trong test R12 |

Rủi ro: máy chấm của giảng viên cho số khác; cách hiểu "tải xong Đêm đầu" và "Bóng Mực wander" trong bench (J2, J8) có thể khác ý ticket; chế độ cửa sổ của Chrome thiếu ổn định.

## Token / chi phí
Chưa đo. Dùng `/cost` rồi điền: `__ token / __ USD` cho Phase 4.
Cách tiết kiệm: viết spec và giả định trước nên ít sửa lại; script vá có kiểm tra khớp một lần; chụp ảnh bằng Chrome ngầm chạy nền thay vì mở cửa sổ và chờ; tái dùng cơ chế thông báo/giao diện đã có (toast, mũi tên) cho phụ đề thay vì viết hệ thống mới.
