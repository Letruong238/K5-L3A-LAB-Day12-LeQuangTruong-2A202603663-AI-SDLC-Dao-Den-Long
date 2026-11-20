---
name: verify-headless
description: Chạy kiểm chứng headless của Đảo Đèn Lồng và lưu bằng chứng vào docs/proof/. Dùng sau khi sửa src/core, trước khi báo xong một yêu cầu, hoặc trước khi gắn tag phase-N.
---

# Kiểm chứng headless và lưu bằng chứng

Mục đích: "agent bảo chạy rồi" không phải bằng chứng. Skill này ép chạy lệnh thật và lưu output.

## Các bước
1. Chạy test: `npm test`. Phải xanh hết, nếu đỏ thì sửa trước, không báo xong.
2. Chạy bằng chứng: `npm run proof`. Script chạy lệnh headless thật (`node src/headless/cli.js ...`) với các kịch bản P1 đến P10, kiểm tra kết quả, ghi `docs/proof/phase1/*.jsonl` và `RESULTS.md`. Thoát mã khác 0 nếu có kịch bản không đạt.
3. Đọc `docs/proof/<phase>/RESULTS.md`: mọi dòng phải là ĐẠT. Kịch bản không đạt thì ghi "chưa đạt" kèm lý do, tuyệt đối không sửa tay output hay nới điều kiện kiểm tra cho khớp.
4. Chạy thủ công một ca để tự nhìn output:
   `node src/headless/cli.js --seed 1 --night 1 --ticks 120 --out %TEMP%/t.jsonl` (kiểm tra dòng đầu là snapshot tick 0, dòng cuối là `end`).

## Quy tắc
- Phase mới đổi luật: thêm kịch bản mới vào `scripts/proof.mjs`, sửa hoặc bỏ test cũ KÈM lý do trong `docs/notes/`.
- Bằng chứng phải sinh từ đúng mã sắp gắn tag: commit mã trước, chạy `npm run proof`, rồi commit bằng chứng, rồi mới tag.
- Việc đánh giá kết quả nên do agent hoặc người khác người viết code (xem subagent reviewer).
