// Tạo bằng chứng Phase 1: chạy lệnh headless THẬT (cùng lệnh giảng viên sẽ chạy) với các kịch bản,
// kiểm tra kết quả theo yêu cầu, lưu output JSONL và bảng kết quả vào docs/proof/phase1/.
// Dùng: npm run proof        (chạy lại ở đúng tag thì ra cùng kết quả)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const OUT = "docs/proof/phase1";
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "ddl-proof-"));
const base = { random_motes: false, random_shades: false, motes: [], shades: [] };
const lit4 = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));

const cases = [
  {
    id: "P1-move", req: "R1, R2", what: "Đi thẳng 60 tick đến z=6; end.ticks=60",
    scenario: base, frames: [{ tick: 0, move: [0, 1] }], ticks: 60,
    check: (L) => L.at(-2).player.pos.join() === "0,0,6" && L.at(-1).ticks === 60,
  },
  {
    id: "P2-pickup", req: "R3", what: "Đi tới đom đóm thì ra mote_picked, điểm +10",
    scenario: { ...base, motes: [[0, 0, 3]] }, frames: [{ tick: 0, move: [0, 1] }], ticks: 60,
    check: (L) => L.filter((l) => l.name === "mote_picked").length === 1 && L.at(-1).score === 10,
  },
  {
    id: "P3-deposit-win", req: "R4, R8", what: "Nạp 5 đom đóm vào L1 (4 đèn còn lại sáng sẵn) thì lantern_lit và thắng all_lit",
    scenario: { ...base, player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4] },
    frames: [{ tick: 0, interact: true }], ticks: 60,
    check: (L) => L.some((l) => l.name === "lantern_lit") && L.at(-1).state === "won" && L.at(-1).score === 549,
  },
  {
    id: "P4-hit", req: "R5", what: "Bóng Mực chạm: mất lửa, rơi đom đóm, bất tử 90 tick rồi chạm lại",
    scenario: { ...base, player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 100,
    check: (L) => {
      const h = L.filter((l) => l.name === "player_hit");
      return h.length === 2 && h[0].tick === 1 && h[0].data.dropped === 2 && h[1].tick === 91;
    },
  },
  {
    id: "P5-pulse", req: "R6", what: "Tỏa sáng: choáng và đẩy S1, tốn 2 đom đóm",
    scenario: { ...base, player: { carried: 5 }, shades: [{ pos: [3, 1, 0] }] },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], ticks: 5,
    check: (L) => {
      const e = L.find((l) => l.name === "pulse");
      const s = L.filter((l) => l.type === "snapshot").at(-1);
      return e && e.data.stunned_ids.join() === "S1" && s.shades[0].state === "stunned" && s.player.carried === 3;
    },
  },
  {
    id: "P6-safe-zone", req: "R7", what: "Bóng Mực đuổi người đứng cạnh đèn 1200 tick, không bao giờ vào trong 5 m quanh đèn",
    scenario: { ...base, player: { pos: [20, 0, 0] }, lanterns: [{ id: "L1", pos: [20, 0, 0] }], shades: [{ pos: [20, 1, 12] }] },
    ticks: 1200, extra: ["--snapshot-every", "1"],
    check: (L) =>
      L.filter((l) => l.type === "snapshot").every((s) =>
        s.lanterns.every((ln) => Math.hypot(s.shades[0].pos[0] - ln.pos[0], s.shades[0].pos[2] - ln.pos[2]) >= 4.99)) &&
      L.at(-1).state === "playing",
  },
  {
    id: "P7-no-flames", req: "R8", what: "Hết lửa thì thua no_flames",
    scenario: { ...base, player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }, ticks: 50,
    check: (L) => L.find((l) => l.name === "game_over")?.data.reason === "no_flames" && L.at(-1).state === "lost",
  },
  {
    id: "P8-dawn", req: "R8", what: "Hết giờ (time_left_s=1) thì thua dawn ở tick 60",
    scenario: { ...base, time_left_s: 1 }, ticks: 200,
    check: (L) => L.find((l) => l.name === "game_over")?.data.reason === "dawn" && L.at(-1).ticks === 60,
  },
  {
    id: "P9-full-random", req: "R10", what: "Màn đầy đủ (ngẫu nhiên bật) seed 42, 5000 tick, có đi và tỏa sáng",
    scenario: {}, frames: [{ tick: 0, move: [1, 0.5] }, { tick: 400, move: [-1, 1], pulse: true }, { tick: 401, pulse: false }],
    ticks: 5000, seed: 42, determinism: true,
    check: (L) => L[0].motes_active === 20 && L.at(-1).type === "end",
  },
];

function runCli(c, outName) {
  const scnFile = join(tmp, `${c.id}.scn.json`);
  writeFileSync(scnFile, JSON.stringify(c.scenario));
  const args = ["src/headless/cli.js", "--seed", String(c.seed ?? 1), "--night", "1", "--scenario", scnFile, "--ticks", String(c.ticks), "--out", outName, ...(c.extra ?? [])];
  if (c.frames) {
    const f = join(tmp, `${c.id}.in.json`);
    writeFileSync(f, JSON.stringify({ frames: c.frames }));
    args.push("--inputs", f);
  }
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 12);
const rows = [];
let failed = 0;
for (const c of cases) {
  const out = join(OUT, `${c.id}.jsonl`);
  const r = runCli(c, out);
  let ok = r.status === 0;
  let note = "";
  if (ok) {
    const L = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    ok = !!c.check(L);
    if (c.determinism) {
      const out2 = join(tmp, `${c.id}.again.jsonl`);
      const r2 = runCli(c, out2);
      const same = r2.status === 0 && readFileSync(out, "utf8") === readFileSync(out2, "utf8");
      note = same ? `tất định: 2 lần chạy giống hệt (sha256 ${sha(out)})` : "tất định: KHÁC NHAU";
      ok = ok && same;
    }
  } else note = `thoát mã ${r.status}: ${r.stderr.trim()}`;
  if (!ok) failed++;
  rows.push(`| ${c.id} | ${c.req} | ${c.what} | \`${out}\` | ${ok ? "ĐẠT" : "KHÔNG ĐẠT"}${note ? " (" + note + ")" : ""} |`);
  console.log(`${ok ? "DAT   " : "KHONG "} ${c.id}`);
}

// Kiểm tra mã thoát 2 với file sai định dạng
const badFile = join(tmp, "bad.json");
writeFileSync(badFile, JSON.stringify({ frames: [{ tick: 3 }, { tick: 3 }] }));
const bad = spawnSync(process.execPath, ["src/headless/cli.js", "--seed", "1", "--night", "1", "--inputs", badFile, "--ticks", "10", "--out", join(tmp, "x")], { encoding: "utf8" });
const badOk = bad.status === 2 && bad.stderr.length > 0;
if (!badOk) failed++;
rows.push(`| P10-bad-inputs | R11 | inputs có tick trùng thì thoát mã 2 và báo lỗi ra stderr | (không có file) | ${badOk ? "ĐẠT" : "KHÔNG ĐẠT"} (mã ${bad.status}) |`);
console.log(`${badOk ? "DAT   " : "KHONG "} P10-bad-inputs`);

const unit = spawnSync(process.execPath, ["--test", "tests/core.test.js", "tests/cli.test.js"], { encoding: "utf8" });
const pick = (k) => (unit.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) ?? [])[1] ?? "?";
const git = (...a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();
const dirty = git("status", "--porcelain", "--", "src", "game.contract.json", "tests").length > 0;

const md = `# Bằng chứng Phase 1 (tự sinh bởi \`npm run proof\`)

- Mã nguồn: commit \`${git("rev-parse", "--short", "HEAD")}\`${dirty ? " (CÓ thay đổi chưa commit ở src/tests/contract)" : ""}
- Máy: ${process.platform} ${process.arch}, Node ${process.version}
- Test đơn vị và scenario: ${pick("pass")}/${pick("tests")} đạt, ${pick("fail")} lỗi (\`npm test\`)

Mỗi dòng dưới đây chạy lệnh headless thật (\`node src/headless/cli.js ...\`), rồi kiểm tra output theo yêu cầu (R1 đến R12 trong \`docs/notes/phase1-assumptions.md\`).

| Kịch bản | Yêu cầu | Kiểm tra | Output | Kết quả |
|---|---|---|---|---|
${rows.join("\n")}

Chưa kiểm chứng tự động: R13 (bản 3D chơi được, HUD, chơi lại). Xem mục "Giới hạn" trong README.
`;
writeFileSync(join(OUT, "RESULTS.md"), md);
console.log(`\nGhi ${join(OUT, "RESULTS.md")}. Không đạt: ${failed}`);
process.exit(failed ? 1 : 0);
