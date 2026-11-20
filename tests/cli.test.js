import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TUNING } from "../src/core/tuning.js";

const CLI = "src/headless/cli.js";
const dir = mkdtempSync(join(tmpdir(), "ddl-"));
const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
const file = (name, content) => {
  const p = join(dir, name);
  writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content));
  return p;
};

test("R1: CLI chạy xong thoát 0, ghi JSONL hợp lệ, dòng cuối là end", () => {
  const out = join(dir, "a.jsonl");
  const r = cli("--seed", "1", "--night", "1", "--ticks", "120", "--out", out);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].type, "snapshot");
  assert.equal(lines[0].tick, 0);
  assert.deepEqual(lines.at(-1), { type: "end", ticks: 120, state: "playing", score: 0 });
});

test("R10: chạy CLI hai lần cho file output giống hệt từng byte", () => {
  const inputs = file("in.json", { frames: [{ tick: 0, move: [0.3, 1] }, { tick: 300, pulse: true }] });
  const o1 = join(dir, "d1.jsonl");
  const o2 = join(dir, "d2.jsonl");
  for (const o of [o1, o2]) {
    assert.equal(cli("--seed", "7", "--night", "1", "--inputs", inputs, "--ticks", "2000", "--snapshot-every", "25", "--out", o).status, 0);
  }
  assert.equal(readFileSync(o1, "utf8"), readFileSync(o2, "utf8"));
});

test("R11: file inputs/scenario sai định dạng thoát mã 2, lỗi ra stderr", () => {
  const out = join(dir, "x.jsonl");
  const cases = [
    ["--inputs", file("bad1.json", "{không phải json")],
    ["--inputs", file("bad2.json", { frames: [{ tick: 3 }, { tick: 3 }] })],
    ["--scenario", file("bad3.json", { player: { pos: "x" } })],
    ["--scenario", join(dir, "khong-ton-tai.json")],
  ];
  for (const extra of cases) {
    const r = cli("--seed", "1", "--night", "1", "--ticks", "10", "--out", out, ...extra);
    assert.equal(r.status, 2, extra.join(" "));
    assert.match(r.stderr, /Loi/);
  }
});

test("R11: thiếu hoặc sai tham số thì thoát khác 0", () => {
  assert.notEqual(cli("--seed", "1").status, 0);
  assert.notEqual(cli("--seed", "x", "--ticks", "1", "--out", join(dir, "y")).status, 0);
  assert.notEqual(cli("--seed", "1", "--night", "4", "--ticks", "1", "--out", join(dir, "y")).status, 0);
  assert.notEqual(cli("--seed", "1", "--night", "0", "--ticks", "1", "--out", join(dir, "y")).status, 0);
  assert.notEqual(cli("--bogus", "1").status, 0);
});

test("R1: CLI với scenario + inputs ra đúng sự kiện (nhặt đom đóm)", () => {
  const out = join(dir, "s.jsonl");
  const scn = file("s.json", { random_motes: false, random_shades: false, motes: [[0, 0, 3]], shades: [] });
  const inp = file("si.json", { frames: [{ tick: 0, move: [0, 1] }] });
  assert.equal(cli("--seed", "1", "--night", "1", "--scenario", scn, "--inputs", inp, "--ticks", "60", "--out", out).status, 0);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const picked = lines.filter((l) => l.name === "mote_picked");
  assert.equal(picked.length, 1);
  assert.deepEqual(picked[0].data, { carried: 1 });
});

test("R12: game.contract.json khớp số liệu thật trong code và đủ trường bắt buộc", () => {
  const c = JSON.parse(readFileSync("game.contract.json", "utf8"));
  assert.equal(c.contract_version, "1.2");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd"]) assert.ok(typeof c[k] === "string" && c[k].length > 0, k);
  assert.deepEqual(c.tuning, TUNING);
  assert.equal(c.tuning.lantern_count_night1, 5);
  for (const k of ["dash_speed", "dash_duration_s", "dash_cooldown_s", "night2_duration_s", "night3_duration_s", "fuel_max", "fuel_decay_per_s", "fuel_per_mote", "relight_cost", "win_ratio", "drain_per_s", "low_fuel_threshold", "capacity_max"]) assert.ok(k in c.tuning, k);
});

test("S14: CLI nhận --night 1, 2, 3 và ghi đúng night/số đèn vào snapshot", () => {
  for (const [night, lanterns] of [[1, 5], [2, 6], [3, 7]]) {
    const out = join(dir, `n${night}.jsonl`);
    const r = cli("--seed", "1", "--night", String(night), "--ticks", "30", "--out", out);
    assert.equal(r.status, 0, r.stderr);
    const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].night, night);
    assert.equal(lines[0].lanterns.length, lanterns);
    assert.ok(lines.some((l) => l.name === "night_start" && l.data.night === night));
  }
});

test("S13/S2: CLI đọc inputs có dash và pause", () => {
  const out = join(dir, "dp.jsonl");
  const inp = file("dp.json", { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, pause: true }, { tick: 6, pause: false }] });
  assert.equal(cli("--seed", "1", "--night", "1", "--inputs", inp, "--ticks", "20", "--out", out).status, 0);
  const names = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((l) => l.type === "event").map((l) => l.name);
  assert.deepEqual(names, ["night_start", "dash", "paused"]);
});
