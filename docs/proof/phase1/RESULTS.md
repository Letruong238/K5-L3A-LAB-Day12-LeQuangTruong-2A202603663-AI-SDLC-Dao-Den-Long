# Bằng chứng Phase 1 (tự sinh bởi `npm run proof`)

- Mã nguồn: commit `2c527de`
- Máy: win32 x64, Node v24.14.0
- Test đơn vị và scenario: 38/38 đạt, 0 lỗi (`npm test`)

Mỗi dòng dưới đây chạy lệnh headless thật (`node src/headless/cli.js ...`), rồi kiểm tra output theo yêu cầu (R1 đến R12 trong `docs/notes/phase1-assumptions.md`).

| Kịch bản | Yêu cầu | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
| P1-move | R1, R2 | Đi thẳng 60 tick đến z=6; end.ticks=60 | `docs\proof\phase1\P1-move.jsonl` | ĐẠT |
| P2-pickup | R3 | Đi tới đom đóm thì ra mote_picked, điểm +10 | `docs\proof\phase1\P2-pickup.jsonl` | ĐẠT |
| P3-deposit-win | R4, R8 | Nạp 5 đom đóm vào L1 (4 đèn còn lại sáng sẵn) thì lantern_lit và thắng all_lit | `docs\proof\phase1\P3-deposit-win.jsonl` | ĐẠT |
| P4-hit | R5 | Bóng Mực chạm: mất lửa, rơi đom đóm, bất tử 90 tick rồi chạm lại | `docs\proof\phase1\P4-hit.jsonl` | ĐẠT |
| P5-pulse | R6 | Tỏa sáng: choáng và đẩy S1, tốn 2 đom đóm | `docs\proof\phase1\P5-pulse.jsonl` | ĐẠT |
| P6-safe-zone | R7 | Bóng Mực đuổi người đứng cạnh đèn 1200 tick, không bao giờ vào trong 5 m quanh đèn | `docs\proof\phase1\P6-safe-zone.jsonl` | ĐẠT |
| P7-no-flames | R8 | Hết lửa thì thua no_flames | `docs\proof\phase1\P7-no-flames.jsonl` | ĐẠT |
| P8-dawn | R8 | Hết giờ (time_left_s=1) thì thua dawn ở tick 60 | `docs\proof\phase1\P8-dawn.jsonl` | ĐẠT |
| P9-full-random | R10 | Màn đầy đủ (ngẫu nhiên bật) seed 42, 5000 tick, có đi và tỏa sáng | `docs\proof\phase1\P9-full-random.jsonl` | ĐẠT (tất định: 2 lần chạy giống hệt (sha256 91669ea01ef3)) |
| P10-bad-inputs | R11 | inputs có tick trùng thì thoát mã 2 và báo lỗi ra stderr | (không có file) | ĐẠT (mã 2) |

Chưa kiểm chứng tự động: R13 (bản 3D chơi được, HUD, chơi lại). Xem mục "Giới hạn" trong README.
