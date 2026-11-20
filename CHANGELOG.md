# Changelog

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
