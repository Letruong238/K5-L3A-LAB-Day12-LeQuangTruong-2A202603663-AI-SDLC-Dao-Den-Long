# Dự án Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D qua 4 phase. Yêu cầu từng phase ở lab board; bám đúng yêu cầu, không bịa thêm. Hiện ở Phase 4 (Contract v1.3, v1.0.0): phát hành, đo hiệu năng, bảng xếp hạng, tiếp cận. Luật chơi và đầu ra headless từ Phase 3 KHÔNG đổi.

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (http://localhost:5173, `?night=2` mở thẳng đêm 2)
- Test: `npm test` · Bằng chứng: `npm run proof` (skill `verify-headless`)
- Headless: `node src/headless/cli.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Đo: `npm run bench` (mở Chrome, ~40 s) · `npm run soak` · Xuất bảng xếp hạng: `npm start -- --export-leaderboard out.json` · Đóng gói: `npm run dist`

## Cấu trúc
- `src/core/`: luật chơi thuần JS, KHÔNG dùng API Node/trình duyệt/đồ họa.
  `tuning.js` số liệu chuẩn · `maps.js` bản đồ 3 đêm + hàm độ cao `heightAt` · `game.js` một tick theo đúng 12 bước của ticket (dầu bị trừ ở cuối bước 2, rồi đèn hết dầu tắt) · `validate.js` định dạng file.
- `src/headless/cli.js`: lệnh headless (mã thoát 2 = file sai định dạng).
- `web/` + `server.js`: bản 3D (Three.js), chỉ vẽ/đọc phím/HUD/âm thanh, KHÔNG chứa luật chơi. `web/keybinds.js` đổi phím (thuần, có test). `server.js` có API bảng xếp hạng (`data/leaderboard.json`, không commit).
- `src/core/bench.js` cảnh + thống kê benchmark, `leaderboard.js`, `soak.js` (đều thuần). `scripts/bench.mjs`, `soak.mjs`, `dist.mjs`, `proof.mjs`.
- `game.contract.json` PHẢI khớp `src/core/tuning.js` (có test).
- `docs/notes/`: spec, giả định, nhật ký mỗi phase. `docs/proof/`: bằng chứng.

## Quy ước (đã rút ra từ lỗi của AI, xem docs/notes/phase2-log.md)
- Đổi số trong `tuning.js` thì đổi luôn `game.contract.json` rồi chạy `npm test`.
- Thứ tự xử lý trong một tick là BẮT BUỘC (ticket): pause, bộ đếm, di chuyển, nhặt, nạp đèn, vùng an toàn, tỏa sáng, di chuyển kẻ địch, chạm, sinh, thắng/thua. Không đổi thứ tự khi sửa.
- Dầu đèn lưu bằng số nguyên `fuelU = fuel × 60` (đơn vị 1/60), chỉ làm tròn khi xuất snapshot. Không dùng số thực để cộng dồn.
- Chỉ đèn sáng có `fuel >= 30` mới có vùng an toàn: luôn dùng `zoneLanterns()`, không tự lọc `lit`.
- Luật đổi (`[THAY THẾ]`): viết ADR + CHANGELOG TRƯỚC khi sửa code; liệt kê test bị ảnh hưởng và sửa kèm lý do, không skip.
- Mọi thời gian trong lõi tính bằng tick (60/giây), làm tròn bằng `Math.round(giây * 60)`.
- Khi test đỏ: đọc lý do, xác định test sai hay code sai TRƯỚC khi sửa; không nới điều kiện cho khớp. Test cũ bị luật mới thay thì sửa kèm lý do trong `docs/notes/phase2-spec.md`.
- Script vá file: mỗi chỗ thay phải khớp đúng 1 lần (assert); lệnh shell nhiều dòng nhiều dấu nháy thì ghi ra file bằng công cụ Write rồi chạy.
- Không bao giờ để test luôn đúng (so một giá trị với chính nó).
- Phần sáng tạo chỉ ở `web/`, không được làm đổi đầu ra headless.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, API key. Không force push sau khi gắn tag.
- Không xóa file harness (CLAUDE.md, skills, hooks). Asset ngoài chỉ CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
- Hook Stop chạy `npm test`; test đỏ thì không được kết thúc.

## Quy ước thêm ở Phase 4 (rút ra từ lỗi, xem docs/notes/phase4-log.md)
- Sửa `src/core` chỉ bằng tham số TÙY CHỌN mặc định tắt (như `bench`); sau đó chạy test headless để chắc đầu ra không đổi.
- Chữ UI luôn dùng `rem` và ≥ 1rem (= 18 px): test A1 quét CSS. Thêm `$("id")` mới trong `main.js` thì phải có `id` đó trong `index.html` (test A2).
- Số đo bộ nhớ tăng: đo `heapUsed` sau khi dọn rác (qua 1000 vòng) để phân biệt rò rỉ thật với khởi động nóng TRƯỚC khi kết luận, và ghi số liệu vào tài liệu.
- KHÔNG tắt tiến trình theo tên (`taskkill /IM chrome.exe` tắt cả Chrome của người dùng). Chỉ tắt theo PID hoặc cổng của chính mình.
- Windows + Git Bash: `curl` với tên tiếng Việt bị hỏng mã chữ (dùng Node `fetch`); `tar` coi `d:/...` là máy từ xa (dùng đường dẫn tương đối); Chrome `--screenshot` cần đường dẫn tuyệt đối và chạy chậm với SwiftShader (~2 phút, chạy ở nền).
