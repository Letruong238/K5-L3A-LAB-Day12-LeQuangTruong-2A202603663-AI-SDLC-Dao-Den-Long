# Dự án Đảo Đèn Lồng (Day 12 AI SDLC)

Game 3D qua 4 phase. Yêu cầu từng phase ở lab board; bám đúng yêu cầu, không bịa thêm.

## Lệnh
- Test: `npm test`
- Thử môi trường: `npm run hello`

## Quy ước
- Node.js (ESM), logic game ở `src/core/` KHÔNG phụ thuộc đồ họa để chạy headless.
- Phần hiển thị (Three.js) tách riêng, không được làm đổi đầu ra headless.
- Giả định mỗi phase ghi ở `docs/notes/`; bằng chứng ở `docs/proof/` (phải thật, khớp tag).
- Test cũ bị yêu cầu mới làm sai: sửa hoặc bỏ kèm lý do, không tắt âm thầm.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, API key.
- Không xóa file harness (CLAUDE.md, skills, hooks) và không force push sau khi gắn tag.
- Asset ngoài chỉ dùng CC0/CC-BY/MIT, ghi vào `CREDITS.md`.
