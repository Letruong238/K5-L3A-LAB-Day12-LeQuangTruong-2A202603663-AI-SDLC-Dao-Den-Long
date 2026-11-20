# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4, đính kèm Release `v1.0.0`)_
> Bài lab Day 12 AI SDLC, cá nhân. Tác giả: Lê Quang Trường (2A202603663). Đề bài gốc của lab: [docs/LAB-README.md](docs/LAB-README.md).

Game 3D góc nhìn thứ ba. **Mây**, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp các hòn đảo trong sương đen, gom **đom đóm**, thắp và **châm dầu** cho **Đèn Lồng Lớn**, né hoặc xua **Bóng Mực** (chúng hút dầu của đèn yếu), và cảnh giác với **Gió Lạc** hay cướp đom đóm.

Trạng thái: **Phase 3** (Ticket-03 "Đèn cạn dầu", Contract v1.2). Đèn thắp rồi vẫn cạn dầu và tắt; mục tiêu là **giữ đảo sáng tới bình minh**. Thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md).

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
| E (hoặc Enter) | Nạp đom đóm vào đèn gần nhất chưa sáng, hoặc **châm dầu** cho đèn đang sáng (đứng trong 2 m) |
| F | Tỏa sáng, xua Bóng Mực và Gió Lạc (tốn 3 đom đóm, hồi 3 s) |
| Kéo chuột, hoặc ← → | Xoay camera |
| Esc hoặc P | Tạm dừng |

## Luật chơi (Phase 3)

- **Mục tiêu:** còn sống tới bình minh (hết giờ) và còn ít nhất `ceil(0.6 × tổng)` đèn **đang sáng**: Đêm 1 cần 3/5, Đêm 2 cần 4/6, Đêm 3 cần 5/7. Thắp đủ đèn **không** kết thúc đêm. Thời gian 240 / 270 / 300 s.
- **Đèn có dầu (tối đa 100):** thắp xong dầu đầy 100, hao 1 dầu mỗi giây. Hết dầu thì đèn tắt (nhớ là đã từng sáng). Bấm E ở đèn đang sáng để **châm dầu**: mỗi đom đóm cho +10 dầu.
- **Thắp:** đèn chưa từng sáng cần 10 đom đóm; **thắp lại** đèn đã từng sáng chỉ cần 5. Nạp từng ít một được, đèn nhớ tiến độ.
- **Vùng an toàn 6 m** chỉ có ở đèn sáng có dầu **từ 30 trở lên**. Dưới 30 thì đèn nhấp nháy chậm và mất vùng an toàn.
- **Bóng Mực hút dầu:** Bóng Mực đang lang thang sẽ đi tới đèn yếu (dầu dưới 30), đứng yên hút 5 dầu/giây (nhiều con thì cộng dồn). Mây lại gần trong 6 m thì chúng quay sang đuổi. Châm dầu lên từ 30 trở lên thì chúng bị đẩy ra và không gây sát thương.
- **Sức chứa tăng dần:** `10 + 2 × số lần thắp thành công trong đêm` (kể cả thắp lại), tối đa 20.
- Bóng Mực phát hiện Mây ở 12 m, bỏ đuổi ở 18 m. Chạm thì mất 1 ngọn lửa (có 3), rơi một nửa số đom đóm đang mang, bất tử 1.5 s.
- **Đêm 1 – Đảo Bến.** **Đêm 2 – Đảo Cau:** hai đảo nối cầu tre, bục nhảy, Gió Lạc, Bùa Gió. **Đêm 3 – Đảo Chuông:** ba tầng, dốc, bục nhảy, tháp chuông, gió mạnh mỗi 30 s.
- **Rơi khỏi đảo:** mất 1 lửa và toàn bộ đom đóm, chờ 1 s rồi hồi sinh. **Thua:** hết lửa (luôn ưu tiên, kể cả ở tick bình minh), hoặc bình minh mà thiếu đèn sáng.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp hoặc châm vào đèn | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Bóng Mực trúng Tỏa Sáng | +5 (+15 nếu đang hút dầu) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + phần nguyên của dầu |
| Bình minh (chỉ khi thắng): mỗi ngọn lửa còn lại | +50 |

Không còn thưởng thời gian. Tổng điểm game là tổng điểm các đêm đã thắng. Số liệu chuẩn: [src/core/tuning.js](src/core/tuning.js), khai trong [game.contract.json](game.contract.json) (test bắt buộc hai nơi khớp nhau). Bản đồ: [src/core/maps.js](src/core/maps.js).

**Cài đặt:** âm lượng, độ nhạy chuột, và **Bảng màu dễ phân biệt** (viền Bóng Mực xanh dương #00B3FF, cảnh báo màu trắng kèm ⚠; đèn tắt xẹp và có vết rách). Cài đặt được lưu.

## Chế độ headless (Test Contract v1.2)

Chạy logic game không cần cửa sổ, 60 tick/giây, in ra JSONL:

```bash
node src/headless/cli.js --seed 1 --night 2 --ticks 600 --out out.jsonl
node src/headless/cli.js --seed 1 --night 3 --scenario s.json --inputs i.json --ticks 600 --snapshot-every 10 --out out.jsonl
```

`--night` nhận 1, 2, 3. Mã thoát: `0` thành công, `2` file scenario/inputs sai định dạng, `1` lỗi khác (lỗi ghi ra stderr). Cùng seed, scenario và inputs luôn cho output giống hệt nhau từng byte. Một đêm đầy đủ chạy dưới 1 giây trên máy phát triển.

## Kiểm chứng

- `npm test`: test đơn vị và scenario cho mọi tiêu chí của cả 3 phase, kiểm tra tất định cả 3 đêm, mã thoát, khớp contract.
- `npm run proof`: chạy lệnh headless thật với 20 kịch bản, ghi vào [docs/proof/phase3/RESULTS.md](docs/proof/phase3/RESULTS.md). Bằng chứng Phase 1, 2 (khớp tag tương ứng) vẫn ở [docs/proof/phase1/](docs/proof/phase1/RESULTS.md), [docs/proof/phase2/](docs/proof/phase2/RESULTS.md).
- Ảnh chụp bản web Phase 3: [docs/proof/phase3/](docs/proof/phase3/) (`web-demo-*.png`).
- CI (GitHub Actions) chạy `npm ci`, `npm test`, `npm run proof` mỗi lần push.
- Tài liệu: [ADR-001](docs/notes/ADR-001-den-co-dau-va-luat-thang.md) · [spec Phase 3](docs/notes/phase3-spec.md) (kèm bảng test bị luật mới thay) · [nhật ký Phase 3](docs/notes/phase3-log.md) · [Phase 2](docs/notes/phase2-spec.md) · [Phase 1](docs/notes/phase1-assumptions.md).

## Sáng tạo của tôi

- **Biển mây trôi** quanh đảo và **đom đóm lấp lánh** (chỉ ở bản web, trong `web/main.js`).
- Đèn sáng dần theo lượng dầu, thanh dầu trên mỗi đèn; ánh sáng môi trường và sương đổi theo số đèn sáng.
- **Ông Đăng** nói một câu mở đầu mỗi đêm (màn giới thiệu).
- Bằng chứng phần cũ không bị ảnh hưởng: các phần này không nằm trong `src/core/`, nên đầu ra headless không đổi.

## Giới hạn đã biết (nói thật)

- **Chưa chơi tay đủ 3 đêm với luật Phase 3.** Đã kiểm tra: server chạy, ảnh chụp bằng Chrome chạy ngầm thấy thanh dầu, đèn xẹp có vết rách, vùng an toàn chỉ ở đèn đủ dầu, Bóng Mực hút dầu, chế độ dễ phân biệt, thông báo ⚠. Luồng menu → giới thiệu → kết quả → Bình Minh, tạm dừng, cài đặt lưu lại và âm thanh **chỉ mới được viết, chưa ai bấm thử**; nhấp nháy 1 Hz chưa nhìn tận mắt.
- **Chưa đo FPS trên máy thật** (yêu cầu ≥ 30 FPS ở 1280×720). Có đồng hồ FPS (phím F3).
- **Chưa có bằng chứng người hoặc bot thắng trọn vẹn một đêm với luật mới.** Bot thử của Phase 1 và 2 không còn phù hợp (luật thắng đã đổi). Từng luật mới đã có test riêng.
- Âm thanh là âm tổng hợp bằng WebAudio, chưa cân chỉnh.
- Một số chỗ ticket chưa nói rõ đã tự giả định: [phase2-spec.md](docs/notes/phase2-spec.md) (H1 đến H19), [phase3-spec.md](docs/notes/phase3-spec.md) (I1 đến I14).

## Cấu trúc

```text
src/core/        luật chơi thuần (chạy headless được): game, bản đồ, số liệu chuẩn, kiểm tra định dạng
src/headless/    lệnh headless
web/, server.js  bản 3D Three.js (cảnh, âm thanh, HUD, menu)
tests/           test đơn vị và scenario
scripts/proof.mjs  sinh bằng chứng
docs/notes, docs/proof  giả định, ADR, nhật ký, bằng chứng
CHANGELOG.md     thay đổi phá vỡ tương thích
CLAUDE.md, .claude/   harness AI (hướng dẫn, hook, skill)
```
