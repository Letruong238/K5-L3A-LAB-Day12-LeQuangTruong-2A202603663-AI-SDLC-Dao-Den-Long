# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4, đính kèm Release `v1.0.0`)_
> Bài lab Day 12 AI SDLC, cá nhân. Tác giả: Lê Quang Trường (2A202603663). Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md).

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp các hòn đảo trong sương đen, gom **đom đóm**, nạp vào **Đèn Lồng Lớn** để thắp lại, né hoặc xua **Bóng Mực**, và cảnh giác với **Gió Lạc** hay cướp đom đóm.

Trạng thái: **Phase 2** (Ticket-02 "Ba hòn đảo", Contract v1.1): 3 đêm, số liệu chuẩn, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng, menu, cài đặt, âm thanh.

## Cài đặt và chạy (tối đa 3 lệnh)

Cần Node.js 20 trở lên (đã thử với v24), chạy được trên Windows, macOS, Linux.

```bash
npm install     # cài Three.js
npm start       # chạy server, mở http://localhost:5173 trên trình duyệt
npm test        # chạy toàn bộ test
```

Mở thẳng một đêm (bỏ qua menu): http://localhost:5173/?night=2 · Bấm F3 trong game để hiện FPS.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Space | Nhảy (chỉ khi đang đứng đất) |
| Shift | Lướt 14 m/s trong 0.2 s (hồi 1.5 s) |
| E (hoặc Enter) | Nạp đom đóm vào đèn gần nhất (đứng trong 2 m) |
| F | Tỏa sáng, xua Bóng Mực và Gió Lạc (tốn 3 đom đóm, hồi 3 s) |
| Kéo chuột, hoặc ← → | Xoay camera |
| Esc hoặc P | Tạm dừng |

## Luật chơi

- Mang tối đa 10 đom đóm. Nạp 10 đom đóm để thắp một đèn (nạp nhiều lần được, đèn nhớ tiến độ).
- **Đêm 1 – Đảo Bến:** 5 đèn, 300 s. **Đêm 2 – Đảo Cau:** hai đảo nối cầu tre không lan can, bục nhảy bắn sang đảo kia, 6 đèn, 330 s. **Đêm 3 – Đảo Chuông:** ba tầng, hai dốc, bục nhảy, tháp chuông, gió mạnh 5 s mỗi 30 s, 7 đèn, 360 s.
- Bóng Mực phát hiện Mây ở 12 m, bỏ đuổi ở 18 m. Chạm thì **mất 1 ngọn lửa** (có 3), rơi một nửa số đom đóm đang mang (tồn tại 8 s), bất tử 1.5 s, và Bóng Mực lùi 2 m.
- Đèn **đã sáng** tạo vùng an toàn 6 m: Bóng Mực không vào được.
- **Rơi khỏi đảo**: mất 1 lửa và toàn bộ đom đóm, chờ 1 s rồi hồi sinh ở điểm xuất phát.
- **Gió Lạc** (Đêm 2, 3): khi Mây mang từ 5 đom đóm trở lên và ở gần, nó lao tới cướp 3 đom đóm. Tỏa sáng lúc nó đang tới thì nó bỏ chạy; tỏa sáng lúc nó đang chạy mang đồ thì nó làm rơi lại.
- **Bùa Gió** (đỏ viền vàng): 10 s chạy 7.2 m/s và lướt không cần chờ. Hiện lại sau 45 s.
- **Thắng:** thắp đủ đèn (kể cả đúng tick hết giờ). **Thua:** hết lửa (luôn ưu tiên), hoặc hết giờ.

| Sự kiện | Điểm |
|---|---|
| Nạp 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Tổng điểm game là tổng điểm các đêm đã thắng. Số liệu chuẩn nằm ở [src/core/tuning.js](src/core/tuning.js) và được khai trong [game.contract.json](game.contract.json) (test bắt buộc hai nơi khớp nhau). Bản đồ chuẩn ở [src/core/maps.js](src/core/maps.js).

## Chế độ headless (Test Contract v1.1)

Chạy logic game không cần cửa sổ, 60 tick/giây, in ra JSONL:

```bash
node src/headless/cli.js --seed 1 --night 2 --ticks 600 --out out.jsonl
node src/headless/cli.js --seed 1 --night 3 --scenario s.json --inputs i.json --ticks 600 --snapshot-every 10 --out out.jsonl
```

`--night` nhận 1, 2, 3. Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác (lỗi ghi ra stderr). Cùng seed, scenario và inputs luôn cho output giống hệt nhau từng byte. Một đêm đầy đủ (tối đa 21 600 tick) chạy dưới 1 giây trên máy phát triển.

## Kiểm chứng

- `npm test`: test đơn vị và scenario cho mọi tiêu chí (hồi quy Phase 1 và tính năng mới Phase 2), kiểm tra tất định cả 3 đêm, mã thoát, khớp contract.
- `npm run proof`: chạy lệnh headless thật với 20 kịch bản, ghi output và bảng kết quả vào [docs/proof/phase2/RESULTS.md](docs/proof/phase2/RESULTS.md). Bằng chứng Phase 1 (khớp tag `phase-1`) vẫn ở [docs/proof/phase1/](docs/proof/phase1/RESULTS.md).
- Ảnh chụp bản web: [docs/proof/phase2/](docs/proof/phase2/) (`web-*.png`).
- CI (GitHub Actions) chạy `npm ci`, `npm test`, `npm run proof` mỗi lần push.
- Tài liệu: [spec và giả định Phase 2](docs/notes/phase2-spec.md) · [nhật ký AI và đánh giá](docs/notes/phase2-log.md) · [Phase 1](docs/notes/phase1-assumptions.md).

## Sáng tạo của tôi

- **Biển mây trôi** quanh đảo và **đom đóm lấp lánh** (chỉ ở bản web, trong `web/main.js`).
- Đèn sáng dần theo số đom đóm đã nạp; ánh sáng môi trường và sương đổi theo tiến độ.
- **Ông Đăng** nói một câu mở đầu mỗi đêm (màn giới thiệu).
- Bằng chứng phần cũ không bị ảnh hưởng: các phần này không nằm trong `src/core/`, nên đầu ra headless không đổi. Test và proof vẫn đạt.

## Giới hạn đã biết (nói thật)

- **Chưa chơi tay đủ 3 đêm trên trình duyệt thật.** Đã kiểm tra: server chạy, cả 3 đêm tải và hiện đúng (ảnh chụp bằng Chrome chạy ngầm, không có lỗi JavaScript), logic dùng chung với headless đã được test kỹ. Phần menu → giới thiệu → kết quả → Bình Minh, tạm dừng, cài đặt lưu lại và âm thanh **chỉ mới được viết và kiểm tra cú pháp, chưa có ai bấm thử**.
- **Chưa đo FPS trên máy thật** (yêu cầu ≥ 30 FPS ở 1280×720). Có đồng hồ FPS (phím F3). Ảnh chụp dùng bộ vẽ phần mềm nên không đo FPS được.
- **Chưa có bằng chứng thắng trọn vẹn Đêm 2 và Đêm 3.** Một bot đơn giản thắng 6/10 ván Đêm 1 nhưng không biết đi qua cầu, bục nhảy, dốc nên luôn rơi hoặc thua ở hai đêm sau. Từng thành phần (cầu, bục, dốc, tầng, tháp, gió, bùa, Gió Lạc) đã có test riêng.
- Âm thanh là âm tổng hợp bằng WebAudio, chưa cân chỉnh.
- Một số chỗ ticket chưa nói rõ đã tự giả định và ghi ở [phase2-spec.md](docs/notes/phase2-spec.md) (mục H1 đến H19).

## Cấu trúc

```text
src/core/        luật chơi thuần (chạy headless được): game, bản đồ, số liệu chuẩn, kiểm tra định dạng
src/headless/    lệnh headless
web/, server.js  bản 3D Three.js (cảnh, âm thanh, HUD, menu)
tests/           test đơn vị và scenario
scripts/proof.mjs  sinh bằng chứng
docs/notes, docs/proof  giả định, nhật ký, bằng chứng
CLAUDE.md, .claude/   harness AI (hướng dẫn, hook, skill)
```
