# Phase 3: nhật ký dùng AI và đánh giá

## Cách làm (Phase chỉ có khoảng 30 phút nên đi theo thứ tự cố định)
1. Đọc Ticket-03, đánh dấu các luật bị `[THAY THẾ]`, liệt kê mọi test và tài liệu bị ảnh hưởng.
2. Ghi quyết định thiết kế trước: [ADR-001](ADR-001-den-co-dau-va-luat-thang.md) và [CHANGELOG.md](../../CHANGELOG.md) (các thay đổi phá vỡ tương thích).
3. Sửa lõi: dầu bằng số nguyên 1/60, đèn có `fuel/ever_lit/relit_count`, trạng thái `drain`, luật thắng bình minh, sức chứa, điểm.
4. Chạy test cũ để xem chỗ nào sai. Với mỗi test sai, đối chiếu với ticket để xác định "luật cũ bị thay" hay "lỗi code" TRƯỚC khi sửa. Kết quả: 9 test cũ bị luật mới thay, được sửa kèm lý do (bảng ở [phase3-spec.md](phase3-spec.md)); 0 lỗi code.
5. Viết test cho luật mới ([tests/phase3.test.js](../../tests/phase3.test.js)), rồi cập nhật bản web, rồi sinh bằng chứng bằng lệnh headless thật.

## AI sai ở đâu, phát hiện thế nào
| Lần | Chuyện gì | Phát hiện bằng | Xử lý |
|---|---|---|---|
| 1 | Thay chuỗi hàng loạt `per_mote: 10 → 5` làm đổi nhầm cả `fuel_per_mote: 10` thành 5 | đọc lại diff hiển thị sau khi sửa | sửa lại ngay; contract được sinh từ `tuning.js` nên hai nơi không thể lệch |
| 2 | Test mới "nhấn lại thì nạp vào đèn thứ hai": quên rằng đèn vừa thắp hao ngay 1 đơn vị trước bước tương tác nên không bao giờ đầy ở bước 5, mỗi lần bấm châm tiếp vào đèn gần nhất | test đỏ, in dữ liệu | sửa kỳ vọng theo đúng ticket, ghi thành giả định I11 |
| 3 | Test "wander tới đèn tắt gần nhất" bỏ sót 4 đèn tắt mặc định, nên đèn gần nhất thật ra là L2 | test đỏ, tính khoảng cách | cho 4 đèn kia sáng để chỉ còn L1 tắt |
| 4 | Bản vá bản web chạy dở: hai file đã vá, `main.js` dừng vì một chuỗi neo xuất hiện 2 lần | lỗi assert của script vá | chạy lại riêng phần `main.js` với neo cụ thể hơn |
| 5 | Script bằng chứng không khớp chuỗi vì dấu backtick trong chuỗi mẫu bị escape | assert của script | sửa chuỗi tìm theo đúng nội dung file |
| 6 | Lệnh shell nhiều dòng với nhiều dấu nháy bị lỗi cú pháp (hai lần) | lỗi `unexpected EOF` trước khi chạy gì | ghi script ra file bằng công cụ Write rồi chạy |

Bài học: script vá tự kiểm tra "mỗi chỗ thay chỉ khớp đúng một lần" đã chặn được 2 lỗi trước khi ghi đè; sinh `game.contract.json` từ `tuning.js` loại bỏ cả một lớp lỗi lệch số.

## Đánh giá
| Yêu cầu | Kết quả |
|---|---|
| T1 đến T11 (headless, Contract v1.2) | Đạt: 123/123 test, 20 kịch bản bằng chứng ([RESULTS.md](../proof/phase3/RESULTS.md)), 3 đêm đầy đủ tất định, mỗi đêm dưới 1 giây |
| Hồi quy Phase 1 và 2 | Đạt; chỉ các test bị luật mới thay mới đổi (9 test, có lý do) |
| T12 bản web | **Một phần.** Ảnh chụp cho thấy thanh dầu, đèn tắt xẹp có vết rách, vùng an toàn chỉ đèn đủ dầu, chế độ dễ phân biệt. Chưa chơi tay, nhấp nháy 1 Hz chưa nhìn tận mắt, chưa đo FPS |
| Thắng trọn vẹn một đêm với luật mới | **Chưa có bằng chứng** (chỉ test từng luật). Đây là rủi ro cân bằng: chưa biết đêm có quá khó không khi Bóng Mực hút dầu |

Rủi ro: các giả định I1 đến I14, đặc biệt I4 (đích đi của `wander` "như trước" mà Ticket-02 chưa quy định), I8 (ưu tiên khi thoát `drain`) và I11, có thể khác cách hiểu của bài test ẩn.

## Token / chi phí
Chưa đo. Dùng `/cost` rồi điền: `__ token / __ USD` cho Phase 3.
Cách tiết kiệm: ADR và bảng test bị thay viết trước nên không phải đoán khi sửa test; script vá có kiểm tra thay vì sửa tay nhiều lần; chụp ảnh Chrome chạy ngầm thay vì mở cửa sổ; tái dùng cơ chế vùng an toàn của Phase 2 cho việc đẩy Bóng Mực khi châm dầu thay vì viết đường xử lý mới.
