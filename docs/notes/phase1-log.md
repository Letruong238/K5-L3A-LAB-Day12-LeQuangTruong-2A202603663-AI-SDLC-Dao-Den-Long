# Phase 1: nhật ký dùng AI và đánh giá

## Cách làm
1. Đọc PRD-0 và Test Contract trên lab board (qua công cụ đọc artifact), tách phần bắt buộc chính xác khỏi phần mơ hồ.
2. Ghi giả định G1 đến G18 và tiêu chí R1 đến R13 ([phase1-assumptions.md](phase1-assumptions.md)) TRƯỚC khi code.
3. Viết lõi `src/core/` tách khỏi đồ họa, rồi test, rồi lệnh headless, rồi bản 3D.
4. Sinh bằng chứng bằng lệnh headless thật (`npm run proof`).

## AI sai ở đâu, phát hiện thế nào
| Lần | Chuyện gì | Phát hiện bằng | Xử lý |
|---|---|---|---|
| 1 | `node --test tests/` lỗi trên Node 24 (không nhận tên thư mục) | chạy `npm test` thật | đổi sang mẫu `tests/**/*.test.js` |
| 2 | Test R4 "nạp hai lần" sai: nạp 8 đom đóm thì lần đầu đã đủ cost nên lần hai không còn gì để nạp | test đỏ | sửa test (dùng hai đèn), code đúng |
| 3 | Test R10 "sinh Bóng Mực" sai: Bóng Mực ban đầu giết người chơi đứng yên trước tick 900 | test đỏ | sửa kịch bản (không có Bóng Mực ban đầu) |
| 4 | Test R6 có một dòng assert luôn đúng (so số với chính nó), tức là test giả | tự rà lại trước khi chạy | xóa dòng, thay bằng assert thật (hit tick >= 180) |

Bài học: test đỏ có thể là lỗi của test chứ không phải code. Phải đọc lý do rồi mới sửa, và không nới điều kiện cho khớp.
Đã thêm vào harness: hook Stop chạy `npm test`, skill `verify-headless`, và quy tắc trong CLAUDE.md.

## Đánh giá
| Yêu cầu | Kết quả |
|---|---|
| R1 đến R12 | Đạt, có test và bằng chứng headless ([RESULTS.md](../proof/phase1/RESULTS.md)) |
| R13 (bản 3D chơi được) | **Chưa có bằng chứng hình ảnh.** Logic đã kiểm chứng qua headless và một bot thử (thắng 20/20 ván seed 1 đến 20, khoảng 45 đến 60 giây mỗi ván, script tạm không lưu trong repo). Giao diện cần chơi thử thật |

Rủi ro còn lại: một số chỗ contract mơ hồ nên bài test ẩn có thể hiểu khác. Các chỗ đã đoán: G9 (vùng an toàn áp dụng quanh mọi đèn), G10 (event `pulse` ghi cả khi không trúng ai), G13 (nhảy đổi `pos[1]`), G17 (thêm snapshot ở tick cuối).

## Token / chi phí
Chưa đo. Bạn xem bằng lệnh `/cost` trong Claude Code rồi điền số thật vào đây: `__ token / __ USD`.
Cách tiết kiệm đã dùng: viết test và giả định trước nên ít phải sửa; một bot thử chạy tự động thay vì chơi tay; giữ CLAUDE.md ngắn.
