// Tạo bằng chứng Phase 2: chạy lệnh headless THẬT (cùng lệnh giảng viên sẽ chạy) với các kịch bản,
// kiểm tra kết quả theo yêu cầu, lưu output JSONL và bảng kết quả vào docs/proof/phase2/.
// Dùng: npm run proof        (chạy lại ở đúng tag thì ra cùng kết quả)
// Bằng chứng Phase 1 nằm ở docs/proof/phase1 (sinh bởi mã ở tag phase-1, giữ nguyên để so khớp tag).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const OUT = "docs/proof/phase2";
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "ddl-proof-"));
const base = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
const lit4 = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
const press = (t, k) => [{ tick: t, [k]: true }, { tick: t + 1, [k]: false }];
const snap = (L, t) => L.find((l) => l.type === "snapshot" && l.tick === t);
const ev = (L, n) => L.filter((l) => l.type === "event" && l.name === n);
const close = (a, b, e) => Math.abs(a - b) <= e;

const cases = [
  { id: "Q01-accel", req: "S1", night: 1, what: "Chạy 60 tick đi 5.8 m (gia tốc 5 tick); tick 5 đạt 6 m/s", scenario: base, frames: [{ tick: 0, move: [0, 1] }], ticks: 60,
    check: (L) => close(snap(L, 60).player.pos[2], 5.8, 0.01) && close(snap(L, 5).player.vel[2], 6, 0.01) },
  { id: "Q02-dash", req: "S2", night: 1, what: "Lướt 12 tick ở 14 m/s (2.8 m), event dash; bấm lại trước 90 tick bị từ chối",
    scenario: base, frames: [...press(0, "dash"), ...press(60, "dash")], ticks: 30,
    check: (L) => ev(L, "dash").length === 1 && close(snap(L, 12).player.pos[2], 2.8, 0.01) },
  { id: "Q03-fall", req: "S3", night: 1, what: "Rơi khỏi đảo: 1 player_hit by fall (lost 5), hồi sinh sau 60 tick về (0,0,0) bất tử 90",
    scenario: { ...base, player: { pos: [39.9, 0, 0], carried: 5 } }, frames: [{ tick: 0, move: [1, 0] }], ticks: 300,
    check: (L) => {
      const f = ev(L, "player_hit").filter((e) => e.data.by === "fall");
      if (f.length !== 1 || f[0].data.lost !== 5) return false;
      const b = snap(L, f[0].tick + 60);
      return b.player.pos.join() === "0,0,0" && b.player.invuln === 90;
    } },
  { id: "Q04-shade-hit", req: "S4", night: 1, what: "Bóng Mực chạm: -1 lửa, rơi floor(7/2)=3 đom đóm (TTL 8 s), recoil 2 m, bất tử, chạm lại ở tick 91",
    scenario: { ...base, player: { carried: 7 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 100,
    check: (L) => {
      const h = ev(L, "player_hit");
      return h.length === 2 && h[0].tick === 1 && h[0].data.dropped === 3 && h[1].tick === 91 && snap(L, 1).motes.length === 3 && snap(L, 1).motes[0].ttl_s === 8;
    } },
  { id: "Q05-pulse", req: "S5", night: 1, what: "Tỏa sáng 3 đom đóm/5 m: choáng 120 tick, đẩy 4 m trong 15 tick, +5 điểm",
    scenario: { ...base, player: { carried: 5 }, shades: [{ pos: [3, 1, 0] }] }, frames: press(0, "pulse"), ticks: 125,
    check: (L) => snap(L, 120).shades[0].state === "stunned" && snap(L, 121).shades[0].state === "chase" && close(snap(L, 15).shades[0].pos[0], 7, 0.01) && snap(L, 1).score === 5 && snap(L, 1).player.carried === 2 },
  { id: "Q06-safe-zone", req: "S6", night: 1, what: "Đèn đã sáng: Bóng Mực không vào trong 6 m trong 1200 tick, Mây đứng cạnh đèn không mất lửa",
    scenario: { ...base, player: { pos: [20, 0, 0] }, lanterns: [{ id: "L1", pos: [20, 0, 0], lit: true }], shades: [{ pos: [20, 1, 12] }] }, ticks: 1200,
    check: (L) => L.filter((l) => l.type === "snapshot").every((s) => Math.hypot(s.shades[0].pos[0] - 20, s.shades[0].pos[2]) >= 5.99) && L.at(-2).player.flames === 3 },
  { id: "Q07-score-win", req: "S7", night: 1, what: "Nạp 10 đom đóm thắp đèn cuối: điểm 100 + 100 + 299x2 + 50x3 = 948",
    scenario: { ...base, player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4] }, frames: press(0, "interact"), ticks: 20,
    check: (L) => L.at(-1).state === "won" && L.at(-1).score === 948 },
  { id: "Q08-bridge-charm", req: "S9, S11", night: 2, what: "Đêm 2: đi qua cầu tre sang đảo B, nhặt Bùa Gió giữa cầu, không rơi",
    scenario: base, frames: [{ tick: 0, move: [1, 0] }], ticks: 700,
    check: (L) => ev(L, "charm_picked").length === 1 && ev(L, "player_hit").length === 0 && L.filter((l) => l.type === "snapshot").at(-1).player.pos[0] > 60 },
  { id: "Q09-pad-night2", req: "S9", night: 2, what: "Đêm 2: bục nhảy bắn Mây sang đảo B, đáp ở (51.24, 6.76) tại tick 84",
    scenario: { ...base, player: { pos: [20, 0, 18] } }, ticks: 100,
    check: (L) => { const p = snap(L, 84).player; return p.grounded && close(p.pos[0], 51.237, 0.05) && close(p.pos[2], 6.755, 0.05); } },
  { id: "Q10-ramp-night3", req: "S9", night: 3, what: "Đêm 3: đi dốc 30° lên tầng 1, cuối cùng đứng ở Y=3",
    scenario: { ...base, player: { pos: [26.847, 0, 15.5] } }, frames: [{ tick: 0, move: [-0.866, -0.5] }], ticks: 150,
    check: (L) => { const s = L.filter((l) => l.type === "snapshot").at(-1).player; return s.pos[1] === 3 && s.grounded; } },
  { id: "Q11-pad-night3", req: "S9", night: 3, what: "Đêm 3: bục nhảy đáp lên tầng 2 (Y=6)",
    scenario: { ...base, player: { pos: [0, 3, 13] } }, ticks: 90,
    check: (L) => { const p = L.filter((l) => l.type === "snapshot").at(-1).player; return p.pos[1] === 6 && p.grounded; } },
  { id: "Q12-drifter-steal", req: "S10", night: 2, what: "Gió Lạc: idle → chase, cướp min(3,6)=3, flee 240 tick rồi biến mất",
    scenario: { ...base, player: { carried: 6 }, drifters: [{ pos: [10, 1.5, 0] }] }, ticks: 330,
    check: (L) => { const s = ev(L, "drifter_steal"); return s.length === 1 && s[0].data.amount === 3 && s[0].data.carried === 3 && snap(L, s[0].tick + 240).drifters.length === 0; } },
  { id: "Q13-drifter-drop", req: "S10", night: 2, what: "Tỏa sáng trúng Gió Lạc đang flee có đồ: drifter_drop 3, thả 3 đom đóm, biến mất sau 120 tick",
    scenario: { ...base, player: { carried: 3 }, drifters: [{ pos: [3, 1.5, 0], state: "flee", stolen: 3 }] }, frames: press(0, "pulse"), ticks: 130,
    check: (L) => ev(L, "drifter_drop")[0]?.data.amount === 3 && snap(L, 120).drifters.length === 1 && snap(L, 121).drifters.length === 0 },
  { id: "Q14-charm-dash", req: "S11", night: 1, what: "Có bùa: lướt không hồi chiêu, bấm khi đang lướt bị bỏ qua (event ở tick 1 và 15)",
    scenario: { ...base, player: { charm_ticks: 600 } }, frames: [...press(0, "dash"), ...press(5, "dash"), ...press(14, "dash")], ticks: 30,
    check: (L) => ev(L, "dash").map((e) => e.tick).join() === "1,15" },
  { id: "Q15-wind", req: "S12", night: 3, what: "Đêm 3: gió thổi tick 1800 đến 2099, đẩy Mây đúng 10 m theo dir_deg",
    scenario: { ...base, wind_enabled: true }, ticks: 2200, extra: ["--snapshot-every", "1"],
    check: (L) => {
      const w = snap(L, 1800).wind; const p = snap(L, 2100).player.pos;
      const dz = p[2] + 30; const ang = ((Math.atan2(dz, p[0]) * 180) / Math.PI + 360) % 360;
      return w.active && !snap(L, 2100).wind.active && close(Math.hypot(p[0], dz), 10, 0.05) && Math.abs(((ang - w.dir_deg + 540) % 360) - 180) < 1;
    } },
  { id: "Q16-pause", req: "S13", night: 1, what: "Tạm dừng tick 11 đến 50: sim_tick đứng yên, state paused; tiếp tục ở tick 51",
    scenario: base, frames: [{ tick: 0, move: [0, 1] }, ...press(10, "pause"), ...press(50, "pause")], ticks: 70,
    check: (L) => ev(L, "paused")[0].tick === 11 && ev(L, "resumed")[0].tick === 51 && snap(L, 30).state === "paused" && snap(L, 30).sim_tick === 10 && snap(L, 51).sim_tick === 11 },
  ...[1, 2, 3].map((n) => ({
    id: `Q17-full-night${n}`, req: "S14, S8", night: n, what: `Đêm ${n} đầy đủ (ngẫu nhiên bật, seed 42, ${[18000, 19800, 21600][n - 1]} tick): chạy ≤ 30 s, tất định (2 lần giống hệt)`,
    scenario: { player: { flames: 1000 } }, frames: [{ tick: 0, move: [0.4, 1] }], ticks: [18000, 19800, 21600][n - 1], seed: 42, extra: ["--snapshot-every", "600"], determinism: true, timed: true,
    check: (L) => L.at(-1).type === "end" && L[0].night === n,
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
const bad = spawnSync(process.execPath, ["src/headless/cli.js", "--seed", "1", "--night", "2", "--inputs", badFile, "--ticks", "10", "--out", join(tmp, "x")], { encoding: "utf8" });
const badOk = bad.status === 2 && bad.stderr.length > 0;
if (!badOk) failed++;
rows.push(`| Q18-bad-inputs | S14 | inputs có tick trùng thì thoát mã 2, báo lỗi ra stderr | (không có file) | ${badOk ? "ĐẠT" : "KHÔNG ĐẠT"} (mã ${bad.status}) |`);
console.log(`${badOk ? "DAT   " : "KHONG "} Q18-bad-inputs`);

const unit = spawnSync(process.execPath, ["--test", "tests/core.test.js", "tests/phase2.test.js", "tests/cli.test.js"], { encoding: "utf8" });
const pick = (k) => (unit.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) ?? [])[1] ?? "?";
const git = (...a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();
const dirty = git("status", "--porcelain", "--", "src", "game.contract.json", "tests").length > 0;

const md = `# Bằng chứng Phase 2 (tự sinh bởi \`npm run proof\`)

- Mã nguồn: commit \`${git("rev-parse", "--short", "HEAD")}\`${dirty ? " (CÓ thay đổi chưa commit ở src/tests/contract)" : ""}
- Máy: ${process.platform} ${process.arch}, Node ${process.version}
- Test đơn vị và scenario: ${pick("pass")}/${pick("tests")} đạt, ${pick("fail")} lỗi (\`npm test\`)

Mỗi dòng dưới đây chạy lệnh headless thật (\`node src/headless/cli.js ...\`), rồi kiểm tra output theo tiêu chí S1 đến S14 trong \`docs/notes/phase2-spec.md\`.

| Kịch bản | Tiêu chí | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
${rows.join("\n")}

Bản web: ảnh chụp trong thư mục này (\`web-*.png\`) do Chrome chạy ngầm chụp từ bản \`npm start\` (đường tắt \`/?night=N\`). Chưa kiểm chứng: S15 phần chơi tay đủ 3 đêm, âm thanh nghe thật, và ≥ 30 FPS trên máy thật (xem README, phần "Giới hạn").
`;
writeFileSync(join(OUT, "RESULTS.md"), md);
console.log(`\nGhi ${join(OUT, "RESULTS.md")}. Không đạt: ${failed}`);
process.exit(failed ? 1 : 0);
