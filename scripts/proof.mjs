// Tạo bằng chứng Phase 4: chạy lệnh THẬT (headless, soak, xuất bảng xếp hạng) với các kịch bản,
// kiểm tra kết quả theo yêu cầu, lưu output và bảng kết quả vào docs/proof/phase4/.
// Dùng: npm run proof        (chạy lại ở đúng tag thì ra cùng kết quả)
// Bằng chứng Phase 1 đến 3 nằm ở docs/proof/phase1, phase2, phase3 (sinh bởi mã ở đúng tag đó, giữ nguyên để so khớp tag).
// bench.json KHÔNG sinh ở đây (cần Chrome và GPU, CI không có): chạy `npm run bench` trên máy thật rồi commit; ở đây chỉ kiểm định dạng.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const OUT = "docs/proof/phase4";
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "ddl-proof-"));
const base = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
const lit4 = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
const press = (t, k) => [{ tick: t, [k]: true }, { tick: t + 1, [k]: false }];
const snap = (L, t) => L.find((l) => l.type === "snapshot" && l.tick === t);
const ev = (L, n) => L.filter((l) => l.type === "event" && l.name === n);
const close = (a, b, e) => Math.abs(a - b) <= e;

const lantern = (id, pos, fuel) => ({ id, pos, lit: true, ...(fuel === undefined ? {} : { fuel }) });
const lit = (...ids) => ids.map((id) => ({ id, lit: true }));
const cases = [
  { id: "W01-fuel-decay", req: "T1", night: 1, what: "Đèn sáng hao 1 fuel/giây: 600 tick từ 100 còn 90.0; đèn tắt fuel 0",
    scenario: { ...base, lanterns: lit("L1") }, ticks: 600,
    check: (L) => snap(L, 600).lanterns[0].fuel === 90 && snap(L, 600).lanterns[1].fuel === 0 },
  { id: "W02-lantern-out", req: "T1", night: 1, what: "Hết dầu (fuel 0.5) ở tick 30: lantern_out, deposited 0, ever_lit true",
    scenario: { ...base, lanterns: [lantern("L1", [20, 0, 20], 0.5)] }, ticks: 40,
    check: (L) => { const e = ev(L, "lantern_out")[0]; const l = snap(L, 30).lanterns[0]; return e?.tick === 30 && !l.lit && l.deposited === 0 && l.ever_lit && l.fuel === 0; } },
  { id: "W03-refuel", req: "T2", night: 1, what: "Châm dầu fuel 40 mang 10: dùng 7 đom đóm, fuel 100, +35 điểm, sự kiện refuel",
    scenario: { ...base, player: { carried: 10 }, lanterns: [lantern("L1", [0, 0, 1], 40)] }, frames: press(0, "interact"), ticks: 3,
    check: (L) => { const e = ev(L, "refuel")[0]; return e?.data.amount === 7 && e.data.fuel === 100 && snap(L, 1).score === 35 && snap(L, 1).player.carried === 3; } },
  { id: "W04-relight", req: "T3", night: 1, what: "Thắp lại đèn đã từng sáng: 5 đom đóm, +40, lantern_lit relight:true, relit_count 1",
    scenario: { ...base, player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: false, ever_lit: true }] }, frames: press(0, "interact"), ticks: 3,
    check: (L) => ev(L, "lantern_lit")[0]?.data.relight === true && snap(L, 1).score === 65 && snap(L, 1).lanterns[0].relit_count === 1 },
  { id: "W05-first-light", req: "T3, T8", night: 1, what: "Thắp lần đầu 10 đom đóm: +100, fuel 100; thắp đủ 5/5 đèn không kết thúc đêm",
    scenario: { ...base, player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit("L2", "L3", "L4", "L5")] }, frames: press(0, "interact"), ticks: 60,
    check: (L) => ev(L, "lantern_lit")[0]?.data.relight === false && snap(L, 1).score === 150 && ev(L, "game_over").length === 0 && L.at(-1).state === "playing" },
  { id: "W06-drain", req: "T5, T6", night: 1, what: "Bóng Mực wander tới đèn yếu (fuel 20), drain đứng yên hút 6 fuel/giây, fuel_drain mỗi 60 tick, đèn tắt rồi bóng rời drain",
    scenario: { ...base, lanterns: [lantern("L1", [20, 0, 0], 20)], shades: [{ pos: [26, 1, 0], state: "wander" }] }, ticks: 400,
    check: (L) => {
      const d = L.filter((l) => l.type === "snapshot").find((s) => s.shades[0].state === "drain");
      if (!d) return false;
      const f = ev(L, "fuel_drain");
      const rate = snap(L, d.tick + 60).lanterns[0].fuel - snap(L, d.tick + 120).lanterns[0].fuel;
      return f.length >= 2 && f[1].tick - f[0].tick === 60 && Math.abs(rate - 6) < 0.15 && ev(L, "lantern_out").length === 1 && L.filter((l) => l.type === "snapshot").at(-1).shades[0].state !== "drain";
    } },
  { id: "W07-safe-zone-threshold", req: "T4", night: 1, what: "Đèn fuel 100: Bóng Mực không vào 6 m. Đèn fuel 20 (mất vùng an toàn): Bóng Mực vào tới ≤ 2 m để hút",
    scenario: { ...base, player: { pos: [20, 0, -25] }, lanterns: [lantern("L1", [20, 0, 0]), lantern("L2", [-20, 0, 0], 20)], shades: [{ pos: [14, 1, 0], state: "wander", target_lantern_id: "L1" }, { id: "S2", pos: [-14, 1, 0], state: "wander" }] }, ticks: 300,
    check: (L) => {
      const S = L.filter((l) => l.type === "snapshot");
      const near = (s, i, c) => Math.hypot(s.shades[i].pos[0] - c, s.shades[i].pos[2]);
      return S.every((s) => near(s, 0, 20) >= 5.99) && S.some((s) => near(s, 1, -20) <= 2.01);
    } },
  { id: "W08-refuel-push", req: "T7", night: 1, what: "Châm dầu lên ≥ 30 lúc Bóng Mực drain trong 6 m: bị đẩy ra mép, không sát thương",
    scenario: { ...base, player: { pos: [9, 0, 0], carried: 4 }, lanterns: [lantern("L1", [10, 0, 0], 20)], shades: [{ pos: [10.5, 1, 0], state: "drain" }] }, frames: press(0, "interact"), ticks: 60,
    check: (L) => ev(L, "refuel").length === 1 && ev(L, "player_hit").length === 0 && Math.hypot(snap(L, 60).shades[0].pos[0] - 10, snap(L, 60).shades[0].pos[2]) >= 5.99 },
  { id: "W09-dawn-win", req: "T8, T10", night: 1, what: "Bình minh với 3/5 đèn sáng: thắng dawn_survived, điểm 3 x (50 + 99) + 3 x 50 = 597",
    scenario: { ...base, time_left_s: 1, lanterns: lit("L1", "L2", "L3") }, ticks: 100,
    check: (L) => ev(L, "game_over")[0]?.data.reason === "dawn_survived" && L.at(-1).state === "won" && L.at(-1).score === 597 && L.at(-1).ticks === 60 },
  { id: "W10-dawn-lose", req: "T8", night: 1, what: "Bình minh chỉ còn 2/5 đèn sáng (cần 3): thua dawn, không có điểm bình minh",
    scenario: { ...base, time_left_s: 1, lanterns: lit("L1", "L2") }, ticks: 100,
    check: (L) => ev(L, "game_over")[0]?.data.reason === "dawn" && L.at(-1).state === "lost" && L.at(-1).score === 0 },
  { id: "W11-no-early-win", req: "T8", night: 1, what: "Cả 5 đèn sáng từ đầu nhưng đêm không kết thúc sớm, tới tick 300 mới thắng: 5 x (50 + 95) + 150 = 875",
    scenario: { ...base, time_left_s: 5, lanterns: lit("L1", "L2", "L3", "L4", "L5") }, ticks: 1000,
    check: (L) => snap(L, 299).state === "playing" && L.at(-1).ticks === 300 && L.at(-1).score === 875 },
  { id: "W12-no-flames-dawn", req: "T8", night: 1, what: "Hết lửa đúng tick bình minh dù đủ đèn: luôn thua no_flames",
    scenario: { ...base, time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lit("L1", "L2", "L3", "L4", "L5"), shades: [{ pos: [0.5, 1, 0] }] }, ticks: 5,
    check: (L) => ev(L, "game_over")[0]?.data.reason === "no_flames" },
  { id: "W13-capacity", req: "T9", night: 1, what: "successful_lights 3 thì sức chứa 16; thắp một đèn tăng thêm 2",
    scenario: { ...base, player: { successful_lights: 3, carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] }, frames: press(0, "interact"), ticks: 3,
    check: (L) => snap(L, 0).player.capacity === 16 && snap(L, 1).player.capacity === 18 },
  { id: "W14-pulse-drain", req: "T6, T10", night: 1, what: "Tỏa sáng trúng Bóng Mực đang drain: stunned và +15 điểm (thường là +5)",
    scenario: { ...base, player: { carried: 3 }, lanterns: [lantern("L1", [4, 0, 0], 20)], shades: [{ pos: [4, 1, 0], state: "drain" }] }, frames: press(0, "pulse"), ticks: 3,
    check: (L) => snap(L, 1).shades[0].state === "stunned" && snap(L, 1).score === 15 },
  { id: "W15-threshold-night2", req: "T8", night: 2, what: "Đêm 2 cần 4/6 đèn: 4 đèn sáng thì thắng",
    scenario: { ...base, time_left_s: 1, lanterns: lit("L1", "L2", "L3", "L4") }, ticks: 100,
    check: (L) => L.at(-1).state === "won" },
  { id: "W16-threshold-night3", req: "T8", night: 3, what: "Đêm 3 cần 5/7 đèn: 4 đèn sáng thì thua dawn",
    scenario: { ...base, time_left_s: 1, lanterns: lit("L1", "L2", "L3", "L4") }, ticks: 100,
    check: (L) => L.at(-1).state === "lost" && ev(L, "game_over")[0].data.reason === "dawn" },
  ...[1, 2, 3].map((n) => ({
    id: `W17-full-night${n}`, req: "T11", night: n, what: `Đêm ${n} đầy đủ (ngẫu nhiên bật, seed 42, ${[14400, 16200, 18000][n - 1]} tick): chạy ≤ 30 s, tất định (2 lần giống hệt)`,
    scenario: { player: { flames: 1000 } }, frames: [{ tick: 0, move: [0.4, 1] }], ticks: [14400, 16200, 18000][n - 1], seed: 42, extra: ["--snapshot-every", "600"], determinism: true, timed: true,
    check: (L) => L.at(-1).type === "end" && L[0].night === n && L.at(-1).state !== "playing",
  })),
];

function runCli(c, outName) {
  const scnFile = join(tmp, `${c.id}.scn.json`);
  writeFileSync(scnFile, JSON.stringify(c.scenario));
  const args = ["src/headless/cli.js", "--seed", String(c.seed ?? 1), "--night", String(c.night), "--scenario", scnFile, "--ticks", String(c.ticks), "--out", outName, ...(c.extra ?? ["--snapshot-every", "1"])];
  if (c.frames) {
    const f = join(tmp, `${c.id}.in.json`);
    writeFileSync(f, JSON.stringify({ frames: c.frames }));
    args.push("--inputs", f);
  }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { r, ms: Date.now() - t0 };
}

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 12);
const rows = [];
let failed = 0;
for (const c of cases) {
  const out = join(OUT, `${c.id}.jsonl`);
  const { r, ms } = runCli(c, out);
  let ok = r.status === 0;
  let note = "";
  if (ok) {
    const L = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    ok = !!c.check(L);
    if (c.timed) {
      note += `${(ms / 1000).toFixed(2)} s`;
      ok = ok && ms <= 30000;
    }
    if (c.determinism) {
      const out2 = join(tmp, `${c.id}.again.jsonl`);
      const { r: r2 } = runCli(c, out2);
      const same = r2.status === 0 && readFileSync(out, "utf8") === readFileSync(out2, "utf8");
      note += `${note ? ", " : ""}${same ? `tất định: 2 lần giống hệt (sha256 ${sha(out)})` : "tất định: KHÁC NHAU"}`;
      ok = ok && same;
    }
  } else note = `thoát mã ${r.status}: ${r.stderr.trim()}`;
  if (!ok) failed++;
  rows.push(`| ${c.id} | ${c.req} | ${c.what} | \`${out.replaceAll("\\", "/")}\` | ${ok ? "ĐẠT" : "KHÔNG ĐẠT"}${note ? " (" + note + ")" : ""} |`);
  console.log(`${ok ? "DAT   " : "KHONG "} ${c.id}`);
}

// Mã thoát 2 với file sai định dạng
const badFile = join(tmp, "bad.json");
writeFileSync(badFile, JSON.stringify({ frames: [{ tick: 3 }, { tick: 3 }] }));
const bad = spawnSync(process.execPath, ["src/headless/cli.js", "--seed", "1", "--night", "3", "--inputs", badFile, "--ticks", "10", "--out", join(tmp, "x")], { encoding: "utf8" });
const badOk = bad.status === 2 && bad.stderr.length > 0;
if (!badOk) failed++;
rows.push(`| W18-bad-inputs | T11 | inputs có tick trùng thì thoát mã 2, báo lỗi ra stderr | (không có file) | ${badOk ? "ĐẠT" : "KHÔNG ĐẠT"} (mã ${bad.status}) |`);
console.log(`${badOk ? "DAT   " : "KHONG "} W18-bad-inputs`);

// ---- Phase 4 ----
const addRow = (id, req, what, out, ok, note = "") => {
  if (!ok) failed++;
  rows.push(`| ${id} | ${req} | ${what} | ${out} | ${ok ? "ĐẠT" : "KHÔNG ĐẠT"}${note ? " (" + note + ")" : ""} |`);
  console.log(`${ok ? "DAT   " : "KHONG "} ${id}`);
};

// P01: soak thật (10 đêm, seed 7)
const soakOut = join(OUT, "soak.json");
const soak = spawnSync(process.execPath, ["scripts/soak.mjs", "--seed", "7", "--nights", "10", "--out", soakOut], { encoding: "utf8" });
let soakNote = `thoát mã ${soak.status}`;
let soakOk = soak.status === 0;
if (existsSync(soakOut)) {
  const j = JSON.parse(readFileSync(soakOut, "utf8"));
  soakOk = soakOk && j.nights === 10 && j.crashes === 0 && j.mem_end_mb <= 1.2 * j.mem_start_mb && j.results.length === 10;
  soakNote = `crashes ${j.crashes}, bộ nhớ ${j.mem_start_mb} → ${j.mem_end_mb} MB (tỉ lệ ${(j.mem_end_mb / j.mem_start_mb).toFixed(2)}, ngưỡng 1.20), ${j.duration_s} s, kết quả: ${j.results.join("/")}`;
}
addRow("P01-soak", "U5", "Soak 10 đêm liên tiếp trong một tiến trình, seed 7: 0 crash, bộ nhớ cuối ≤ 1.2 × đầu", `\`${soakOut.replaceAll("\\", "/")}\``, soakOk, soakNote);

// P02: lệnh xuất bảng xếp hạng thật, đúng thứ tự
{
  const dir = join(tmp, "lb");
  const lbMod = await import("../src/headless/leaderboard-store.js");
  process.env.DDL_DATA_DIR = dir;
  const t = new Date("2026-06-01T10:00:00+07:00").getTime();
  for (const [i, [n, sc, nw]] of [["Binh_Minh", 850, 3], ["Dau_Tien", 400, 1], ["Ve_Sau", 400, 1], ["Dem_Mot", 0, 0], ["Mây_Nhỏ", 920, 3]].entries()) lbMod.submitScore({ name: n, score: sc, nights_won: nw, seed: 42 }, dir, new Date(t + i * 1000));
  delete process.env.DDL_DATA_DIR;
  const out = join(OUT, "leaderboard-export.json");
  const r = spawnSync(process.execPath, ["server.js", "--export-leaderboard", out], { env: { ...process.env, DDL_DATA_DIR: dir }, encoding: "utf8" });
  let ok = r.status === 0;
  let note = `thoát mã ${r.status}`;
  if (ok) {
    const names = JSON.parse(readFileSync(out, "utf8")).entries.map((e) => e.name);
    ok = JSON.stringify(names) === JSON.stringify(["Mây_Nhỏ", "Binh_Minh", "Dau_Tien", "Ve_Sau", "Dem_Mot"]);
    note = `thứ tự: ${names.join(" > ")} (bằng điểm: ai đạt trước đứng trên)`;
  }
  addRow("P02-leaderboard-export", "U6", "npm start -- --export-leaderboard ra {entries} đúng thứ tự (điểm giảm dần, bằng điểm thì đạt trước đứng trên)", `\`${out.replaceAll("\\", "/")}\``, ok, note);
}

// P03: bench.json (do `npm run bench` sinh trên máy thật): kiểm định dạng và công thức, không đo lại ở đây
{
  const f = join(OUT, "bench.json");
  if (!existsSync(f)) addRow("P03-bench-file", "U1", "bench.json do `npm run bench` sinh trên máy thật", "(chưa có file)", false, "chưa chạy npm run bench");
  else {
    const b = JSON.parse(readFileSync(f, "utf8"));
    const keys = ["contract_version", "avg_fps", "p1_low_fps", "frame_ms_p95", "frames", "load_ms", "peak_mem_mb", "vsync_off", "renderer", "os"];
    const ok = JSON.stringify(Object.keys(b)) === JSON.stringify(keys) && b.contract_version === "1.3" && b.frames > 0 && Math.abs(b.frames / b.avg_fps - 30) < 0.6;
    addRow("P03-bench-file", "U1", "bench.json đúng 10 trường, contract 1.3, thời gian đo ≈ 30 s (frames / avg_fps)", `\`${f.replaceAll("\\", "/")}\``, ok, `avg_fps ${b.avg_fps}, p1_low_fps ${b.p1_low_fps}, p95 ${b.frame_ms_p95} ms, load ${b.load_ms} ms, vsync_off ${b.vsync_off} (số đo trên máy dev, không phải máy chấm)`);
  }
}

// P04: contract v1.3
{
  const c = JSON.parse(readFileSync("game.contract.json", "utf8"));
  addRow("P04-contract", "U12", "game.contract.json: contract_version 1.3 kèm bench_cmd, soak_cmd", "`game.contract.json`", c.contract_version === "1.3" && !!c.bench_cmd && !!c.soak_cmd, `${c.bench_cmd} · ${c.soak_cmd}`);
}

const unit = spawnSync(process.execPath, ["--test", "tests/core.test.js", "tests/phase2.test.js", "tests/phase3.test.js", "tests/phase4.test.js", "tests/cli.test.js"], { encoding: "utf8" });
const pick = (k) => (unit.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) ?? [])[1] ?? "?";
const git = (...a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();
const dirty = git("status", "--porcelain", "--", "src", "game.contract.json", "tests").length > 0;

const md = `# Bằng chứng Phase 4 (tự sinh bởi \`npm run proof\`)

- Mã nguồn: commit \`${git("rev-parse", "--short", "HEAD")}\`${dirty ? " (CÓ thay đổi chưa commit ở src/tests/contract)" : ""}
- Máy: ${process.platform} ${process.arch}, Node ${process.version}
- Test đơn vị và scenario: ${pick("pass")}/${pick("tests")} đạt, ${pick("fail")} lỗi (\`npm test\`)

Dòng W01 đến W18 chạy lệnh headless thật (\`node src/headless/cli.js ...\`) để chứng minh luật Phase 3 KHÔNG đổi sau Phase 4 (tiêu chí T1 đến T11 trong \`docs/notes/phase3-spec.md\`). Dòng P01 đến P04 là phần mới của Phase 4 (tiêu chí U trong \`docs/notes/phase4-spec.md\`).

| Kịch bản | Tiêu chí | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
${rows.join("\n")}

Bản web: ảnh chụp trong thư mục này do Chrome chạy ngầm chụp từ bản \`npm start\`: \`web-hud-captions.png\` (phụ đề, nhãn phím), \`web-settings.png\` (đổi phím, tùy chọn tiếp cận), \`web-leaderboard.png\` (bảng xếp hạng), \`web-big-text.png\` (chữ lớn + bảng màu dễ phân biệt). \`bench.json\` sinh bằng \`npm run bench\` trên máy phát triển (xem renderer và os trong file). Chưa kiểm chứng: chơi tay đủ 3 đêm, âm thanh nghe thật, rung camera và chớp màn hình nhìn tận mắt, số đo trên máy chấm của giảng viên (xem README, phần "Giới hạn").
`;
writeFileSync(join(OUT, "RESULTS.md"), md);
console.log(`\nGhi ${join(OUT, "RESULTS.md")}. Không đạt: ${failed}`);
process.exit(failed ? 1 : 0);
