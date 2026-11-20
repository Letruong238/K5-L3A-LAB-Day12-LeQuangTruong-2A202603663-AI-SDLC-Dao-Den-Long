# ADR-001: Đèn có dầu và luật thắng "giữ đảo sáng tới bình minh" (Ticket-03, Contract v1.2)

Trạng thái: chấp nhận (Phase 3). Thay thế: luật "đèn sáng là xong" và "thắng ngay khi đủ đèn" của Phase 1 và 2.

## Bối cảnh
Người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc. Nhà thiết kế đổi mục tiêu: đèn thắp rồi vẫn tắt được, phải giữ đảo sáng tới hết giờ.

## Quyết định

### 1. Mô hình trạng thái đèn
Cũ: `{lit, deposited}`, sáng là mãi mãi, nạp đủ 10 là xong.
Mới: `{lit, deposited, fuel, ever_lit, relit_count}`.

- `fuel` lưu bằng **số nguyên đơn vị 1/60** (`fuelU = fuel × 60`): hao 1 đơn vị mỗi tick, bị hút 5 đơn vị mỗi tick mỗi Bóng Mực. Chỉ đổi sang số thực (1 chữ số thập phân) khi xuất snapshot. Lý do: ticket yêu cầu tránh sai số số thực, và so sánh `fuel < 30` phải chính xác (đúng 30 vẫn còn vùng an toàn).
- Đèn tắt có `fuel: 0` và `deposited: 0`, nhưng giữ `ever_lit: true`. `ever_lit` quyết định giá thắp lại (5 thay vì 10).
- Đèn "nhận được" khi tương tác: chưa sáng, hoặc sáng nhưng chưa đầy dầu. Đèn đầy dầu không được chọn và không phát sự kiện (nên một đèn đầy dầu đứng cạnh một đèn tắt thì nạp vào đèn tắt).
- Châm dầu thêm sự kiện `refuel`; thắp (lần đầu hoặc lại) vẫn là `lantern_lit` kèm `relight`.
- Hết dầu: `lantern_out`, đèn tắt ngay sau bước 2 của tick.
- Đèn `fuel < 30` mất vùng an toàn. Hàm `zoneLanterns()` thay `litLanterns()`; mọi chỗ dùng vùng an toàn (chặn, đẩy ra, điểm sinh) đều đi qua hàm này.

### 2. Bóng Mực hút dầu
Thêm trạng thái `drain`. Chỉ Bóng Mực `wander` chọn đèn yếu (sáng và `fuel < 30`, gần nhất, hòa thì id nhỏ); không có thì đi tới đèn tắt gần nhất; không có đèn tắt thì đi lang thang ngẫu nhiên như Phase 2. Tới ≤ 2 m thì đứng yên hút 5 fuel/giây (cộng dồn). Thoát `drain`: Mây vào 6 m thì `chase`, trúng tỏa sáng thì `stunned`, đèn tắt/được châm lên ≥ 30/cách > 2 m thì `wander`. Hết choáng luôn về `wander` (Phase 2 là `chase` nếu cách ≤ 18 m; đây là thay đổi hành vi).
Khi châm dầu lên ≥ 30 lúc có Bóng Mực trong 6 m, tái dùng cơ chế "bị đẩy ra mép, không sát thương, tối đa 30 tick" của Phase 2 (cùng một đoạn code ở bước 6, không viết thêm).

### 3. Luật thắng
Bỏ thắng sớm. Thắng = còn sống ở tick hết giờ và số đèn đang sáng tại tick cuối ≥ `ceil(0.6 × tổng)`. Thời gian đêm 240/270/300 s. Hết lửa luôn thua `no_flames` trước (kể cả tick cuối). Lý do kết thúc: `dawn_survived`, `dawn`, `no_flames` (`all_lit` không còn dùng).
Bước xét thắng/thua vẫn là bước 11 của tick, nên chạy sau khi trừ dầu và tắt đèn ở bước 2. Không đổi thứ tự 12 bước của Ticket-02, chỉ bổ sung nội dung bước 2 (trừ dầu, rồi đèn `fuel ≤ 0` tắt).

### 4. Sức chứa và điểm
`capacity = min(20, 10 + 2 × successful_lights)`, đếm cả thắp lại, không đếm đèn đặt sẵn bằng scenario, không đếm châm dầu. Điểm theo bảng mới của ticket (nạp +5, thắp +100, thắp lại +40, tỏa sáng +5 hoặc +15 nếu đang drain, bình minh +50 + floor(fuel) mỗi đèn sáng và +50 mỗi lửa, bỏ thưởng thời gian).

## Hệ quả
- Phải sửa nhiều test cũ (xem [CHANGELOG.md](../../CHANGELOG.md), mục "Test cũ bị thay").
- `all_lit` và thắng sớm biến mất khỏi mã.
- Giả định mới được ghi ở [phase3-spec.md](phase3-spec.md).

## Phương án đã loại
- Lưu `fuel` bằng số thực: dễ sai số khi cộng dồn 1/60 mỗi tick và so với ngưỡng 30.
- Thêm một đường xử lý riêng cho "đẩy Bóng Mực khi châm dầu": trùng với cơ chế vùng an toàn có sẵn, nên tái dùng.
