# Bằng chứng Phase 2 (tự sinh bởi `npm run proof`)

- Mã nguồn: commit `80dcd07`
- Máy: win32 x64, Node v24.14.0
- Test đơn vị và scenario: 93/93 đạt, 0 lỗi (`npm test`)

Mỗi dòng dưới đây chạy lệnh headless thật (`node src/headless/cli.js ...`), rồi kiểm tra output theo tiêu chí S1 đến S14 trong `docs/notes/phase2-spec.md`.

| Kịch bản | Tiêu chí | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
| Q01-accel | S1 | Chạy 60 tick đi 5.8 m (gia tốc 5 tick); tick 5 đạt 6 m/s | `docs/proof/phase2/Q01-accel.jsonl` | ĐẠT |
| Q02-dash | S2 | Lướt 12 tick ở 14 m/s (2.8 m), event dash; bấm lại trước 90 tick bị từ chối | `docs/proof/phase2/Q02-dash.jsonl` | ĐẠT |
| Q03-fall | S3 | Rơi khỏi đảo: 1 player_hit by fall (lost 5), hồi sinh sau 60 tick về (0,0,0) bất tử 90 | `docs/proof/phase2/Q03-fall.jsonl` | ĐẠT |
| Q04-shade-hit | S4 | Bóng Mực chạm: -1 lửa, rơi floor(7/2)=3 đom đóm (TTL 8 s), recoil 2 m, bất tử, chạm lại ở tick 91 | `docs/proof/phase2/Q04-shade-hit.jsonl` | ĐẠT |
| Q05-pulse | S5 | Tỏa sáng 3 đom đóm/5 m: choáng 120 tick, đẩy 4 m trong 15 tick, +5 điểm | `docs/proof/phase2/Q05-pulse.jsonl` | ĐẠT |
| Q06-safe-zone | S6 | Đèn đã sáng: Bóng Mực không vào trong 6 m trong 1200 tick, Mây đứng cạnh đèn không mất lửa | `docs/proof/phase2/Q06-safe-zone.jsonl` | ĐẠT |
| Q07-score-win | S7 | Nạp 10 đom đóm thắp đèn cuối: điểm 100 + 100 + 299x2 + 50x3 = 948 | `docs/proof/phase2/Q07-score-win.jsonl` | ĐẠT |
| Q08-bridge-charm | S9, S11 | Đêm 2: đi qua cầu tre sang đảo B, nhặt Bùa Gió giữa cầu, không rơi | `docs/proof/phase2/Q08-bridge-charm.jsonl` | ĐẠT |
| Q09-pad-night2 | S9 | Đêm 2: bục nhảy bắn Mây sang đảo B, đáp ở (51.24, 6.76) tại tick 84 | `docs/proof/phase2/Q09-pad-night2.jsonl` | ĐẠT |
| Q10-ramp-night3 | S9 | Đêm 3: đi dốc 30° lên tầng 1, cuối cùng đứng ở Y=3 | `docs/proof/phase2/Q10-ramp-night3.jsonl` | ĐẠT |
| Q11-pad-night3 | S9 | Đêm 3: bục nhảy đáp lên tầng 2 (Y=6) | `docs/proof/phase2/Q11-pad-night3.jsonl` | ĐẠT |
| Q12-drifter-steal | S10 | Gió Lạc: idle → chase, cướp min(3,6)=3, flee 240 tick rồi biến mất | `docs/proof/phase2/Q12-drifter-steal.jsonl` | ĐẠT |
| Q13-drifter-drop | S10 | Tỏa sáng trúng Gió Lạc đang flee có đồ: drifter_drop 3, thả 3 đom đóm, biến mất sau 120 tick | `docs/proof/phase2/Q13-drifter-drop.jsonl` | ĐẠT |
| Q14-charm-dash | S11 | Có bùa: lướt không hồi chiêu, bấm khi đang lướt bị bỏ qua (event ở tick 1 và 15) | `docs/proof/phase2/Q14-charm-dash.jsonl` | ĐẠT |
| Q15-wind | S12 | Đêm 3: gió thổi tick 1800 đến 2099, đẩy Mây đúng 10 m theo dir_deg | `docs/proof/phase2/Q15-wind.jsonl` | ĐẠT |
| Q16-pause | S13 | Tạm dừng tick 11 đến 50: sim_tick đứng yên, state paused; tiếp tục ở tick 51 | `docs/proof/phase2/Q16-pause.jsonl` | ĐẠT |
| Q17-full-night1 | S14, S8 | Đêm 1 đầy đủ (ngẫu nhiên bật, seed 42, 18000 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase2/Q17-full-night1.jsonl` | ĐẠT (0.11 s, tất định: 2 lần giống hệt (sha256 064c45ae43cc)) |
| Q17-full-night2 | S14, S8 | Đêm 2 đầy đủ (ngẫu nhiên bật, seed 42, 19800 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase2/Q17-full-night2.jsonl` | ĐẠT (0.12 s, tất định: 2 lần giống hệt (sha256 3219a6482b10)) |
| Q17-full-night3 | S14, S8 | Đêm 3 đầy đủ (ngẫu nhiên bật, seed 42, 21600 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase2/Q17-full-night3.jsonl` | ĐẠT (0.17 s, tất định: 2 lần giống hệt (sha256 eda7c227b38d)) |
| Q18-bad-inputs | S14 | inputs có tick trùng thì thoát mã 2, báo lỗi ra stderr | (không có file) | ĐẠT (mã 2) |

Bản web: ảnh chụp trong thư mục này (`web-*.png`) do Chrome chạy ngầm chụp từ bản `npm start` (đường tắt `/?night=N`). Chưa kiểm chứng: S15 phần chơi tay đủ 3 đêm, âm thanh nghe thật, và ≥ 30 FPS trên máy thật (xem README, phần "Giới hạn").
