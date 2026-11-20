// Lưu bảng xếp hạng trên đĩa cục bộ (Ticket-04, mục 3). Mặc định: data/leaderboard.json cạnh gốc dự án; đổi bằng biến DDL_DATA_DIR.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addEntry, makeEntry, parseLeaderboard } from "../core/leaderboard.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const dataDir = () => process.env.DDL_DATA_DIR || join(ROOT, "data");
export const leaderboardFile = (dir = dataDir()) => join(dir, "leaderboard.json");

export function loadEntries(dir = dataDir()) {
  try {
    return parseLeaderboard(readFileSync(leaderboardFile(dir), "utf8"));
  } catch {
    return []; // chưa có file: bảng rỗng
  }
}

// Ghi qua file tạm rồi đổi tên, để tắt máy giữa chừng không làm hỏng bảng.
function save(entries, dir) {
  mkdirSync(dir, { recursive: true });
  const file = leaderboardFile(dir);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + "\n");
  renameSync(tmp, file);
}

// Thêm điểm của một ván. Ném Error nếu dữ liệu sai. Trả về { entries, rank, entry }.
export function submitScore(data, dir = dataDir(), now = new Date()) {
  const entry = makeEntry(data, now);
  const { entries, rank } = addEntry(loadEntries(dir), entry);
  save(entries, dir);
  return { entries, rank, entry };
}

// Lệnh xuất: ghi {"entries": [...]} đúng thứ tự ra file.
export function exportLeaderboard(outPath, dir = dataDir()) {
  writeFileSync(outPath, JSON.stringify({ entries: loadEntries(dir) }, null, 2) + "\n");
}
