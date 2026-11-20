# Retro: Đảo Đèn Lồng (Day 12 AI SDLC)

**Lê Quang Trường (2A202603663)**, làm một mình, vai trò: người ra yêu cầu, người duyệt và người kiểm chứng; Claude Code (Claude Sonnet 5.5) viết phần lớn mã và tài liệu.

## 1. Tổng hợp Evaluation của 4 phase

| Phase | Phần chấm tự động (headless, đo) | Phần bản web / chơi thật |
|---|---|---|
| 1 (PRD-0, Contract v1.0) | Đạt R1 đến R12: test + bằng chứng headless | R13 **chưa có bằng chứng hình ảnh** lúc nộp (chỉ bot thử) |
| 2 (Ticket-02, v1.1) | Đạt S1 đến S14; hồi quy Phase 1 đạt sau khi sửa test theo số chuẩn mới | S15 một phần: 3 đêm tải được, chưa chơi tay, chưa đo FPS |
| 3 (Ticket-03, v1.2) | Đạt T1 đến T11 (123 test, 20 kịch bản); 9 test cũ bị luật mới thay, 0 lỗi code | T12 một phần: ảnh chụp thấy thanh dầu, vùng an toàn; **chưa có bằng chứng thắng trọn một đêm** |
| 4 (Ticket-04, v1.3) | Đạt U1 đến U12 theo cách đo đã ghi; bench 326.7 FPS (máy dev); soak 0 crash | Ảnh chụp đổi phím, phụ đề, bảng xếp hạng, chữ lớn; **chưa chơi tay**, chưa quay video |

Điểm yếu xuyên suốt: **phần "chơi thật bằng tay" chưa được kiểm chứng ở cả 4 phase**. Mọi thứ đo được bằng lệnh đều có bằng chứng; thứ cần con người (cảm giác chơi, cân bằng, âm thanh) thì chỉ có ảnh chụp và test.

## 2. Điều gì hiệu quả
- **Tách lõi luật khỏi đồ họa** (`src/core` thuần, bản web chỉ vẽ). Nhờ vậy test chạy trong 1 giây, headless tất định từng byte, và Phase 4 thêm bench/soak mà không đụng đầu ra cũ.
- **Viết giả định và tiêu chí TRƯỚC khi code** (G, H, I, J). Khi ticket mơ hồ, mọi lựa chọn đã có tên và lý do, test ẩn có hiểu khác cũng dễ lần ra chỗ lệch.
- **Chạy lệnh thật thay vì tin "đã chạy"**: `npm run proof`, soak 1000 đêm, benchmark thật. Các lỗi đáng kể nhất (bộ nhớ soak, cửa sổ bench treo) chỉ lộ ra khi chạy thật.
- **Bảng "test cũ bị luật mới thay" kèm lý do** thay vì skip: Phase 3 sửa 9 test, mỗi cái có lý do, 0 lỗi code bị giấu.
- **Sinh `game.contract.json` khớp `tuning.js` có test**: loại cả một lớp lỗi lệch số.

## 3. Điều gì không hiệu quả
- **Giả định về hành vi chưa kiểm chứng** (soak "chỉ là RSS tăng", bot "thắng được"): lần đầu thường sai, phải đo mới biết.
- **Môi trường Windows + Git Bash** tốn thời gian một cách vô ích: mã chữ tiếng Việt qua `curl`, đường dẫn `d:/` với `tar`, `/tmp` khác nhau giữa bash và Node, lệnh nhiều dấu nháy.
- **Cửa sổ Chrome dừng vẽ không đều** làm benchmark thiếu ổn định; tìm nguyên nhân gốc tốn thời gian mà chưa xong.
- **Bot kiểm chứng cân bằng** không làm được từ Phase 3 (luật thắng đổi), nên không có bằng chứng thắng một đêm.

## 4. Những lần AI sai và cách phát hiện
(Chi tiết trong nhật ký từng phase: [phase1](notes/phase1-log.md), [phase2](notes/phase2-log.md), [phase3](notes/phase3-log.md), [phase4](notes/phase4-log.md).) Tổng cộng khoảng 28 lần ghi nhận. Các nhóm chính:

| Nhóm | Ví dụ | Phát hiện bằng |
|---|---|---|
| Test viết sai, code đúng (nhiều nhất) | test luôn đúng (so số với chính nó); kịch bản không thể xảy ra; tính lệch 1 tick | test đỏ rồi **đọc lý do và in số liệu thật trước khi sửa** |
| Sửa hàng loạt làm hỏng chỗ khác | thay chuỗi `per_mote` đổi nhầm `fuel_per_mote` | đọc lại diff; script vá bắt buộc "khớp đúng một lần" |
| Kết luận khi chưa đo | "bot thua nghĩa là game quá khó"; "RSS tăng là bình thường" | đo nguyên nhân (bot không biết dùng cầu; heap phẳng qua 1000 đêm) |
| Hành động nguy hiểm | định `taskkill /IM chrome.exe` (tắt cả Chrome của người dùng) | hệ thống phân quyền chặn; thêm quy tắc "chỉ tắt theo PID/cổng của mình" |
| Môi trường | server cũ giữ cổng 5173; lỗi mã chữ, đường dẫn | lỗi thật khi chạy |

## 5. Harness nào giúp nhiều nhất
1. **Hook Stop chạy `npm test`**: không thể báo xong khi test đỏ; bắt được lỗi ở gần như mọi phase.
2. **CLAUDE.md ngắn kèm quy ước rút ra từ lỗi** (thứ tự 12 bước, dầu là số nguyên, "khi test đỏ đọc lý do trước", "script vá phải assert"): mỗi quy ước đến từ một lần sai thật nên AI ít lặp lại lỗi cũ.
3. **Skill `verify-headless`**: ép chạy `npm test` + `npm run proof` và lưu output vào `docs/proof/`, tách "đã chạy" khỏi "bảo là đã chạy".
4. CI GitHub Actions (`npm ci`, `npm test`, `npm run proof`): bắt lỗi khác máy.
Ít giúp nhất: các hướng dẫn chung chung không gắn với một lỗi cụ thể.

## 6. Token / chi phí AI
Chưa đo, tác giả điền sau khi gõ `/cost` trong Claude Code:

| Phase | Token | USD |
|---|---|---|
| 1 | __ | __ |
| 2 | __ | __ |
| 3 | __ | __ |
| 4 | __ | __ |
| **Tổng** | __ | __ |

Cách đã tiết kiệm: viết spec/giả định và test trước nên ít vòng sửa; script vá có kiểm tra thay vì sửa tay nhiều lần; chạy ảnh chụp/bench ở nền; giữ CLAUDE.md ngắn; tái dùng cơ chế sẵn có (vùng an toàn của Phase 2 cho việc đẩy Bóng Mực ở Phase 3, toast và mũi tên cho phụ đề ở Phase 4); đọc tóm tắt ngữ cảnh thay vì đọc lại cả file lớn.

## 7. Nếu làm lại, tôi sẽ đổi
- **Chơi thử bằng tay sớm hơn, mỗi phase một lần**, thay vì dồn "chưa chơi tay" tới cuối. Quay video demo song song từ Phase 2.
- **Viết một bot thắng được** ngay từ Phase 2 và sửa theo luật mỗi phase, để luôn có bằng chứng cân bằng.
- **Chạy lệnh đo (bench, soak) ngay khi có khung sườn**, không đợi cuối; lỗi bộ nhớ và cửa sổ treo sẽ lộ sớm.
- **Dùng WSL hoặc PowerShell thuần** cho mọi lệnh có chữ tiếng Việt và đường dẫn, tránh Git Bash.
- **Ghi nhật ký token sau mỗi phase** thay vì để trống tới cuối.
