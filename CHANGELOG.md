# Changelog

## Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3): v1.0.0

Spec và giả định: [phase4-spec.md](docs/notes/phase4-spec.md). **Không đổi luật chơi, số liệu hay đầu ra headless**; test Phase 1 đến 3 giữ nguyên.

### Thêm mới
- **Benchmark:** `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (`npm run bench`). Cảnh chuẩn 1280×720: 200 Bóng Mực wander, 100 đom đóm, L1 đến L3 fuel 100, camera bay vòng. Lõi có tham số `bench` (mặc định tắt) để tắt sinh thêm/sát thương/nhặt/hao dầu/kết thúc.
- **Soak test:** `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json` (`npm run soak`): 10 đêm liên tiếp, input ngẫu nhiên theo seed, đếm crash và bộ nhớ.
- **Bảng xếp hạng cục bộ:** nhập tên sau khi thắng Đêm 3 hoặc thua; top 10; lưu `data/leaderboard.json`; màn hình từ menu; xuất bằng `npm start -- --export-leaderboard out.json`.
- **Tiếp cận:** đổi phím cho 9 hành động (báo trùng, khôi phục mặc định, được lưu); phụ đề và mũi tên mép màn hình cho Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn fuel < 30; "Giảm chuyển động"; chữ UI ≥ 18 px và tùy chọn chữ lớn ×1.25.
- **Đóng gói:** `npm run dist` tạo gói zip phát hành; README, CREDITS, retro, nhật ký Phase 4.

### Contract v1.3
- `contract_version: "1.3"`; `game.contract.json` thêm `bench_cmd` và `soak_cmd`. Mọi yêu cầu v1.0 đến v1.2 giữ nguyên.

### Thay đổi hành vi (chỉ ở bản web, không ảnh hưởng headless)
- Phím **Enter không còn là phím tương tác** (chỉ còn dùng để vào đêm). Lý do: tránh trùng khi đổi phím.
- Thêm rung camera và chớp đỏ khi Mây bị trúng (tắt bằng "Giảm chuyển động", mặc định theo cài đặt hệ điều hành).
- Bóng Mực dùng chung vật liệu (nhanh hơn khi có 200 con), không đổi hình ảnh.

## Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2): thay đổi phá vỡ tương thích

Quyết định thiết kế: [ADR-001](docs/notes/ADR-001-den-co-dau-va-luat-thang.md).

### Luật
- **BREAKING:** đèn đã sáng vẫn nhận đom đóm (châm dầu) và có thể tắt. Trước đây sáng là mãi mãi.
- **BREAKING:** bỏ thắng sớm. Thắng khi còn sống ở bình minh và đủ `ceil(0.6 × tổng)` đèn sáng (3/5, 4/6, 5/7). `game_over.reason` `all_lit` không còn dùng; thêm `dawn_survived`.
- **BREAKING:** thời gian đêm 300/330/360 s → 240/270/300 s.
- **BREAKING:** vùng an toàn mất khi đèn `fuel < 30` (trước: luôn có khi đèn sáng).
- **BREAKING:** hết choáng thì Bóng Mực về `wander` (trước: `chase` nếu cách ≤ 18 m).
- **BREAKING:** Bóng Mực `wander` đi tới đèn yếu/đèn tắt (trước: đi ngẫu nhiên); thêm trạng thái `drain`.
- Sức chứa tăng dần: `min(20, 10 + 2 × successful_lights)`.
- Thắp lại đèn đã từng sáng chỉ cần 5 đom đóm.

### Điểm (**BREAKING**, thay toàn bộ công thức)
Nạp/châm +5 mỗi đom đóm (trước +10) · thắp lần đầu +100 · thắp lại +40 · trúng tỏa sáng +5 (+15 nếu đang drain) · bình minh (chỉ khi thắng) +50 + floor(fuel) mỗi đèn sáng, +50 mỗi lửa · bỏ thưởng thời gian.

### Contract v1.2
- `contract_version: "1.2"`; `tuning` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`; `score.per_mote` 10 → 5, `score.per_second_left` 2 → 0.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`; Bóng Mực thêm trạng thái `drain` và `target_lantern_id`.
- Scenario: đèn đặt `lit`/`fuel`/`ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`; `lit: true` không có `fuel` thì `fuel: 100`.
- Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`.

### Bản web
Thanh dầu trên đèn, đèn nhấp nháy 1 Hz khi `fuel < 30`, đèn tắt xẹp 20% và có vết rách, HUD hiển thị mang/sức chứa và số đèn cần giữ, cài đặt "Bảng màu dễ phân biệt" (được lưu).

### Test cũ bị thay (sửa kèm lý do, không skip)
Xem bảng "Test bị luật mới thay" ở [phase3-spec.md](docs/notes/phase3-spec.md).

## Phase 2 (Ticket-02)
Xem [phase2-spec.md](docs/notes/phase2-spec.md): số liệu chuẩn, 3 đêm, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió, tạm dừng, Contract v1.1.

## Phase 1 (PRD-0)
Lõi game, chế độ headless Contract v1.0, bản 3D Đêm 1.
