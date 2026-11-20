# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4, đính kèm Release `v1.0.0`)_
> Bài lab Day 12 AI SDLC, cá nhân. Tác giả: Lê Quang Trường (2A202603663). Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md).

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp hòn đảo trong sương đen, gom **đom đóm**, nạp vào **5 Đèn Lồng Lớn** để thắp lại, và né hoặc xua **Bóng Mực**.

Trạng thái: **Phase 1** (Đêm 1 – Đảo Bến).

## Cài đặt và chạy (tối đa 3 lệnh)

Cần Node.js 20 trở lên (đã thử với v24), chạy được trên Windows, macOS, Linux.

```bash
npm install     # cài Three.js
npm start       # chạy server, mở http://localhost:5173 trên trình duyệt
npm test        # chạy toàn bộ test
```

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Space | Nhảy |
| E (hoặc Enter) | Nạp đom đóm vào đèn gần nhất (đứng sát đèn) |
| F | Tỏa sáng, xua Bóng Mực (tốn 2 đom đóm) |
| ← → | Xoay camera |
| R | Chơi lại bất cứ lúc nào |

## Luật chơi và cách tính điểm

- Đi qua đom đóm là tự nhặt (mang tối đa 10). Nạp 5 đom đóm để thắp một đèn (nạp một phần được).
- Bóng Mực đuổi theo Mây. Bị chạm thì **mất 1 ngọn lửa** (có 3), rơi một nửa số đom đóm đang mang, rồi bất tử 1.5 giây.
- **Tỏa sáng** (F): Bóng Mực trong 6 m bị choáng 3 giây và bị đẩy lùi 4 m. Hồi 2 giây.
- Vùng 5 m quanh mỗi đèn là an toàn: Bóng Mực không vào được.
- **Thắng:** thắp đủ 5 đèn. **Thua:** hết 3 ngọn lửa, hoặc hết 300 giây (trời sáng).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Làm choáng 1 Bóng Mực | +20 |
| Khi thắng: mỗi giây còn lại | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Mọi con số cân bằng nằm ở [src/core/tuning.js](src/core/tuning.js) và được khai trong [game.contract.json](game.contract.json) (có test bắt buộc hai nơi khớp nhau). `fall_enabled` là `false` vì đảo không có chỗ rơi: đi tới mép thì bị chặn lại.

## Chế độ headless (Test Contract v1.0)

Chạy logic game không cần cửa sổ, 60 tick/giây, in ra JSONL:

```bash
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl
node src/headless/cli.js --seed 1 --night 1 --scenario s.json --inputs i.json --ticks 600 --snapshot-every 10 --out out.jsonl
```

Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác (lỗi ghi ra stderr). Cùng seed, scenario và inputs luôn cho output giống hệt nhau từng byte.

## Kiểm chứng

- `npm test`: test đơn vị và scenario (nhặt, nạp, chạm, tỏa sáng, vùng an toàn, thắng/thua, tất định, mã thoát, khớp contract).
- `npm run proof`: chạy lệnh headless thật với 10 kịch bản, ghi output và bảng kết quả vào [docs/proof/phase1/RESULTS.md](docs/proof/phase1/RESULTS.md).
- CI (GitHub Actions) chạy cả hai lệnh trên mỗi lần push.
- Giả định và tiêu chí nghiệm thu: [docs/notes/phase1-assumptions.md](docs/notes/phase1-assumptions.md). Nhật ký AI và đánh giá: [docs/notes/phase1-log.md](docs/notes/phase1-log.md).

## Sáng tạo của tôi

- **Biển mây trôi** quanh đảo và **đom đóm lấp lánh** (chỉ có ở bản web, nằm trong `web/main.js`).
- Đèn sáng dần theo số đom đóm đã nạp, đảo sáng lên và sương loãng dần khi thắp thêm đèn.
- Bằng chứng phần cũ không bị ảnh hưởng: phần này không nằm trong `src/core/`, nên đầu ra headless không đổi. `npm test` và `npm run proof` vẫn đạt.

## Giới hạn đã biết

- Bản 3D chỉ được kiểm tra: server chạy, file tải được, cú pháp đúng, và logic dùng chung với headless đã được test. **Chưa có ảnh chụp hay quay màn hình** làm bằng chứng cho đồ họa và HUD, cần chơi thử trên trình duyệt.
- Chưa có âm thanh. Chưa có bản phát hành đóng gói (Phase 4).

## Cấu trúc

```text
src/core/        luật chơi thuần (chạy headless được)
src/headless/    lệnh headless
web/, server.js  bản 3D Three.js
tests/           test đơn vị và scenario
scripts/proof.mjs  sinh bằng chứng
docs/notes, docs/proof  giả định, nhật ký, bằng chứng
CLAUDE.md, .claude/   harness AI (hướng dẫn, hook, skill)
```
