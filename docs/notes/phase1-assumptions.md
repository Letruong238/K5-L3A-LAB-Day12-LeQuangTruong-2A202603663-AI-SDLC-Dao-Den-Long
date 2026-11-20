# Phase 1: giả định và tiêu chí nghiệm thu

> Lưu ý: tài liệu này mô tả luật ở tag `phase-1`. Từ Phase 2, Ticket-02 thay các số liệu và một số luật (G2, G3, G5, G8 đến G10, G14 và điểm số). Xem bảng "Luật Phase 1 bị thay" ở [phase2-spec.md](phase2-spec.md).

Nguồn yêu cầu: PRD-0 + Test Contract v1.0 (lab board, tab Phase 1).

## Giả định (chỗ PRD-0 mơ hồ, tự chọn và khai trong `game.contract.json`)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| G1 | "ánh sáng" để nạp đèn và tỏa sáng | Là đom đóm đang mang (`carried`). Tỏa sáng tốn `pulse_cost` đom đóm. |
| G2 | Số liệu cân bằng | Xem bảng `tuning` ở README. Mọi số trong contract là số game thật sự dùng (có test so khớp). |
| G3 | Kích thước đảo | Bán kính 40 m, tâm (0,0,0). Đi quá mép thì bị chặn lại, không rơi (`fall_enabled: false`). |
| G4 | Vị trí 5 đèn mặc định | Vòng tròn bán kính 25 m, đèn `Li` ở góc `(i-1)*72°` tính từ +Z. L1 = (0,0,25). |
| G5 | Thắp đèn | Nạp đủ `lantern_cost` đom đóm thì đèn sáng. Nạp một phần được, giữ lại cho lần sau. |
| G6 | Nạp đèn | Nhấn `interact` khi trong `interact_radius` của đèn chưa sáng gần nhất và đang mang đom đóm. Nạp `min(carried, còn thiếu)`. |
| G7 | Nhặt đom đóm | Tự động khi trong `pickup_radius` và chưa đầy `carry_capacity`. |
| G8 | Bị Bóng Mực chạm | Mất 1 ngọn lửa (máu), rơi `floor(carried * hit_drop_ratio)` đom đóm ra vòng 2.5 m quanh người, bất tử `invuln_s`. |
| G9 | Vùng an toàn | `safe_radius` áp dụng quanh MỌI đèn (sáng hay chưa). Bóng Mực bị đẩy ra khỏi vùng. Chọn 5 m, lớn hơn bán kính chạm + `interact_radius` nên đứng cạnh đèn là an toàn. |
| G10 | Tỏa sáng | Cần `carried >= pulse_cost` và hết hồi. Mọi Bóng Mực trong `pulse_radius` bị choáng `pulse_stun_s` và đẩy lùi `pulse_push_m`. Bóng Mực choáng không gây sát thương. Event `pulse` ghi cả khi không trúng ai. |
| G11 | Thắng | Mọi đèn sáng. Thưởng: `per_second_left * floor(giây còn lại) + per_flame_left * ngọn lửa còn lại`. |
| G12 | Thua | Hết ngọn lửa (`no_flames`) hoặc hết giờ (`dawn`). |
| G13 | Nhảy | Có vật lý nhảy theo trục Y (ảnh hưởng `player.pos[1]`), không ảnh hưởng nhặt, chạm hay đèn (khoảng cách đo theo XZ). |
| G14 | Sinh ngẫu nhiên | Khi `random_motes`/`random_shades` mặc định true: 20 đom đóm lúc đầu, bổ sung 1 con mỗi 2 s nếu dưới 20; 1 Bóng Mực lúc đầu (không phát event), thêm 1 con mỗi 15 s (tối đa 5). Dùng PRNG có seed nên tất định. |
| G15 | Scenario `lit:true` không kèm `deposited` | `deposited` = `lantern_cost`. `deposited >= lantern_cost` mà không ghi `lit` thì coi là đã sáng. |
| G16 | Mã thoát | Thiếu hoặc sai tham số dòng lệnh: 1. File scenario/inputs không đọc được hoặc sai định dạng: 2. |
| G17 | Snapshot cuối | Ngoài snapshot mỗi N tick, ghi thêm một snapshot ở tick cuối nếu chưa trùng bội số của N. |
| G18 | Sáng tạo | Chỉ ở bản web (mây trôi, đom đóm lấp lánh), không có trong lõi, không ảnh hưởng headless. |

## Tiêu chí nghiệm thu (mỗi dòng: làm A thì thấy B)

| ID | Tiêu chí |
|---|---|
| R1 | Chạy headless `--ticks N` thực hiện đúng N bước, dòng cuối là `end`, snapshot tick 0 có trước mọi input. |
| R2 | `move [0,1]`, `cam_yaw_deg 0`, 60 tick thì đi +6 m theo +Z. `move [1,1]` được chuẩn hóa. `cam_yaw_deg 90` đổi hướng đúng công thức. |
| R3 | Đứng trong `pickup_radius` của đom đóm thì ra event `mote_picked`, `carried` tăng, điểm tăng `per_mote`. Đầy thì không nhặt. |
| R4 | `interact` gần đèn thì ra `deposit` đúng `amount`, đủ cost thì ra `lantern_lit` và cộng `per_lantern`. `interact` giữ liên tục chỉ nạp một lần. |
| R5 | Bóng Mực chạm thì ra `player_hit`, mất lửa, rơi đom đóm, rồi bất tử `invuln_s`. |
| R6 | `pulse` đủ đom đóm thì ra `pulse` với `stunned_ids`, Bóng Mực choáng và bị đẩy, tốn `pulse_cost`, có hồi. |
| R7 | Bóng Mực không bao giờ vào trong `safe_radius` quanh đèn. |
| R8 | Thắp hết đèn thì `game_over` won/`all_lit`. Hết lửa thì lost/`no_flames`. Hết giờ thì lost/`dawn`. |
| R9 | Dựng scenario không phát event và không cộng điểm. |
| R10 | `random_shades:false` thì không có `shade_spawned`. Cùng seed, scenario, inputs thì output giống hệt. |
| R11 | File inputs/scenario sai thì thoát mã 2. |
| R12 | `game.contract.json` khớp số liệu thật trong code. |
| R13 | Game 3D chơi được từ đầu đến thắng/thua, có HUD và chơi lại. |
