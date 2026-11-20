# Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2): spec, giả định, tiêu chí nghiệm thu

Quyết định thiết kế: [ADR-001](ADR-001-den-co-dau-va-luat-thang.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

## Test bị luật mới thay (đã sửa kèm lý do, không skip)

| Test (file) | Luật cũ | Vì sao sai với luật mới | Cách sửa |
|---|---|---|---|
| R1 `tests/core.test.js` | Đêm 1 dài 300 s | Ticket-03: 240 s | đổi kỳ vọng `time_left_s` |
| R4 "nạp đủ 10 thì ... thắng all_lit" | Thắp đủ đèn là thắng sớm, +10/đom đóm, +100 đèn, thưởng giây còn lại | Bỏ thắng sớm; +5/đom đóm; bỏ thưởng thời gian | viết lại: `lantern_lit relight:false`, không có `game_over`, điểm 5×10 + 100, `fuel 100` |
| R4 "nạp một phần ... 10 điểm" | +10 mỗi đom đóm nạp | +5 | đổi kỳ vọng 40 → 20 |
| R4 "nhấn lại thì nạp tiếp" | Lần hai nạp vào đèn thứ hai vì đèn đầu đã sáng | Đèn sáng chưa đầy dầu vẫn "nhận được"; đèn vừa thắp luôn hao 1 đơn vị trước bước tương tác nên chưa bao giờ đầy ở bước 5 | viết lại: mỗi lần bấm châm 1 đom đóm vào đèn gần nhất (`refuel`) |
| R4 "đèn gần nhất ... chỉ xét đèn chưa sáng" | Bỏ qua đèn đã sáng | Đèn sáng chưa đầy dầu cũng được xét | viết lại: đèn sáng `fuel 50` ở gần hơn nhận `refuel` |
| R6 "tỏa sáng choáng ..." | Hết choáng thì `chase` (nếu ≤ 18 m) | Hết choáng về `wander` | tick 121 `wander`, tick 122 `chase` |
| R8 "thắp đèn cuối đúng tick hết giờ vẫn thắng" | Thắng ngay khi đủ đèn | Không còn thắng sớm; thắng ở bình minh | thay bằng "đủ 5/5 đèn vẫn chơi tới bình minh, thắng `dawn_survived`" |
| R8 "Bóng Mực cạnh Mây lúc thắp đèn ... vẫn thắng" | Thắp đủ đèn thì thắng | Không còn thắng sớm | giữ phần "bị đẩy, không sát thương", đổi kết luận cuối thành `state: playing` |
| S9 `phase2.test.js` (thời lượng) | 330/360 s | 270/300 s | đổi kỳ vọng |
| `tests/cli.test.js` R12 | contract `1.1` | contract `1.2` và khóa `tuning` mới | đổi kỳ vọng và danh sách khóa |

Không có test nào bị skip hoặc xóa lặng lẽ. Mọi test Phase 1 và 2 khác (di chuyển, lướt, rơi, Gió Lạc, Bùa Gió, gió, tạm dừng, bản đồ, tất định, mã thoát) vẫn đạt nguyên vẹn.

## Giả định mới (ticket chưa nói rõ)

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| I1 | Độ chính xác dầu | `fuelU = fuel × 60` (số nguyên): hao 1 đơn vị/tick, hút 5 đơn vị/tick/Bóng Mực. Chỉ làm tròn 1 chữ số khi xuất. |
| I2 | Vị trí trừ dầu trong bước 2 | Cuối bước 2 (sau các bộ đếm khác), rồi đèn `fuel ≤ 0` tắt. |
| I3 | Khi nào hút | Bóng Mực `drain` hút khi đèn đích đang sáng, `fuel < 30` và cách ≤ 2 m. Còn lại không hút (để không hút thêm trong lúc đang bị đẩy ra sau khi châm dầu). |
| I4 | Wander "như trước" | Ticket-02 chưa quy định đích của `wander`. Từ Phase 3: đi tới đèn yếu, không có thì đèn tắt gần nhất, không có đèn tắt thì đi ngẫu nhiên. Tốc độ `wander` vẫn 2 m/s. Tới đèn tắt thì đứng chờ. |
| I5 | Tiến độ nạp đèn tắt | Đèn nhớ `deposited` khi chưa sáng. Thắp xong giữ `deposited = giá thắp`; hết dầu về 0. |
| I6 | `fuel_drain` | Mỗi Bóng Mực ghi một sự kiện khi số tick hút của nó chia hết cho 60. `fuel` là giá trị sau khi hao và hút. |
| I7 | `target_lantern_id` ở scenario | Được giữ khi đèn đó vẫn sáng và `fuel < 30`; ngược lại Bóng Mực chọn lại. Bóng `drain` không có mục tiêu thì lấy đèn yếu gần nhất. |
| I8 | Ưu tiên khi thoát `drain` | Mây trong 6 m (`chase`) được xét trước các điều kiện về `wander`. Vùng an toàn đang đẩy thì không đổi trạng thái cho tới khi đẩy xong. |
| I9 | `successful_lights` | Cộng 1 mỗi lần thắp thành công (cả thắp lại), không cộng khi châm dầu hay khi đèn đặt sẵn bằng scenario. |
| I10 | +15 khi trúng tỏa sáng lúc drain | Tính theo trạng thái ngay trước khi bị choáng. |
| I11 | Đèn đầy dầu "không được chọn" | Vì đèn hao 1 đơn vị mỗi tick trước bước tương tác, đèn chỉ đầy ở bước 5 khi vừa được châm hoặc đặt sẵn đúng 100.0167. Quy tắc vẫn được cài và có test trực tiếp. |
| I12 | Điểm bình minh | `50 + floor(fuel)` mỗi đèn đang sáng ở tick cuối (sau khi hao ở tick đó), `+50` mỗi lửa. Thua thì không có điểm bình minh. |
| I13 | `tuning.score` | `per_mote 5`, `per_lantern 100`, `per_stun 5`, `per_second_left 0`, `per_flame_left 50`. Các hằng thưởng còn lại (+40 thắp lại, +10 thêm khi drain, +50 mỗi đèn) nằm trong `WORLD`. |
| I14 | Bản web | Bảng màu dễ phân biệt lưu ở `localStorage` (`ddl.settings`), đường tắt kiểm thử `/?cb=1` và `/?night=1&demo=1`. |

## Tiêu chí nghiệm thu mới

| ID | Tiêu chí |
|---|---|
| T1 | Đèn sáng hao 1 fuel/giây; `lit:true` không `fuel` thì 100; đèn tắt `fuel 0`. Hết dầu: `lantern_out`, `deposited 0`, nhớ `ever_lit`. |
| T2 | Châm dầu: `used = min(mang, ceil((100 - fuel)/10))`, +10 fuel mỗi đom đóm, +5 điểm mỗi đom đóm, sự kiện `refuel`. Đèn đầy dầu không được chọn. |
| T3 | Thắp lại chỉ cần 5 đom đóm (+40, `relight:true`, `relit_count`); đèn chưa từng sáng vẫn cần 10 (+100). |
| T4 | Đèn `fuel < 30` mất vùng an toàn, đúng 30 còn. |
| T5 | Bóng Mực `wander` đi tới đèn yếu gần nhất, ≤ 2 m thì `drain` đứng yên và hút 5/giây (cộng dồn), `fuel_drain` mỗi 60 tick. |
| T6 | Thoát `drain` đúng 4 đường: Mây trong 6 m → `chase`; tỏa sáng → `stunned` (+15); đèn tắt / `fuel ≥ 30` / cách > 2 m → `wander`. Hết choáng về `wander`. |
| T7 | Châm dầu lên ≥ 30 lúc có Bóng Mực trong 6 m: bị đẩy ra mép, không sát thương. |
| T8 | Không thắng sớm. Thắng ở bình minh nếu còn đủ `ceil(0.6 × tổng)` đèn sáng (3/5, 4/6, 5/7), `dawn_survived`; hết lửa luôn thua `no_flames` trước. Thời gian 240/270/300 s. |
| T9 | Sức chứa `min(20, 10 + 2 × successful_lights)`. |
| T10 | Điểm: nạp/châm +5, thắp +100, thắp lại +40, tỏa sáng +5 (+15 nếu drain), bình minh +50 + floor(fuel) mỗi đèn và +50 mỗi lửa, không thưởng thời gian. |
| T11 | Contract v1.2: `contract_version`, tuning thêm khóa, snapshot (`fuel`, `ever_lit`, `relit_count`, `capacity`, `drain`), scenario (`fuel`, `ever_lit`, `successful_lights`, `target_lantern_id`), sự kiện (`refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`). |
| T12 | Bản web: thanh dầu, đèn nhấp nháy 1 Hz khi `fuel < 30`, đèn tắt xẹp 20% có vết rách, HUD mang/sức chứa và số đèn cần giữ, chế độ dễ phân biệt (#00B3FF, trắng + ⚠). |
