---
name: verify-headless
description: Chạy kiểm chứng headless và bản web của Đảo Đèn Lồng, lưu bằng chứng vào docs/proof/. Dùng sau khi sửa src/core hoặc web/, trước khi báo xong một yêu cầu, và trước khi gắn tag phase-N.
---

# Kiểm chứng headless, bản web và lưu bằng chứng

Mục đích: "agent bảo chạy rồi" không phải bằng chứng. Skill này ép chạy lệnh thật và lưu output.

## Các bước
1. Chạy test: `npm test`. Phải xanh hết. Nếu đỏ, đọc lý do và quyết định test sai hay code sai trước khi sửa (không nới điều kiện cho khớp).
2. Chạy bằng chứng: `npm run proof`. Script chạy lệnh headless thật (`node src/headless/cli.js ...`) cho các kịch bản W01 đến W18 (dầu đèn, thắp lại, hút dầu, luật bình minh, sức chứa, 3 đêm đầy đủ, đo thời gian, kiểm tra tất định), ghi `docs/proof/phase3/*.jsonl` và `RESULTS.md`. Thoát mã khác 0 nếu có kịch bản không đạt.
3. Đọc `RESULTS.md`: mọi dòng phải ĐẠT. Kịch bản không đạt thì ghi "chưa đạt" kèm lý do, không sửa tay output.
4. Kiểm tra bản web khi sửa `web/` (không cần cửa sổ):
   - `node --check web/main.js web/scene.js web/audio.js` (cú pháp).
   - Bật `npm start` ở nền, rồi chụp bằng Chrome chạy ngầm:
     `chrome --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=6000 --screenshot=out.png "http://localhost:5173/?night=1&demo=1"` (thêm `&cb=1` để xem chế độ dễ phân biệt)
   - Mở ảnh xem có hiện đúng HUD/bản đồ không. Nhớ tắt server sau khi xong.
5. Chạy thủ công một ca để tự nhìn output: `node src/headless/cli.js --seed 1 --night 2 --ticks 120 --out out.jsonl` (dòng đầu là snapshot tick 0, tiếp theo là event `night_start`, dòng cuối là `end`).

## Quy tắc
- Luật đổi: viết ADR + CHANGELOG trước, rồi đối chiếu từng test đỏ với ticket để biết "luật cũ bị thay" hay "lỗi code".
- Phase mới đổi luật: thêm kịch bản vào `scripts/proof.mjs`, sửa/bỏ test cũ KÈM lý do trong `docs/notes/`.
- Bằng chứng phải sinh từ đúng mã sắp gắn tag: commit mã trước, chạy `npm run proof`, commit bằng chứng, rồi mới tag.
- Việc đánh giá kết quả nên do agent hoặc người khác người viết code (subagent reviewer).
- Thứ chưa được kiểm chứng thật (chơi tay, FPS, âm thanh) phải ghi "chưa kiểm chứng" trong README, không ghi "đạt".
