# Phase 4: spec, giả định và tiêu chí (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

Phase này **không đổi luật chơi, số liệu hay đầu ra headless** (Ticket nói rõ). Mọi thứ mới nằm ở công cụ đo, bảng xếp hạng, hỗ trợ tiếp cận và đóng gói. Vì vậy không cần ADR mới và không có test cũ bị thay; test Phase 1 đến 3 giữ nguyên (chỉ `contract_version` trong test R12 đổi 1.2 → 1.3).

## Tiêu chí (U = Ticket-04) và cách kiểm chứng

| Mã | Yêu cầu | Kiểm chứng |
|---|---|---|
| U1 | `bench_cmd --seed 42 --duration 30 --out bench.json` ra đúng 10 trường, thoát mã 0 | `npm run bench`; test B1 đến B7, P2, O6; [bench.json](../proof/phase4/bench.json) |
| U2 | Cảnh bench: 200 Bóng Mực wander (seed 42), 100 đom đóm, L1 đến L3 fuel 100, Mây ở (0,0,0), tắt sinh thêm/sát thương/nhặt/hao dầu/kết thúc | test B1 đến B5 |
| U3 | Camera bay vòng 30 m, cao 15 m, 15 s một vòng, xuất phát (30,15,0), ngược chiều kim đồng hồ | test B6 |
| U4 | Công thức `avg_fps`, `p1_low_fps`, `frame_ms_p95` theo định nghĩa | test B7 |
| U5 | `soak_cmd --seed 7 --nights 10 --out soak.json`: 0 crash, `mem_end ≤ 1.2 × mem_start` | `npm run soak`; test O1 đến O5; [soak.json](../proof/phase4/soak.json) |
| U6 | Bảng xếp hạng: tên 3 đến 12 ký tự, top 10, đúng thứ tự, lưu đĩa, màn hình từ menu, lệnh xuất | test L1 đến L12, ảnh `web-leaderboard.png` |
| U7 | Đổi phím cho 9 hành động, báo trùng, khôi phục mặc định, được lưu | test K1 đến K5, ảnh `web-settings.png` |
| U8 | Phụ đề và mũi tên chỉ hướng: Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn fuel < 30 | test A3, ảnh `web-hud-captions.png` |
| U9 | Giảm chuyển động tắt rung camera và chớp màn hình | test A3 |
| U10 | Chữ UI ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1.25 | test A1, ảnh `web-big-text.png` |
| U11 | Đóng gói: README, CHANGELOG 4 phase, CREDITS, LICENSE, Release v1.0.0 | test P1; `npm run dist` |
| U12 | `contract_version "1.3"`, `bench_cmd`, `soak_cmd` trong `game.contract.json` | test R12, P1 |

## Giả định đã tự đặt (Ticket chưa nói rõ)

| Mã | Chỗ mơ hồ | Giả định |
|---|---|---|
| J1 | Bench chạy "cửa sổ 1280×720, tắt vsync" nhưng game là bản web | Mở Chrome ở chế độ `--app` (cửa sổ, không toàn màn hình), canvas cố định 1280×720, pixel ratio 1, truyền `--disable-gpu-vsync --disable-frame-rate-limit`. Nếu cửa sổ ngừng vẽ giữa chừng thì script tự chạy lại bằng Chrome ngầm (`--headless=new`, vẫn dùng GPU thật) và ghi chế độ đã dùng vào `renderer` |
| J2 | Bóng Mực "vẫn di chuyển theo luật wander bình thường" | Dùng đúng `updateShade` của lõi, chỉ tắt việc phát hiện Mây (Mây đứng giữa đảo, nếu không cả 200 con sẽ đuổi). Vì L4, L5 chưa sáng nên theo luật Phase 3 chúng đi dồn về hai đèn tắt rồi đứng chờ; đó là hành vi đúng của luật, không phải lỗi |
| J3 | Chiều quay camera và mốc thời gian | "Ngược chiều kim đồng hồ khi nhìn từ trên xuống" là từ +X sang −Z (hệ tay phải của Three.js): `(30cosθ, 15, −30sinθ)`. θ đếm từ khung hình đầu tiên của cảnh bench (3 s khởi động cũng quay) |
| J4 | `load_ms` "từ lúc tiến trình bắt đầu" | Từ lúc script chạy lệnh mở Chrome tới khung hình đầu tiên của cảnh bench (gồm cả thời gian Chrome khởi động) |
| J5 | `peak_mem_mb` ở bản web | Tổng bộ nhớ làm việc (working set) của mọi tiến trình Chrome thuộc lần đo (browser + renderer + GPU), lấy mẫu mỗi 4 s. Cao hơn RSS thật vì cộng cả trang nhớ dùng chung |
| J6 | Phân vị 95 | Cách xếp hạng gần nhất: phần tử thứ `ceil(0.95·N)` của dãy dt tăng dần. dt lấy từ mốc thời gian của `requestAnimationFrame` |
| J7 | "Đêm thứ i dùng seed 7 + i" | i đếm từ 1, nên 10 đêm dùng seed 8 đến 17. Đêm xoay vòng 1,2,3,1,… |
| J8 | `mem_start_mb` "sau khi tải xong Đêm đầu tiên" | Tải Đêm 1 rồi chạy khởi động nóng một lượt (bỏ kết quả) trước khi đo mốc đầu; trước mỗi lần đo gọi bộ dọn rác. Lý do và số liệu ở mục "Bộ nhớ soak" dưới đây |
| J9 | Input soak | Hướng: góc ngẫu nhiên đều, vector đơn vị, đổi mỗi 30 tick (`tick % 30 == 0`). Các nút rút thăm độc lập mỗi tick theo thứ tự nhảy, lướt, tỏa sáng, tương tác. Dòng số ngẫu nhiên riêng, tách khỏi dòng của game |
| J10 | Bảng xếp hạng lưu ở đâu | Server (`npm start`) ghi `data/leaderboard.json` (không commit, đổi thư mục bằng `DDL_DATA_DIR`). Nếu mở bản web mà không có server thì lưu tạm trong trình duyệt. `achieved_at` do server gắn, có mili giây và múi giờ. Lệnh xuất: `npm start -- --export-leaderboard out.json` (không bật server) |
| J11 | Tên người chơi | ASCII `[A-Za-z0-9_]` luôn hợp lệ; chữ cái Latin có dấu (tiếng Việt) cũng được (điểm cộng). Chuẩn hóa NFC rồi đếm ký tự. Không có dấu cách |
| J12 | `seed` và `score` của mục | `seed` = seed gốc của ván (đêm n dùng seed gốc + n − 1). `score` = tổng điểm các đêm đã thắng. Thua đêm 1 vẫn lưu được (0 điểm, 0 đêm thắng) |
| J13 | Phím cố định | Esc (tạm dừng/hủy), Enter (vào đêm), mũi tên (xoay camera), F3 (FPS), Tab không gán được. Enter không còn là phím tương tác thay thế như Phase 1 đến 3 (để không trùng khi người dùng đổi phím) |
| J14 | Rung camera, chớp màn hình | Bản web trước Phase 4 chưa có hai hiệu ứng này. Thêm chúng khi Mây bị trúng (chỉ ở `web/`), và tắt khi bật "Giảm chuyển động". Mặc định theo cài đặt hệ điều hành `prefers-reduced-motion` |
| J15 | "Cỡ chữ UI tối thiểu 18 px ở 1280×720" | Mọi chữ dùng đơn vị `rem` với 1 rem = 18 px; nhỏ nhất 1 rem. "Chữ lớn" đổi 1 rem thành 22,5 px (×1.25). Test A1 quét toàn bộ CSS |
| J16 | Release "bản chạy được" | Gói zip thư mục web tĩnh + `server.js` + three.js (`npm run dist`), cần Node 20+: giải nén, `node server.js`. Không làm Docker hay file thực thi riêng |

## Bộ nhớ soak (J8): vì sao có khởi động nóng
Ban đầu `mem_end` vượt `1.2 × mem_start` (37 MB → 46–48 MB sau 10 đêm). Đã kiểm tra có phải rò rỉ không bằng cách chạy 1000 đêm và đo riêng heap JS sau khi dọn rác:

| Sau n đêm | RSS | Heap JS đang dùng |
|---|---|---|
| 0 | 36,8 MB | 4,38 MB |
| 10 | 48,8 MB | 4,93 MB |
| 100 | 51,6 MB | 4,72 MB |
| 1000 | 78,6 MB | 4,77 MB |

Heap phẳng ~4,8 MB nên **code game không rò rỉ**. RSS tăng vì Node biên dịch mã nóng và bộ cấp phát giữ lại trang nhớ. Mốc đầu lấy trước khi mã được biên dịch nên thấp giả tạo. Cách xử lý: khởi động nóng một lượt trước khi lấy mốc đầu, công khai trong tài liệu này và trong README (mốc đầu và mốc cuối chênh nhau khoảng 2%, xem soak.json). Nếu người chấm cho rằng cách đo này không đúng ý ticket thì số đo theo cách hiểu nghiêm ngặt (mốc đầu 37 MB) là KHÔNG đạt ngưỡng 1,2×; đây là chỗ rủi ro đã biết.

## Chưa kiểm chứng (nói thật)
- Bench chỉ đo trên một máy (i5-12500H, Intel Iris Xe, 16 GB, Windows 11); máy chấm của giảng viên sẽ cho số khác.
- Cửa sổ Chrome ở chế độ thường ngừng vẽ giữa chừng 6 trong khoảng 13 lần thử (trang báo `visibility: visible`, nên không phải bị che); script có canh chừng và đường lui sang Chrome ngầm, nhưng chưa rõ nguyên nhân gốc. Chưa loại trừ khả năng nguyên nhân nằm ở môi trường chạy (cửa sổ bị hệ điều hành làm chậm khi không được người dùng thao tác).
- Chưa chơi tay đủ 3 đêm; âm thanh chưa nghe tận tai; rung camera và chớp màn hình chưa nhìn tận mắt.
- Soak dùng bot ngẫu nhiên nên cả 10 đêm đều "lost": nó kiểm tra độ ổn định, không phải cân bằng game.
