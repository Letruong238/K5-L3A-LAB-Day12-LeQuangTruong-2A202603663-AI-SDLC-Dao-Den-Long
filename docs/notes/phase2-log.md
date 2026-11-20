# Phase 2: nhật ký dùng AI và đánh giá

## Cách làm
1. Đọc Ticket-02, tách ra: số liệu chuẩn thay luật cũ, bản đồ, tính năng mới, Contract v1.1.
2. Viết [phase2-spec.md](phase2-spec.md) TRƯỚC khi code: bảng "luật Phase 1 bị thay", giả định H1 đến H19, tiêu chí S1 đến S15.
3. Viết lại lõi: `tuning.js` (số chuẩn), `maps.js` (3 bản đồ với hàm độ cao), `game.js` (một tick theo đúng 12 bước của ticket), `validate.js` (định dạng mới).
4. Viết test cho từng tính năng, sửa test Phase 1 theo luật mới (có lý do), rồi mới cập nhật bản web.
5. Sinh bằng chứng bằng lệnh headless thật (`npm run proof`) và chụp bản web bằng Chrome chạy ngầm.

## Test Phase 1 bị luật mới thay (đã sửa kèm lý do, không tắt âm thầm)
Chi tiết ở bảng đầu [phase2-spec.md](phase2-spec.md). Tóm tắt: chi phí đèn 5→10, tỏa sáng 2→3 đom đóm/6→5 m/3→2 s choáng, điểm nhặt→điểm nạp, vùng an toàn chỉ quanh đèn đã sáng (R7 có thêm test chứng minh đèn chưa sáng KHÔNG còn vùng an toàn), mép đảo từ "chặn" thành "rơi" (R2), gia tốc 5 tick (đi 60 tick được 5.8 m thay vì 6 m), sinh theo lịch cố định (R10).

## AI sai ở đâu, phát hiện thế nào
| Lần | Chuyện gì | Phát hiện bằng | Xử lý |
|---|---|---|---|
| 1 | Để sót một nhãn rỗng `night2: {}` trong `maps.js` | đọc lại file vừa ghi | xóa |
| 2 | Test R8 "hết lửa cùng tick thắp đèn cuối" viết cho kịch bản không thể xảy ra (Bóng Mực cạnh đèn vừa thắp bị đẩy ra, không gây sát thương, theo luật ticket) | test đỏ, đọc lý do | đổi test thành luật ưu tiên thật (hết lửa luôn thua) và thêm test cho trường hợp Bóng Mực bị đẩy |
| 3 | Test S8 tin "trần 30 đom đóm" đạt được ở Đêm 1, nhưng Đêm 1 chỉ có 24 điểm sinh | test đỏ, in số liệu thật | sửa test: Đêm 1 tối đa 24, Đêm 3 mới đủ 30 (đúng với "hết điểm trống thì bỏ lượt") |
| 4 | Test bục nhảy S9 đo vị trí sau khi Mây đã đáp và bước tiếp, nên lệch 2.5 m | in quỹ đạo từng tick | đo đúng tại tick chạm đất (84) và kiểm tra vận tốc khi đang bay |
| 5 | Nhiều test viết sai: khung input trùng hoặc không theo thứ tự `tick`, truyền `undefined` vào cờ boolean, cho Mây chạy mãi rơi khỏi đảo, tính lệch 1 tick hồi chiêu | trình kiểm tra định dạng và test đỏ báo đúng chỗ | sửa từng test; không đụng vào code vì code đúng |
| 6 | Chèn chuỗi `\n` bằng Python làm xuống dòng thật trong file test | lỗi cú pháp khi chạy | sửa thủ công hai chỗ |
| 7 | Bản web quá tối với công thức ánh sáng môi trường của ticket (0.15 lúc đầu) | mở ảnh chụp thật | thêm ánh trăng nhẹ cố định, giữ nguyên công thức môi trường |
| 8 | Ảnh bằng chứng Đêm 1 là bản cũ (copy trước khi sửa) | kích thước file trùng khít ảnh cũ | chụp lại, xác nhận kích thước khác |
| 9 | Server thử từ Phase 1 còn chạy giữ cổng 5173 | lỗi `EADDRINUSE` của người dùng | kiểm tra tiến trình rồi tắt đúng cái đó; lần này dùng lệnh tắt theo cổng và kiểm tra lại |
| 10 | Bot chơi thử thua mọi ván Đêm 2, 3 | kết quả bot | KHÔNG kết luận game quá khó: bot không biết dùng cầu, bục, dốc. Ghi rõ là chưa có bằng chứng thắng trọn vẹn hai đêm này |

Bài học: khi test đỏ, in số liệu thật ra rồi mới quyết định sửa test hay sửa code. Ở Phase này cả 10 lần đều là lỗi của test hoặc của việc ghi file, lõi game đúng. Đã đưa quy tắc này vào [CLAUDE.md](../../CLAUDE.md).

## Đánh giá
| Yêu cầu | Kết quả |
|---|---|
| S1 đến S14 (headless, Contract v1.1) | Đạt: có test và bằng chứng ([RESULTS.md](../proof/phase2/RESULTS.md)), 3 đêm đầy đủ chạy tất định, mỗi đêm dưới 1 giây |
| Hồi quy Phase 1 | Đạt sau khi cập nhật test theo số chuẩn (bảng luật bị thay) |
| S15 bản web | **Một phần.** Cả 3 đêm tải và hiện đúng HUD, bản đồ (ảnh chụp). Chưa chơi tay đủ 3 đêm; menu/kết quả/Bình Minh/tạm dừng/cài đặt/âm thanh chưa ai bấm thử; chưa đo ≥ 30 FPS |
| Thắng trọn vẹn Đêm 2, 3 | **Chưa có bằng chứng** (chỉ test từng thành phần) |

Rủi ro: các chỗ ticket mơ hồ đã đoán (H1 đến H19, đặc biệt H3 điểm xuất phát Đêm 3, H10 vùng an toàn theo XZ, H15 hành vi tạm dừng/tiếp tục, H16 vị trí `night_start`) có thể khác cách hiểu của bài test ẩn.

## Token / chi phí
Chưa đo. Dùng `/cost` rồi điền: `__ token / __ USD` cho Phase 2.
Cách tiết kiệm: viết spec và test trước nên ít phải sửa lõi; in số liệu thật khi test đỏ thay vì đoán; bot và Chrome chạy ngầm thay vì chơi tay; giữ CLAUDE.md ngắn.
