// Đổi phím (Ticket-04, mục 4). Logic thuần, không đụng tới DOM nên test được bằng node:test.
export const ACTIONS = [
  { id: "up", label: "Đi tới" },
  { id: "down", label: "Đi lùi" },
  { id: "left", label: "Sang trái" },
  { id: "right", label: "Sang phải" },
  { id: "jump", label: "Nhảy" },
  { id: "dash", label: "Lướt" },
  { id: "interact", label: "Nạp / châm dầu" },
  { id: "pulse", label: "Tỏa sáng" },
  { id: "pause", label: "Tạm dừng" },
];

export const DEFAULT_KEYS = { up: "w", down: "s", left: "a", right: "d", jump: " ", dash: "shift", interact: "e", pulse: "f", pause: "p" };

// Phím cố định, không cho gán: Esc (luôn tạm dừng/hủy), Enter (vào đêm), mũi tên (xoay camera), F3 (FPS), Tab.
export const RESERVED = ["escape", "enter", "arrowleft", "arrowright", "arrowup", "arrowdown", "f3", "tab"];

export function normalizeKey(k) {
  if (typeof k !== "string" || k === "") return "";
  if (k === "Spacebar") return " ";
  return k.toLowerCase();
}

const NAMES = { " ": "Space", shift: "Shift", control: "Ctrl", alt: "Alt", escape: "Esc", enter: "Enter", tab: "Tab", capslock: "CapsLock", backspace: "Backspace" };
export function keyLabel(k) {
  if (NAMES[k]) return NAMES[k];
  return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
}

const labelOf = (id) => ACTIONS.find((a) => a.id === id)?.label ?? id;

// Thử gán phím mới cho một hành động.
// Trả về { ok: true, keys } (bản sao đã đổi) hoặc { ok: false, reason: "unknown_action" | "invalid" | "reserved" | "conflict", message, with? }.
export function rebind(keys, action, rawKey) {
  if (!ACTIONS.some((a) => a.id === action)) return { ok: false, reason: "unknown_action", message: "Hành động không tồn tại" };
  const key = normalizeKey(rawKey);
  if (!key || ["dead", "unidentified", "process"].includes(key)) return { ok: false, reason: "invalid", message: "Phím này không dùng được" };
  if (RESERVED.includes(key)) return { ok: false, reason: "reserved", message: `Phím ${keyLabel(key)} đã dành cho hệ thống, hãy chọn phím khác` };
  const other = ACTIONS.find((a) => a.id !== action && keys[a.id] === key);
  if (other) return { ok: false, reason: "conflict", with: other.id, message: `Phím ${keyLabel(key)} đã dùng cho "${labelOf(other.id)}". Hãy đổi phím đó trước hoặc chọn phím khác` };
  return { ok: true, keys: { ...keys, [action]: key } };
}

// Hợp lệ hóa cấu hình đọc từ bộ nhớ: thiếu thì lấy mặc định; nếu có phím trùng hoặc phím cấm thì dùng lại toàn bộ mặc định.
export function sanitizeKeys(obj) {
  const out = { ...DEFAULT_KEYS };
  if (obj && typeof obj === "object") {
    for (const a of ACTIONS) if (typeof obj[a.id] === "string" && obj[a.id] !== "") out[a.id] = normalizeKey(obj[a.id]);
  }
  const values = ACTIONS.map((a) => out[a.id]);
  const bad = values.some((v) => !v || RESERVED.includes(v)) || new Set(values).size !== values.length;
  return bad ? { ...DEFAULT_KEYS } : out;
}

// Các cặp hành động đang trùng phím (dùng để báo cho người dùng). Rỗng nghĩa là hợp lệ.
export function findConflicts(keys) {
  const seen = new Map();
  const out = [];
  for (const a of ACTIONS) {
    const k = keys[a.id];
    if (seen.has(k)) out.push([seen.get(k), a.id]);
    else seen.set(k, a.id);
  }
  return out;
}
