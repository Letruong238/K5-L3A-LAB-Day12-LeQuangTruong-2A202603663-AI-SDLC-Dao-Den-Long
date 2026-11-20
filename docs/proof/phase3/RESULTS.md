# Bằng chứng Phase 3 (tự sinh bởi `npm run proof`)

- Mã nguồn: commit `c429694`
- Máy: win32 x64, Node v24.14.0
- Test đơn vị và scenario: 123/123 đạt, 0 lỗi (`npm test`)

Mỗi dòng dưới đây chạy lệnh headless thật (`node src/headless/cli.js ...`), rồi kiểm tra output theo tiêu chí T1 đến T11 trong `docs/notes/phase3-spec.md`.

| Kịch bản | Tiêu chí | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
| W01-fuel-decay | T1 | Đèn sáng hao 1 fuel/giây: 600 tick từ 100 còn 90.0; đèn tắt fuel 0 | `docs/proof/phase3/W01-fuel-decay.jsonl` | ĐẠT |
| W02-lantern-out | T1 | Hết dầu (fuel 0.5) ở tick 30: lantern_out, deposited 0, ever_lit true | `docs/proof/phase3/W02-lantern-out.jsonl` | ĐẠT |
| W03-refuel | T2 | Châm dầu fuel 40 mang 10: dùng 7 đom đóm, fuel 100, +35 điểm, sự kiện refuel | `docs/proof/phase3/W03-refuel.jsonl` | ĐẠT |
| W04-relight | T3 | Thắp lại đèn đã từng sáng: 5 đom đóm, +40, lantern_lit relight:true, relit_count 1 | `docs/proof/phase3/W04-relight.jsonl` | ĐẠT |
| W05-first-light | T3, T8 | Thắp lần đầu 10 đom đóm: +100, fuel 100; thắp đủ 5/5 đèn không kết thúc đêm | `docs/proof/phase3/W05-first-light.jsonl` | ĐẠT |
| W06-drain | T5, T6 | Bóng Mực wander tới đèn yếu (fuel 20), drain đứng yên hút 6 fuel/giây, fuel_drain mỗi 60 tick, đèn tắt rồi bóng rời drain | `docs/proof/phase3/W06-drain.jsonl` | ĐẠT |
| W07-safe-zone-threshold | T4 | Đèn fuel 100: Bóng Mực không vào 6 m. Đèn fuel 20 (mất vùng an toàn): Bóng Mực vào tới ≤ 2 m để hút | `docs/proof/phase3/W07-safe-zone-threshold.jsonl` | ĐẠT |
| W08-refuel-push | T7 | Châm dầu lên ≥ 30 lúc Bóng Mực drain trong 6 m: bị đẩy ra mép, không sát thương | `docs/proof/phase3/W08-refuel-push.jsonl` | ĐẠT |
| W09-dawn-win | T8, T10 | Bình minh với 3/5 đèn sáng: thắng dawn_survived, điểm 3 x (50 + 99) + 3 x 50 = 597 | `docs/proof/phase3/W09-dawn-win.jsonl` | ĐẠT |
| W10-dawn-lose | T8 | Bình minh chỉ còn 2/5 đèn sáng (cần 3): thua dawn, không có điểm bình minh | `docs/proof/phase3/W10-dawn-lose.jsonl` | ĐẠT |
| W11-no-early-win | T8 | Cả 5 đèn sáng từ đầu nhưng đêm không kết thúc sớm, tới tick 300 mới thắng: 5 x (50 + 95) + 150 = 875 | `docs/proof/phase3/W11-no-early-win.jsonl` | ĐẠT |
| W12-no-flames-dawn | T8 | Hết lửa đúng tick bình minh dù đủ đèn: luôn thua no_flames | `docs/proof/phase3/W12-no-flames-dawn.jsonl` | ĐẠT |
| W13-capacity | T9 | successful_lights 3 thì sức chứa 16; thắp một đèn tăng thêm 2 | `docs/proof/phase3/W13-capacity.jsonl` | ĐẠT |
| W14-pulse-drain | T6, T10 | Tỏa sáng trúng Bóng Mực đang drain: stunned và +15 điểm (thường là +5) | `docs/proof/phase3/W14-pulse-drain.jsonl` | ĐẠT |
| W15-threshold-night2 | T8 | Đêm 2 cần 4/6 đèn: 4 đèn sáng thì thắng | `docs/proof/phase3/W15-threshold-night2.jsonl` | ĐẠT |
| W16-threshold-night3 | T8 | Đêm 3 cần 5/7 đèn: 4 đèn sáng thì thua dawn | `docs/proof/phase3/W16-threshold-night3.jsonl` | ĐẠT |
| W17-full-night1 | T11 | Đêm 1 đầy đủ (ngẫu nhiên bật, seed 42, 14400 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase3/W17-full-night1.jsonl` | ĐẠT (0.14 s, tất định: 2 lần giống hệt (sha256 28c8e34b708a)) |
| W17-full-night2 | T11 | Đêm 2 đầy đủ (ngẫu nhiên bật, seed 42, 16200 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase3/W17-full-night2.jsonl` | ĐẠT (0.18 s, tất định: 2 lần giống hệt (sha256 310df9d35728)) |
| W17-full-night3 | T11 | Đêm 3 đầy đủ (ngẫu nhiên bật, seed 42, 18000 tick): chạy ≤ 30 s, tất định (2 lần giống hệt) | `docs/proof/phase3/W17-full-night3.jsonl` | ĐẠT (0.26 s, tất định: 2 lần giống hệt (sha256 5daf5d152602)) |
| W18-bad-inputs | T11 | inputs có tick trùng thì thoát mã 2, báo lỗi ra stderr | (không có file) | ĐẠT (mã 2) |

Bản web (T12): ảnh chụp trong thư mục này (`web-demo-*.png`) do Chrome chạy ngầm chụp từ bản `npm start` (đường tắt `/?night=1&demo=1`, thêm `&cb=1` cho bảng màu dễ phân biệt). Chưa kiểm chứng: chơi tay đủ 3 đêm với luật mới, âm thanh nghe thật, nhấp nháy 1 Hz tận mắt, và ≥ 30 FPS trên máy thật (xem README, phần "Giới hạn").
