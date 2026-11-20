// Bảng xếp hạng cục bộ (Ticket-04, mục 3): logic thuần, không đọc/ghi file. Việc lưu đĩa nằm ở src/headless/leaderboard-store.js.
export const LEADERBOARD_MAX = 10;
export const NAME_MIN = 3;
export const NAME_MAX = 12;

// Tên: 3 đến 12 ký tự, chỉ gồm chữ cái Latin (kể cả tiếng Việt có dấu, điểm cộng), chữ số và dấu gạch dưới.
// Chữ ASCII [A-Za-z0-9_] luôn hợp lệ. Độ dài đếm theo ký tự sau khi chuẩn hóa NFC.
const NAME_RE = /^[\p{Script=Latin}\p{N}_]+$/u;

export function normalizeName(name) {
  return typeof name === "string" ? name.normalize("NFC") : "";
}

// Trả về { ok: true, name } hoặc { ok: false, reason }.
export function validateName(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "Tên phải là chữ" };
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < NAME_MIN || len > NAME_MAX) return { ok: false, reason: `Tên phải dài ${NAME_MIN} đến ${NAME_MAX} ký tự` };
  if (!NAME_RE.test(name)) return { ok: false, reason: "Tên chỉ được dùng chữ cái, số và dấu gạch dưới (_), không có dấu cách" };
  return { ok: true, name };
}

const pad = (n, w = 2) => String(n).padStart(w, "0");

// ISO 8601 kèm múi giờ địa phương, ví dụ 2026-11-20T21:05:33.123+07:00
export function isoWithOffset(date = new Date()) {
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  const local = new Date(date.getTime() + off * 60000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}.${pad(local.getUTCMilliseconds(), 3)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

const isInt = (v) => Number.isInteger(v);

// Tạo mục mới từ dữ liệu người chơi. Ném Error nếu sai (tên, điểm, số đêm thắng, seed).
export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  const v = validateName(name);
  if (!v.ok) throw new Error(v.reason);
  if (!isInt(score) || score < 0) throw new Error("score phải là số nguyên >= 0");
  if (!isInt(nights_won) || nights_won < 0 || nights_won > 3) throw new Error("nights_won phải là số nguyên từ 0 đến 3");
  if (!isInt(seed)) throw new Error("seed phải là số nguyên");
  return { name: v.name, score, nights_won, achieved_at: isoWithOffset(now), seed };
}

// Hợp lệ hóa một mục đọc từ file (bỏ mục hỏng thay vì làm hỏng cả bảng).
export function isValidEntry(e) {
  return !!e && typeof e === "object" && validateName(e.name).ok && isInt(e.score) && e.score >= 0 && isInt(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3 &&
    typeof e.achieved_at === "string" && !Number.isNaN(Date.parse(e.achieved_at)) && isInt(e.seed);
}

// Sắp xếp: điểm giảm dần; bằng điểm thì ai đạt trước đứng trên; bằng cả thời điểm thì giữ thứ tự cũ (ổn định).
export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map((x) => x.e);
}

// Thêm một mục, giữ top 10. Trả về { entries, rank } (rank 1..10, hoặc null nếu không lọt top).
export function addEntry(entries, entry) {
  const sorted = sortEntries([...entries.filter(isValidEntry), entry]);
  const top = sorted.slice(0, LEADERBOARD_MAX);
  const idx = top.indexOf(entry);
  return { entries: top, rank: idx < 0 ? null : idx + 1 };
}

// Đọc nội dung file JSON { entries: [...] } thành danh sách hợp lệ đã sắp xếp (file hỏng thì bảng rỗng).
export function parseLeaderboard(text) {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.entries;
    if (!Array.isArray(list)) return [];
    return sortEntries(list.filter(isValidEntry)).slice(0, LEADERBOARD_MAX);
  } catch {
    return [];
  }
}
