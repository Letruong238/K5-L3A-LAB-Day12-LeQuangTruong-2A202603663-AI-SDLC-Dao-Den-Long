# Dự án Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D qua 4 phase. Yêu cầu từng phase ở lab board; bám đúng yêu cầu, không bịa thêm. Hiện ở Phase 2 (Contract v1.1).

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (http://localhost:5173, `?night=2` mở thẳng đêm 2)
- Test: `npm test` · Bằng chứng: `npm run proof` (skill `verify-headless`)
- Headless: `node src/headless/cli.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Cấu trúc
- `src/core/`: luật chơi thuần JS, KHÔNG dùng API Node/trình duyệt/đồ họa.
  `tuning.js` số liệu chuẩn · `maps.js` bản đồ 3 đêm + hàm độ cao `heightAt` · `game.js` một tick theo đúng 12 bước của ticket · `validate.js` định dạng file.
- `src/headless/cli.js`: lệnh headless (mã thoát 2 = file sai định dạng).
- `web/` + `server.js`: bản 3D (Three.js), chỉ vẽ/đọc phím/HUD/âm thanh, KHÔNG chứa luật chơi.
- `game.contract.json` PHẢI khớp `src/core/tuning.js` (có test).
- `docs/notes/`: spec, giả định, nhật ký mỗi phase. `docs/proof/`: bằng chứng.

## Quy ước (đã rút ra từ lỗi của AI, xem docs/notes/phase2-log.md)
- Đổi số trong `tuning.js` thì đổi luôn `game.contract.json` rồi chạy `npm test`.
- Thứ tự xử lý trong một tick là BẮT BUỘC (ticket): pause, bộ đếm, di chuyển, nhặt, nạp đèn, vùng an toàn, tỏa sáng, di chuyển kẻ địch, chạm, sinh, thắng/thua. Không đổi thứ tự khi sửa.
- Mọi thời gian trong lõi tính bằng tick (60/giây), làm tròn bằng `Math.round(giây * 60)`.
- Khi test đỏ: đọc lý do, xác định test sai hay code sai TRƯỚC khi sửa; không nới điều kiện cho khớp. Test cũ bị luật mới thay thì sửa kèm lý do trong `docs/notes/phase2-spec.md`.
- Không bao giờ để test luôn đúng (so một giá trị với chính nó).
- Phần sáng tạo chỉ ở `web/`, không được làm đổi đầu ra headless.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, API key. Không force push sau khi gắn tag.
- Không xóa file harness (CLAUDE.md, skills, hooks). Asset ngoài chỉ CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
- Hook Stop chạy `npm test`; test đỏ thì không được kết thúc.
