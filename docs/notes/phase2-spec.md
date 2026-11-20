# Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1): spec, giả định, tiêu chí nghiệm thu

Nguồn: Ticket-02 trên lab board. Số liệu chuẩn của ticket THAY mọi số tự chọn ở Phase 1.

## Luật Phase 1 bị ticket thay thế (test cũ phải đổi, kèm lý do)

| Luật Phase 1 | Luật Phase 2 | Test bị ảnh hưởng |
|---|---|---|
| Chi phí đèn 5, tỏa sáng 2 đom đóm / 6 m / 3 s choáng / hồi 2 s | 10 / 3 đom đóm / 5 m / 2 s choáng (120 tick) / hồi 3 s | R3 đến R8 |
| Điểm +10 khi NHẶT đom đóm | +10 khi NẠP đom đóm | R3, R4 |
| Điểm +20 mỗi lần choáng, thưởng 1/giây | +5, thưởng 2/giây | R6, R8 |
| Vùng an toàn quanh MỌI đèn, 5 m | Chỉ quanh đèn ĐÃ SÁNG, 6 m | R7 |
| Đi quá mép đảo thì bị chặn (G3) | Rơi khỏi đảo: mất lửa, mất đom đóm, hồi sinh | R2 |
| Chạy đạt tốc độ ngay | Tăng tốc, dừng trong 5 tick | R2 |
| Bóng Mực đuổi từ xa vô hạn | Phát hiện 12 m, bỏ đuổi 18 m, có trạng thái spawning/wander/chase/recoil/stunned | R5, R6 |
| Bất tử 1.5 s, rơi `floor(carried*0.5)` | Giống, nhưng đom đóm rơi hết hạn sau 480 tick, Bóng Mực lùi 2 m (recoil) | R5 |
| Sinh ngẫu nhiên tự do (G14) | Điểm sinh và lịch sinh cố định theo bản đồ chuẩn | R10 |

## Giả định mới (ticket chưa nói rõ)

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| H1 | Gia tốc chạy | Đạt tốc độ tối đa sau 5 tick (≈0.083 s), dừng cũng 5 tick. Trên không điều khiển đầy đủ như dưới đất. |
| H2 | Công thức góc | `x = cx + r·cos θ`, `z = cz + r·sin θ` (khớp tọa độ đèn của ticket: L2 = góc 18°, L1 = 90°). |
| H3 | Điểm xuất phát | Đêm 1 và 2: (0,0,0). Đêm 3: (0,0,-30) vì (0,0,0) nằm trong tháp chuông. Hướng ban đầu +Z. |
| H4 | Địa hình | Một hàm độ cao `heightAt(x,z)`: trả `null` nếu là hư không (rơi), `Infinity` nếu là vật cản đặc (tháp). Bước lên cao hơn 0.5 m là chạm vách. Xuống thấp hơn 0.5 m thì rời đất và rơi. |
| H5 | Lướt | 12 tick, đóng băng vận tốc dọc (giữ nguyên độ cao, không trọng lực), rồi tiếp tục. Hướng = hướng đang đi, đứng yên thì hướng đang quay mặt. Hồi chiêu tính từ lúc bắt đầu lướt. Có Bùa: bỏ hồi chiêu nhưng không lướt chồng nhau. |
| H6 | Bục nhảy | Kích hoạt khi chân Mây chạm bục (XZ ≤ 1, chênh cao ≤ 0.5) và đang đứng đất. Vận tốc ngang cố định tới khi chạm đất, phím di chuyển không ghi đè. |
| H7 | Nhặt/đèn/chạm: chênh cao | Đo giữa chân Mây và mặt đất của đối tượng (đom đóm, đèn, bùa, `pos.y - 1` của Bóng Mực). Ngưỡng 1.5 m. |
| H8 | Bóng Mực | `spawning` kéo dài 30 tick (không gây sát thương). `wander` đi 2 m/s theo hướng ngẫu nhiên (đổi mỗi 120 tick). Sau choáng/recoil: thành `chase` nếu cách ≤ 18 m, ngược lại `wander`. Bóng Mực không có tìm đường, chỉ đi thẳng và trượt dọc vật cản. |
| H9 | Vật cản với Bóng Mực | Mép vùng an toàn của đèn sáng, tháp, vách, hư không. Đẩy lùi (choáng, recoil) dừng khi gặp vật cản. |
| H10 | Vùng an toàn | Hình trụ theo mặt phẳng XZ (không xét tầng). Bóng Mực ở trong lúc đèn vừa thắp bị đẩy ra mép 0.2 m/tick, tối đa 30 tick, không gây sát thương. |
| H11 | Điểm sinh | Chọn ngẫu nhiên có seed trong các điểm hợp lệ. 20 đom đóm đầu: 20 trong số các điểm của đêm (Đêm 1: 24, Đêm 2: 24, Đêm 3: 30). Hợp lệ với Bóng Mực: cách Mây ≥ 15 m, ngoài vùng đèn sáng, cách Bóng Mực khác ≥ 1 m. |
| H12 | Trần 30 đom đóm | Tính cả đom đóm rơi. |
| H13 | Gió Lạc | Điểm sinh: ngẫu nhiên trong các điểm sinh Bóng Mực của đêm. Bay ở độ cao mặt đất + 1.5. Chạm chỉ xét XZ ≤ 1.2. Sau khi bị tỏa sáng thả đồ thì bay tiếp tối đa 120 tick rồi biến mất. |
| H14 | Gió mạnh | Cơn gió bắt đầu tại sim_tick = 1800k (k ≥ 1), kéo dài 300 tick. Hướng chọn ngẫu nhiên có seed lúc báo trước (120 tick trước). Snapshot `wind.dir_deg` là hướng của cơn gió đang thổi, 0 khi không thổi. Hướng `dir_deg` đo từ +X ngược chiều kim đồng hồ (x = cos, z = sin). |
| H15 | Tạm dừng | Bấm `pause` (cạnh lên): `paused`, dừng bước ngay. Bấm lần nữa: `resumed` rồi mô phỏng bình thường ngay tick đó. Khi dừng các nút khác bị bỏ qua và không tạo cạnh lên khi tiếp tục. `end.state` khi đang dừng là `playing`. |
| H16 | `night_start` | Ghi ngay sau snapshot tick 0, `tick: 0`. |
| H17 | Đơn vị snapshot | `invuln` tính bằng tick, còn lại (`dash_cd_s`, `pulse_cd_s`, `charm_s`, `ttl_s`, `respawn_s`) tính bằng giây. `ttl_s` của đom đóm ngẫu nhiên là `null`. |
| H18 | Điểm | +10 mỗi đom đóm nạp (không phải nhặt). Điểm của game là điểm của đêm đang chạy ở headless. |
| H19 | Sáng tạo | Chỉ ở bản web, không ảnh hưởng headless. |

## Tiêu chí nghiệm thu mới (làm A thì thấy B)

| ID | Tiêu chí |
|---|---|
| S1 | Chạy tăng tốc: tick 1 chưa đạt 6 m/s, tick 5 đạt đúng 6 m/s. Nhảy đạt đỉnh ≈ 1.2 m rồi chạm đất. Chỉ nhảy khi đang đứng đất. |
| S2 | Lướt: 12 tick ở 14 m/s, hồi 90 tick tính từ lúc bắt đầu, lướt trên không giữ nguyên độ cao, sự kiện `dash`. |
| S3 | Rơi khỏi đảo (Y < -10): đúng 1 `player_hit by fall` với `lost`, mất 1 lửa, mất hết đom đóm; chờ 60 tick rồi hồi sinh ở điểm xuất phát, bất tử 90 tick. Hết lửa thì thua ngay. |
| S4 | Bóng Mực: spawning → wander → chase theo 12/18 m. Chạm: mất 1 lửa, rơi `floor(carried/2)` đom đóm hết hạn sau 480 tick, recoil 2 m trong 60 tick, bất tử 90 tick. |
| S5 | Tỏa sáng: 3 đom đóm, 5 m (3D từ chân + 0.8), choáng 120 tick, đẩy 4 m trong 15 tick, hồi 180 tick, +5 điểm mỗi con. |
| S6 | Vùng an toàn 6 m chỉ cho đèn đã sáng, Bóng Mực bị chặn ở mép; Bóng ở trong lúc thắp bị đẩy ra, không gây sát thương. |
| S7 | Điểm: +10 mỗi đom đóm nạp, +100 mỗi đèn, thắng +2/giây còn lại +50/lửa. Thua vì hết lửa luôn ưu tiên hơn thắng. |
| S8 | Lịch sinh: đom đóm (20 đầu, trần 30, +1 mỗi 240 tick), Bóng Mực (2 con ở tick 300, rồi mỗi 480/420/360 tick, tối đa 6/8/10), Gió Lạc (tick 1200k, tối đa 2). `random_*:false` thì không sinh. |
| S9 | Đêm 2: cầu tre đi được, bước ra ngoài thì rơi, bục nhảy đưa Mây sang đảo kia. Đêm 3: vách chặn, dốc đi lên tầng 1, bục nhảy đáp tầng 2, tháp chuông chặn. |
| S10 | Gió Lạc: idle → chase khi mang ≥ 5 và cách ≤ 15 m, chạm cướp min(3, mang) rồi flee 240 tick; tỏa sáng khi chase thì flee không cướp; tỏa sáng khi flee thì thả đồ (`drifter_drop`). |
| S11 | Bùa Gió: nhặt cho 600 tick (chạy 7.2 m/s, lướt không hồi chiêu), hồi lại sau 2700 tick, `charm_picked`. |
| S12 | Gió mạnh (Đêm 3): đẩy 2 m/s trong 300 tick mỗi 1800 tick, `wind.active`. |
| S13 | Tạm dừng: tick tăng nhưng `sim_tick`, thời gian, hồi chiêu, sinh, TTL đứng yên; `paused`/`resumed`. |
| S14 | Contract v1.1: `contract_version "1.1"`, tuning khớp, snapshot/scenario/input/sự kiện mới, `--night 1|2|3`, một đêm đầy đủ (21600 tick) chạy ≤ 30 giây. |
| S15 | Bản web: 3 đêm, menu, giới thiệu, tạm dừng, cài đặt lưu lại, HUD, âm thanh, ≥ 30 FPS (xem README, phần "Giới hạn"). |
