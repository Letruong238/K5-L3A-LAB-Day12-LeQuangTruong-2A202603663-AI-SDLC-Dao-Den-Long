// Test Phase 4 (Ticket-04, Contract v1.3): bảng xếp hạng, đổi phím, benchmark, soak, tiếp cận (cỡ chữ), đóng gói.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Game } from "../src/core/game.js";
import { MAPS } from "../src/core/maps.js";
import { BENCH, benchCamera, benchScenario, benchStats } from "../src/core/bench.js";
import { LEADERBOARD_MAX, addEntry, isoWithOffset, makeEntry, parseLeaderboard, sortEntries, validateName } from "../src/core/leaderboard.js";
import { makeInputSource, nightFor, runSoak, runSoakNight, seedFor } from "../src/core/soak.js";
import { ACTIONS, DEFAULT_KEYS, findConflicts, rebind, sanitizeKeys } from "../web/keybinds.js";
import { exportLeaderboard, loadEntries, submitScore } from "../src/headless/leaderboard-store.js";
import { startServer } from "../server.js";

const tmp = () => mkdtempSync(join(tmpdir(), "ddl-p4-"));
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const entry = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1, ...extra });

// ---------- Bảng xếp hạng (mục 3) ----------
test("L1: tên hợp lệ 3 đến 12 ký tự [A-Za-z0-9_], tiếng Việt có dấu được chấp nhận", () => {
  for (const ok of ["abc", "Mây_01", "Truong_12345", "ABCDEFGHIJKL", "a_b", "Trường", "Đăng_Lê"]) assert.equal(validateName(ok).ok, true, ok);
  assert.equal(validateName("Truong_123456").ok, false, "13 ký tự quá dài");
  assert.equal(validateName("ABCDEFGHIJKL").ok, true, "đúng 12 ký tự");
  assert.equal(validateName("ab").ok, false, "2 ký tự quá ngắn");
  assert.equal(validateName("").ok, false);
  for (const bad of ["a b c", "ab-cd", "ab.cd", "ab!", "<b>x</b>", "tên😀tên", "a\tb", " abc", "abc "]) assert.equal(validateName(bad).ok, false, JSON.stringify(bad));
  for (const bad of [null, undefined, 123, {}, ["abc"]]) assert.equal(validateName(bad).ok, false);
});

test("L2: đếm độ dài theo ký tự đã chuẩn hóa (chữ có dấu dạng tổ hợp vẫn tính một ký tự)", () => {
  const decomposed = "Trương"; // cố tình dùng dấu tổ hợp rời
  const r = validateName(decomposed.normalize("NFD"));
  assert.equal(r.ok, true);
  assert.equal([...r.name].length <= 12, true);
  assert.equal(r.name, r.name.normalize("NFC"));
});

test("L3: sắp xếp theo điểm giảm dần, bằng điểm thì ai đạt trước đứng trên", () => {
  const list = sortEntries([
    entry("Cuoi", 100, "2026-01-01T10:00:00.000+07:00"),
    entry("Nhat", 300, "2026-01-01T09:00:00.000+07:00"),
    entry("BangSau", 200, "2026-01-01T12:00:00.000+07:00"),
    entry("BangTruoc", 200, "2026-01-01T11:00:00.000+07:00"),
  ]);
  assert.deepEqual(list.map((e) => e.name), ["Nhat", "BangTruoc", "BangSau", "Cuoi"]);
});

test("L4: so sánh thời điểm theo múi giờ thật, không theo chuỗi", () => {
  // 10:00+07:00 = 03:00Z, sớm hơn 05:00Z dù chuỗi "05:00" nhỏ hơn "10:00"
  const list = sortEntries([entry("Sau", 50, "2026-01-01T05:00:00.000Z"), entry("Truoc", 50, "2026-01-01T10:00:00.000+07:00")]);
  assert.deepEqual(list.map((e) => e.name), ["Truoc", "Sau"]);
});

test("L5: chỉ giữ top 10; mục thấp điểm nhất bị loại; rank đúng", () => {
  let entries = [];
  for (let i = 1; i <= 12; i++) {
    const r = addEntry(entries, makeEntry({ name: `Nguoi_${i}`, score: i * 10, nights_won: 1, seed: i }, new Date(2026, 0, 1, 0, 0, i)));
    entries = r.entries;
    if (i <= LEADERBOARD_MAX) assert.equal(r.rank, 1, "điểm tăng dần nên luôn đứng đầu");
  }
  assert.equal(entries.length, 10);
  assert.equal(entries[0].score, 120);
  assert.equal(entries.at(-1).score, 30);
  const low = addEntry(entries, makeEntry({ name: "ThapDiem", score: 1, nights_won: 0, seed: 9 }));
  assert.equal(low.rank, null, "điểm quá thấp không vào top 10");
  assert.equal(low.entries.length, 10);
});

test("L6: bằng điểm với người đã có thì đứng DƯỚI người đạt trước", () => {
  const first = makeEntry({ name: "DauTien", score: 500, nights_won: 3, seed: 1 }, new Date("2026-05-01T00:00:00Z"));
  const r = addEntry([first], makeEntry({ name: "VeSau", score: 500, nights_won: 3, seed: 2 }, new Date("2026-05-01T00:00:01Z")));
  assert.deepEqual(r.entries.map((e) => e.name), ["DauTien", "VeSau"]);
  assert.equal(r.rank, 2);
});

test("L7: makeEntry kiểm tra dữ liệu và gắn achieved_at ISO 8601 có múi giờ", () => {
  const e = makeEntry({ name: "Tester", score: 10, nights_won: 2, seed: 5 });
  assert.deepEqual(Object.keys(e), ["name", "score", "nights_won", "achieved_at", "seed"]);
  assert.match(e.achieved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(e.achieved_at)));
  for (const bad of [{ score: -1 }, { score: 1.5 }, { score: "9" }, { nights_won: 4 }, { nights_won: -1 }, { seed: 1.2 }, { name: "x" }]) {
    assert.throws(() => makeEntry({ name: "Tester", score: 10, nights_won: 2, seed: 5, ...bad }), Error, JSON.stringify(bad));
  }
  assert.doesNotThrow(() => makeEntry({ name: "Tester", score: 0, nights_won: 0, seed: -7 }), "thua đêm 1: điểm 0, 0 đêm thắng vẫn được lưu");
});

test("L8: isoWithOffset cho đúng thời điểm và độ lệch múi giờ", () => {
  const d = new Date("2026-11-20T14:05:33.123Z");
  const s = isoWithOffset(d);
  assert.equal(Date.parse(s), d.getTime(), "cùng một thời điểm");
  const off = 0 - d.getTimezoneOffset(); // "0 -" thay vì dấu trừ đơn: tránh -0 khi máy ở UTC (CI), strictEqual coi 0 khác -0
  const m = s.match(/([+-])(\d{2}):(\d{2})$/);
  assert.equal((m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])), off);
});

test("L8b: isoWithOffset đúng ở nhiều múi giờ (UTC như CI, +07:00, +05:30, -05:00), kể cả múi giờ lệch 0", () => {
  const code = 'import("./src/core/leaderboard.js").then((m) => console.log(m.isoWithOffset(new Date("2026-11-20T14:05:33.123Z"))))';
  const cases = [["UTC", "2026-11-20T14:05:33.123+00:00"], ["Asia/Ho_Chi_Minh", "2026-11-20T21:05:33.123+07:00"], ["Asia/Kolkata", "2026-11-20T19:35:33.123+05:30"], ["America/New_York", "2026-11-20T09:05:33.123-05:00"]];
  for (const [tz, want] of cases) {
    const r = spawnSync(process.execPath, ["-e", code], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), want, `TZ=${tz}`);
  }
});

test("L9: lưu ra đĩa, mở lại vẫn còn; file hỏng thì bảng rỗng; mục hỏng bị bỏ", () => {
  const dir = tmp();
  assert.deepEqual(loadEntries(dir), []);
  submitScore({ name: "Mot_Hai", score: 120, nights_won: 1, seed: 3 }, dir);
  submitScore({ name: "Ba_Bon", score: 450, nights_won: 3, seed: 4 }, dir);
  const again = loadEntries(dir); // như tắt game rồi mở lại: đọc từ đĩa
  assert.deepEqual(again.map((e) => e.name), ["Ba_Bon", "Mot_Hai"]);
  writeFileSync(join(dir, "leaderboard.json"), "{ không phải json");
  assert.deepEqual(loadEntries(dir), []);
  writeFileSync(join(dir, "leaderboard.json"), JSON.stringify({ entries: [{ name: "x", score: 1 }, entry("TotLam", 5, "2026-01-01T00:00:00.000+07:00")] }));
  assert.deepEqual(loadEntries(dir).map((e) => e.name), ["TotLam"]);
  assert.deepEqual(parseLeaderboard("[]"), []);
});

test("L10: --export-leaderboard ghi {entries} đúng thứ tự (qua lệnh thật npm start -- ...)", () => {
  const dir = tmp();
  for (const [n, s] of [["Thap", 10], ["Cao", 900], ["Giua", 300]]) submitScore({ name: n, score: s, nights_won: 1, seed: 1 }, dir);
  const out = join(dir, "out.json");
  const r = spawnSync(process.execPath, ["server.js", "--export-leaderboard", out], { env: { ...process.env, DDL_DATA_DIR: dir }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(data), ["entries"]);
  assert.deepEqual(data.entries.map((e) => e.name), ["Cao", "Giua", "Thap"]);
  for (const e of data.entries) assert.deepEqual(Object.keys(e), ["name", "score", "nights_won", "achieved_at", "seed"]);
  // chưa có file: xuất bảng rỗng, vẫn mã 0
  const empty = join(dir, "empty.json");
  const r2 = spawnSync(process.execPath, ["server.js", "--export-leaderboard", empty], { env: { ...process.env, DDL_DATA_DIR: join(dir, "chua-co") }, encoding: "utf8" });
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(readFileSync(empty, "utf8")), { entries: [] });
  // thiếu đường dẫn thì báo lỗi, không bật server
  const r3 = spawnSync(process.execPath, ["server.js", "--export-leaderboard"], { encoding: "utf8", timeout: 10000 });
  assert.equal(r3.status, 1);
  exportLeaderboard(join(dir, "lib.json"), dir);
  assert.equal(JSON.parse(readFileSync(join(dir, "lib.json"), "utf8")).entries.length, 3);
});

test("L11: API server: POST lưu điểm, GET đọc lại, dữ liệu sai bị từ chối 400", async () => {
  const dir = tmp();
  process.env.DDL_DATA_DIR = dir;
  const server = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (body) => fetch(`${base}/api/leaderboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
    let r = await post({ name: "Nguoi_Choi", score: 777, nights_won: 3, seed: 42 });
    assert.equal(r.status, 200);
    const ok = await r.json();
    assert.equal(ok.rank, 1);
    assert.equal(ok.entry.name, "Nguoi_Choi");
    r = await post({ name: "ab", score: 1, nights_won: 0, seed: 1 });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /3 đến 12/);
    r = await post({ name: "HopLe", score: -5, nights_won: 0, seed: 1 });
    assert.equal(r.status, 400);
    r = await post("không phải json");
    assert.equal(r.status, 400);
    r = await fetch(`${base}/api/leaderboard`);
    assert.deepEqual((await r.json()).entries.map((e) => e.name), ["Nguoi_Choi"]);
    assert.equal((await fetch(`${base}/api/leaderboard`, { method: "DELETE" })).status, 405);
    assert.equal((await fetch(`${base}/api/bench-result`, { method: "POST", body: "{}" })).status, 404, "không ở chế độ benchmark thì từ chối");
  } finally {
    server.close();
    delete process.env.DDL_DATA_DIR;
  }
});

test("L12: server phục vụ mọi module web mà main.js import, và không lộ file ngoài danh sách", async () => {
  const server = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const imports = new Set();
    for (const f of readdirSync("web").filter((x) => x.endsWith(".js"))) {
      for (const m of readFileSync(join("web", f), "utf8").matchAll(/from "(\/[^"]+)"/g)) imports.add(m[1]);
    }
    assert.ok(imports.size >= 8);
    for (const url of imports) assert.equal((await fetch(base + url)).status, 200, url);
    assert.equal((await fetch(`${base}/?bench=1`)).status, 200);
    for (const bad of ["/package.json", "/server.js", "/data/leaderboard.json", "/../package.json", "/%2e%2e/package.json", "/src/headless/cli.js"]) {
      assert.notEqual((await fetch(base + bad)).status, 200, bad);
    }
  } finally {
    server.close();
  }
});

// ---------- Đổi phím (mục 4) ----------
test("K1: đổi phím hợp lệ, phím cũ được giải phóng, bản gốc không bị sửa", () => {
  const r = rebind(DEFAULT_KEYS, "jump", "Z");
  assert.equal(r.ok, true);
  assert.equal(r.keys.jump, "z");
  assert.equal(DEFAULT_KEYS.jump, " ", "không sửa object gốc");
  const r2 = rebind(r.keys, "dash", " "); // phím Space vừa được nhả nên gán được
  assert.equal(r2.ok, true);
});

test("K2: phát hiện trùng phím và báo hành động đang dùng nó", () => {
  const r = rebind(DEFAULT_KEYS, "pulse", "e");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "conflict");
  assert.equal(r.with, "interact");
  assert.match(r.message, /Nạp \/ châm dầu/);
  assert.equal(rebind(DEFAULT_KEYS, "interact", "e").ok, true, "gán lại đúng phím hiện tại của chính nó thì không coi là trùng");
});

test("K3: phím hệ thống không gán được; hành động lạ và phím vô hiệu bị từ chối", () => {
  for (const k of ["Escape", "Enter", "ArrowLeft", "F3", "Tab"]) assert.equal(rebind(DEFAULT_KEYS, "jump", k).reason, "reserved", k);
  assert.equal(rebind(DEFAULT_KEYS, "bay", "x").reason, "unknown_action");
  assert.equal(rebind(DEFAULT_KEYS, "jump", "Dead").reason, "invalid");
  assert.equal(rebind(DEFAULT_KEYS, "jump", "").reason, "invalid");
});

test("K4: đủ 9 hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), mặc định không trùng", () => {
  assert.deepEqual(ACTIONS.map((a) => a.id), ["up", "down", "left", "right", "jump", "dash", "interact", "pulse", "pause"]);
  assert.equal(new Set(Object.values(DEFAULT_KEYS)).size, 9);
  assert.deepEqual(findConflicts(DEFAULT_KEYS), []);
  assert.deepEqual(findConflicts({ ...DEFAULT_KEYS, pulse: "e" }), [["interact", "pulse"]]);
});

test("K5: sanitizeKeys: thiếu thì lấy mặc định, cấu hình hỏng (trùng, phím cấm) thì khôi phục mặc định", () => {
  assert.deepEqual(sanitizeKeys(null), DEFAULT_KEYS);
  assert.deepEqual(sanitizeKeys({ jump: "z" }), { ...DEFAULT_KEYS, jump: "z" });
  assert.deepEqual(sanitizeKeys({ jump: "e" }), DEFAULT_KEYS, "trùng với interact");
  assert.deepEqual(sanitizeKeys({ jump: "Escape" }), DEFAULT_KEYS);
  assert.deepEqual(sanitizeKeys("rác"), DEFAULT_KEYS);
});

// ---------- Benchmark (mục 1) ----------
test("B1: cảnh benchmark: đúng 200 Bóng Mực wander và 100 đom đóm trên đảo, L1 đến L3 sáng fuel 100, Mây ở (0,0,0)", () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades.length, 200);
  assert.equal(sc.motes.length, 100);
  assert.ok(sc.shades.every((s) => s.state === "wander" && Math.hypot(s.pos[0], s.pos[2]) <= 38));
  assert.ok(sc.motes.every((m) => Math.hypot(m[0], m[2]) <= 38));
  assert.deepEqual(sc.lanterns, ["L1", "L2", "L3"].map((id) => ({ id, lit: true, fuel: 100 })));
  assert.deepEqual(sc.player.pos, [0, 0, 0]);
  const g = new Game({ seed: 42, night: 1, scenario: sc, bench: true });
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.deepEqual(g.lanterns.map((l) => l.lit), [true, true, true, false, false]);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.fuelU === 6000));
});

test("B2: cảnh benchmark tất định theo seed và khác nhau giữa các seed", () => {
  assert.deepEqual(benchScenario(42), benchScenario(42));
  assert.notDeepEqual(benchScenario(42).shades, benchScenario(43).shades);
});

test("B3: Bóng Mực xuất phát ngoài vùng an toàn 6 m của L1 đến L3 và vị trí đèn khớp bản đồ", () => {
  const lamps = MAPS[1].lanterns.slice(0, 3);
  for (const s of benchScenario(42).shades) for (const l of lamps) assert.ok(Math.hypot(s.pos[0] - l[0], s.pos[2] - l[2]) >= 6, "ngoài vùng an toàn");
  assert.equal(lamps.length, 3);
});

test("B4: trong chế độ bench, 600 tick không có sát thương, nhặt, hao dầu, sinh thêm hay kết thúc; Bóng Mực vẫn wander và di chuyển", () => {
  const g = new Game({ seed: 42, night: 1, scenario: benchScenario(42), bench: true });
  const before = g.shades.map((s) => [...s.pos]);
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: true, pulse: true, dash: true, pause: false };
  for (let i = 0; i < 600; i++) g.step(idle);
  assert.equal(g.state, "playing");
  assert.equal(g.timeLeftTicks, 240 * 60, "không đếm ngược");
  assert.equal(g.player.flames, 3);
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.equal(g.player.carried, 0);
  assert.equal(g.motes.length, 100);
  assert.equal(g.shades.length, 200);
  assert.equal(g.drifters.length, 0);
  assert.ok(g.lanterns.slice(0, 3).every((l) => l.lit && l.fuelU === 6000), "không hao dầu");
  assert.ok(g.shades.every((s) => s.state === "wander"), "vẫn ở wander, không chuyển sang đuổi");
  const moved = g.shades.filter((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][2]) > 1).length;
  assert.ok(moved > 150, `đa số Bóng Mực phải di chuyển (${moved}/200)`);
  assert.equal(g.events.length, 0);
});

test("B5: tắt bench thì Game cư xử như cũ (đầu ra headless không đổi): đêm đầy đủ thua/thắng đúng luật", () => {
  const g = new Game({ seed: 1, night: 1, scenario: { time_left_s: 1, lanterns: ["L1", "L2", "L3"].map((id) => ({ id, lit: true })), random_shades: false } });
  assert.equal(g.bench, false);
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (let i = 0; i < 80; i++) g.step(idle);
  assert.equal(g.state, "won");
});

test("B6: camera benchmark: tâm (0,0,0), bán kính 30, cao 15, xuất phát (30,15,0), ngược chiều kim đồng hồ khi nhìn từ trên xuống, 15 s một vòng", () => {
  const at = (t) => benchCamera(t).pos;
  const [x0, y0, z0] = at(0);
  near(x0, 30);
  near(y0, 15);
  near(z0, 0);
  const q = at(3.75); // 1/4 vòng: từ +X sang -Z (hệ tay phải, nhìn từ +Y xuống là ngược chiều kim đồng hồ)
  near(q[0], 0, 1e-9);
  near(q[2], -30, 1e-9);
  const h = at(7.5);
  near(h[0], -30, 1e-9);
  near(h[2], 0, 1e-9);
  const f = at(15);
  near(f[0], 30, 1e-9);
  near(f[2], 0, 1e-9);
  for (const t of [0, 1.3, 4.4, 9.9, 14.2]) {
    const p = at(t);
    near(Math.hypot(p[0], p[2]), 30, 1e-9);
    near(p[1], 15);
  }
  assert.deepEqual(benchCamera(2).look, [0, 0, 0]);
  assert.equal(BENCH.warmup_s, 3);
  assert.deepEqual(BENCH.window, [1280, 720]);
});

test("B7: số liệu khung hình theo đúng định nghĩa của ticket", () => {
  // 100 khung: 99 khung 10 ms và 1 khung 110 ms. Σdt = 1100 ms
  const dts = [...Array(99).fill(10), 110];
  const s = benchStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round(((1000 * 100) / 1100) * 10) / 10); // 90.9
  // k = max(1, ceil(0.01 × 100)) = 1: giá trị dt lớn nhất = 110 ms => 1000/110 = 9.09
  assert.equal(s.p1_low_fps, 9.1);
  // phân vị 95 (nearest-rank): phần tử thứ ceil(0.95 × 100) = 95 của dãy tăng dần = 10 ms
  assert.equal(s.frame_ms_p95, 10);
  // 250 khung: k = ceil(2.5) = 3 giá trị lớn nhất
  const dts2 = [...Array(247).fill(5), 30, 60, 90];
  const s2 = benchStats(dts2);
  assert.equal(s2.p1_low_fps, Math.round((1000 / ((30 + 60 + 90) / 3)) * 10) / 10); // 16.7
  assert.equal(s2.frames, 250);
  assert.throws(() => benchStats([]));
});

// ---------- Soak (mục 2) ----------
test("O1: Đêm thứ i xoay vòng 1, 2, 3 và dùng seed gốc + i", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(nightFor), [1, 2, 3, 1, 2, 3, 1, 2, 3, 1]);
  assert.deepEqual([1, 2, 10].map((i) => seedFor(7, i)), [8, 9, 17]);
});

test("O2: nguồn input ngẫu nhiên: đổi hướng mỗi 30 tick, xác suất các nút gần 5% / 3% / 2% / 10%", () => {
  const src = makeInputSource(8);
  const N = 60000;
  const cnt = { jump: 0, dash: 0, pulse: 0, interact: 0 };
  let prev = null;
  let changes = 0;
  for (let t = 0; t < N; t++) {
    const i = src(t);
    for (const k of Object.keys(cnt)) if (i[k]) cnt[k]++;
    const key = i.move.join(",");
    if (prev !== null && key !== prev) {
      changes++;
      assert.equal(t % 30, 0, "hướng chỉ đổi ở tick chia hết cho 30");
    }
    prev = key;
    near(Math.hypot(...i.move), 1, 1e-9);
  }
  assert.ok(changes > N / 30 - 5);
  const pct = (k) => (100 * cnt[k]) / N;
  near(pct("jump"), 5, 0.4);
  near(pct("dash"), 3, 0.4);
  near(pct("pulse"), 2, 0.3);
  near(pct("interact"), 10, 0.6);
});

test("O3: soak tất định theo seed, 0 crash, mọi kết quả là won hoặc lost", () => {
  const a = runSoak({ seed: 7, nights: 6 });
  const b = runSoak({ seed: 7, nights: 6 });
  assert.deepEqual(a, b);
  assert.equal(a.crashes, 0);
  assert.equal(a.results.length, 6);
  assert.ok(a.results.every((r) => r === "won" || r === "lost"), a.results.join());
  assert.equal(runSoakNight(2, 9).result === "timeout", false, "đêm luôn kết thúc trong thời lượng chuẩn");
});

test("O4: soak đếm crash và vẫn chạy tiếp các đêm sau khi một đêm lỗi", () => {
  const r = runSoak({ seed: 7, nights: 3, hooks: { afterFirstLoad: () => { throw new Error("giả lập hỏng"); } } });
  assert.equal(r.crashes, 1);
  assert.equal(r.results[0], "crashed");
  assert.equal(r.results.length, 3);
  assert.match(r.errors[0], /giả lập hỏng/);
});

test("O5: lệnh soak thật ghi đúng định dạng và đạt ngưỡng; sai tham số thoát mã 1", () => {
  const out = join(tmp(), "soak.json");
  const r = spawnSync(process.execPath, ["scripts/soak.mjs", "--seed", "7", "--nights", "10", "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const s = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(s), ["nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"]);
  assert.equal(s.nights, 10);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 10);
  assert.ok(s.mem_start_mb > 0 && s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} > 1.2 × ${s.mem_start_mb}`);
  assert.ok(s.duration_s >= 0);
  assert.equal(spawnSync(process.execPath, ["scripts/soak.mjs", "--seed", "x", "--out", out]).status, 1);
  assert.equal(spawnSync(process.execPath, ["scripts/soak.mjs", "--seed", "7"]).status, 1);
});

test("O6: lệnh bench từ chối tham số sai (không mở trình duyệt)", () => {
  assert.equal(spawnSync(process.execPath, ["scripts/bench.mjs", "--seed", "1.5", "--out", "x.json"]).status, 1);
  assert.equal(spawnSync(process.execPath, ["scripts/bench.mjs", "--duration", "0", "--out", "x.json"]).status, 1);
  assert.equal(spawnSync(process.execPath, ["scripts/bench.mjs", "--duration", "5"]).status, 1);
});

// ---------- Tiếp cận (mục 4) và đóng gói (mục 5, 6) ----------
test("A1: mọi chữ trong giao diện >= 18 px ở 1280x720 và chữ lớn đúng ×1.25", () => {
  const html = readFileSync("web/index.html", "utf8");
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const base = Number(css.match(/html\s*\{\s*font-size:\s*(\d+(?:\.\d+)?)px/)[1]);
  const big = Number(css.match(/html\.big\s*\{\s*font-size:\s*(\d+(?:\.\d+)?)px/)[1]);
  assert.ok(base >= 18, `cỡ gốc ${base}px`);
  assert.equal(big, base * 1.25);
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)(px|rem|em)/g)].filter((m) => !/html(\.big)?\s*\{/.test(css.slice(Math.max(0, m.index - 20), m.index)));
  assert.ok(sizes.length >= 15, `phải có nhiều khai báo cỡ chữ để kiểm (có ${sizes.length})`);
  for (const m of sizes) {
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * base;
    assert.ok(px >= 18 - 1e-9, `font-size ${m[0]} = ${px}px < 18px`);
  }
});

test("A2: mọi id mà main.js tham chiếu đều có trong index.html (không sót phần tử giao diện)", () => {
  const html = readFileSync("web/index.html", "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const main = readFileSync("web/main.js", "utf8");
  const used = new Set([...main.matchAll(/\$\("([^"$`]+)"\)/g)].map((m) => m[1]));
  for (const id of used) assert.ok(ids.has(id), `thiếu #${id} trong index.html`);
  // id dựng từ tiền tố (form lưu điểm) cũng phải có
  for (const p of ["res", "dawn"]) for (const s of ["save", "name", "msg"]) assert.ok(ids.has(`${p}-${s}`), `${p}-${s}`);
  for (const id of ["menu", "leaderboard", "settings", "captions", "shade-arrows", "flash", "s-cap", "s-rm", "s-big", "keys", "key-msg", "b-keys-reset", "b-menu-lb"]) assert.ok(ids.has(id), id);
});

test("A3: tùy chọn giảm chuyển động tắt rung camera và chớp màn hình; có phụ đề cho 4 tình huống", () => {
  const main = readFileSync("web/main.js", "utf8");
  assert.match(main, /if \(!settings\.reduceMotion\)[\s\S]{0,200}shakeT = /, "rung camera chỉ khi không giảm chuyển động");
  assert.match(main, /if \(shakeT > 0 && !settings\.reduceMotion\)/);
  assert.match(main, /Bóng Mực xuất hiện/);
  assert.match(main, /Gió mạnh sắp thổi/);
  assert.match(main, /giây tới bình minh/);
  assert.match(main, /sắp cạn dầu/);
  assert.match(main, /earrow/, "mũi tên ở mép màn hình");
});

test("P1: gói phát hành đủ: README, CHANGELOG 4 phase, CREDITS, LICENSE, CLAUDE.md, skill, hook, CI", () => {
  for (const f of ["README.md", "CHANGELOG.md", "CREDITS.md", "LICENSE", "CLAUDE.md", ".github/workflows/test.yml", ".claude/skills/verify-headless/SKILL.md"]) assert.ok(existsSync(f), f);
  const change = readFileSync("CHANGELOG.md", "utf8");
  for (const h of ["Phase 4", "Phase 3", "Phase 2", "Phase 1"]) assert.ok(change.includes(h), `CHANGELOG thiếu ${h}`);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const s of ["start", "test", "proof", "bench", "soak"]) assert.ok(pkg.scripts[s], `package.json thiếu script ${s}`);
  const c = JSON.parse(readFileSync("game.contract.json", "utf8"));
  for (const k of ["bench_cmd", "soak_cmd"]) assert.ok(existsSync(c[k].split(" ").at(-1)), `${k} trỏ tới file không tồn tại: ${c[k]}`);
  const credits = readFileSync("CREDITS.md", "utf8");
  for (const w of ["three", "Claude"]) assert.ok(credits.toLowerCase().includes(w.toLowerCase()), `CREDITS thiếu ${w}`);
});

test("P2: bench.json và soak.json (nếu đã sinh) đúng định dạng của ticket", () => {
  if (existsSync("docs/proof/phase4/bench.json")) {
    const b = JSON.parse(readFileSync("docs/proof/phase4/bench.json", "utf8"));
    assert.deepEqual(Object.keys(b), ["contract_version", "avg_fps", "p1_low_fps", "frame_ms_p95", "frames", "load_ms", "peak_mem_mb", "vsync_off", "renderer", "os"]);
    assert.equal(b.contract_version, "1.3");
    assert.ok(b.frames > 0 && b.avg_fps > 0 && b.p1_low_fps > 0 && b.p1_low_fps <= b.avg_fps * 1.0001);
    assert.ok(typeof b.renderer === "string" && typeof b.os === "string" && typeof b.vsync_off === "boolean");
    assert.ok(b.peak_mem_mb === null || b.peak_mem_mb > 0);
    // avg_fps = 1000 × N / Σdt nên N / avg_fps ≈ thời gian đo (giây): phải gần --duration
    near(b.frames / b.avg_fps, 30, 0.6);
  }
  if (existsSync("docs/proof/phase4/soak.json")) {
    const s = JSON.parse(readFileSync("docs/proof/phase4/soak.json", "utf8"));
    assert.deepEqual(Object.keys(s), ["nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"]);
    assert.equal(s.nights, 10);
    assert.equal(s.crashes, 0);
    assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb);
  }
});
