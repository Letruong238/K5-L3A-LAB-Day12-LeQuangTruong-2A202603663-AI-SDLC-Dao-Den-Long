# Dự án Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D qua 4 phase. Yêu cầu từng phase ở lab board; bám đúng yêu cầu, không bịa thêm.

## Lệnh
- Cài: `npm install` · Chơi: `npm start` (mở http://localhost:5173)
- Test: `npm test` · Bằng chứng: `npm run proof` (skill `verify-headless`)
- Headless: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`

## Cấu trúc
- `src/core/`: luật chơi thuần JS, KHÔNG dùng API Node/trình duyệt/đồ họa. Tuning ở `tuning.js`.
- `src/headless/cli.js`: lệnh headless theo Test Contract v1.0 (mã thoát 2 = file sai định dạng).
- `web/` + `server.js`: bản 3D (Three.js), chỉ vẽ và đọc phím, không chứa luật chơi.
- `game.contract.json` PHẢI khớp `src/core/tuning.js` (có test).
- `docs/notes/`: giả định và nhật ký mỗi phase. `docs/proof/`: bằng chứng.

## Quy ước
- Đổi số trong `tuning.js` thì đổi luôn `game.contract.json` rồi chạy `npm test`.
- Phần sáng tạo chỉ ở `web/`, không được làm đổi đầu ra headless.
- Test cũ bị yêu cầu mới làm sai: sửa hoặc bỏ kèm lý do, không tắt âm thầm.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, API key. Không force push sau khi gắn tag.
- Không xóa file harness (CLAUDE.md, skills, hooks). Asset ngoài chỉ CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
- Hook Stop chạy `npm test`; test đỏ thì không được kết thúc.
