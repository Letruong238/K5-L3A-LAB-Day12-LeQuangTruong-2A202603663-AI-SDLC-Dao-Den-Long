import { test } from "node:test";
import assert from "node:assert/strict";
import { runHeadless } from "../src/core/run.js";
import { ContractError } from "../src/core/validate.js";
import { TUNING as T } from "../src/core/tuning.js";

// Scenario cơ bản: không sinh ngẫu nhiên, không có gì ngoài những gì liệt kê.
const base = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
const run = (scenario, frames, ticks, opts = {}) =>
  runHeadless({ seed: 1, ticks, scenario, inputs: frames ? { frames } : null, snapshotEvery: 1, ...opts });
const snaps = (lines) => lines.filter((l) => l.type === "snapshot");
const events = (lines, name) => lines.filter((l) => l.type === "event" && (!name || l.name === name));
const end = (lines) => lines[lines.length - 1];
const last = (lines) => snaps(lines).at(-1);
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// ---- R1 ----
test("R1: --ticks N chạy đúng N bước, có snapshot tick 0 và dòng end", () => {
  const lines = run(base(), null, 100, { snapshotEvery: 10 });
  assert.equal(snaps(lines)[0].tick, 0);
  assert.equal(end(lines).type, "end");
  assert.equal(end(lines).ticks, 100);
  assert.equal(end(lines).state, "playing");
  assert.equal(snaps(lines).length, 11); // 0,10,...,100
  near(last(lines).time_left_s, 300 - 100 / 60);
});

test("R1: snapshot tick 0 có trước input (người chơi chưa di chuyển)", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }], 5);
  assert.deepEqual(snaps(lines)[0].player.pos, [0, 0, 0]);
  assert.ok(snaps(lines)[1].player.pos[2] > 0);
});

// ---- R2 ----
test("R2: move [0,1] trong 60 tick đi +6 m theo +Z", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }], 60);
  assert.deepEqual(last(lines).player.pos, [0, 0, 6]);
});

test("R2: vector chéo [1,1] được chuẩn hóa, quãng đường vẫn 6 m", () => {
  const p = last(run(base(), [{ tick: 0, move: [1, 1] }], 60)).player.pos;
  near(Math.hypot(p[0], p[2]), 6);
  near(p[0], p[2]);
});

test("R2: cam_yaw_deg 90 đổi hướng (move [0,1] đi theo +X)", () => {
  const p = last(run(base(), [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], 60)).player.pos;
  near(p[0], 6);
  near(p[2], 0);
});

test("R2: frame chỉ đổi trường có mặt, trường vắng giữ giá trị cũ", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }, { tick: 30, cam_yaw_deg: 90 }], 60);
  const p = last(lines).player.pos;
  near(p[2], 3);
  near(p[0], 3);
});

test("R2: nhảy làm đổi độ cao Y rồi trở về 0, không đổi XZ", () => {
  const lines = run(base(), [{ tick: 0, jump: true }, { tick: 1, jump: false }], 90);
  const ys = snaps(lines).map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 0.5);
  assert.equal(ys.at(-1), 0);
  assert.deepEqual([last(lines).player.pos[0], last(lines).player.pos[2]], [0, 0]);
});

test("R2: không đi ra khỏi đảo (bán kính 40, không rơi)", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }], 600);
  const p = last(lines).player.pos;
  near(Math.hypot(p[0], p[2]), 40);
  assert.equal(events(lines, "player_hit").length, 0);
});

// ---- R3 ----
test("R3: đứng trong pickup_radius thì nhặt, carried và điểm tăng", () => {
  const lines = run(base({ motes: [[0, 0, 0.5]] }), null, 3);
  const ev = events(lines, "mote_picked");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(last(lines).score, T.score.per_mote);
  assert.equal(last(lines).motes_active, 0);
});

test("R3: khoảng cách đúng bằng pickup_radius vẫn nhặt (<=), xa hơn thì không", () => {
  assert.equal(events(run(base({ motes: [[0, 0, 1]] }), null, 2), "mote_picked").length, 1);
  assert.equal(events(run(base({ motes: [[0, 0, 1.01]] }), null, 2), "mote_picked").length, 0);
});

test("R3: đầy carry_capacity thì không nhặt thêm", () => {
  const lines = run(base({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }), null, 5);
  assert.equal(events(lines, "mote_picked").length, 0);
  assert.equal(last(lines).motes_active, 1);
});

// ---- R4 ----
const lit4 = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));

test("R4: nạp đủ cost thì ra deposit, lantern_lit và thắng (all_lit) với điểm thưởng", () => {
  const scn = base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4] });
  const lines = run(scn, [{ tick: 0, interact: true }], 10);
  assert.deepEqual(events(lines, "deposit")[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
  assert.equal(events(lines, "lantern_lit")[0].data.lantern_id, "L1");
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "won", reason: "all_lit" });
  assert.equal(end(lines).state, "won");
  assert.equal(end(lines).ticks, 1);
  // 100 (đèn) + 299 (giây còn lại sau 1 bước) + 50*3 (lửa)
  assert.equal(end(lines).score, 100 + 299 + 150);
});

test("R4: nạp một phần thì đèn chưa sáng, nạp tiếp được", () => {
  const scn = base({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] });
  const lines = run(scn, [{ tick: 0, interact: true }], 5);
  assert.deepEqual(events(lines, "deposit")[0].data, { lantern_id: "L1", amount: 3, deposited: 3 });
  assert.equal(events(lines, "lantern_lit").length, 0);
  assert.equal(last(lines).lanterns[0].deposited, 3);
  assert.equal(last(lines).player.carried, 0);
});

test("R4: giữ interact liên tục chỉ nạp một lần (kích hoạt khi false -> true)", () => {
  const scn = base({ player: { carried: 8 }, lanterns: [{ id: "L1", pos: [0, 0, 1], deposited: 0 }] });
  const lines = run(scn, [{ tick: 0, interact: true }], 30);
  assert.equal(events(lines, "deposit").length, 1);
});

test("R4: nhấn lại interact thì nạp tiếp lần hai", () => {
  // L1 gần hơn nên nhận trước (đủ 5 thì sáng), lần nhấn thứ hai nạp 3 còn lại vào L2.
  const scn = base({ player: { carried: 8 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, { id: "L2", pos: [0, 0, 1.5] }] });
  const lines = run(scn, [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true }], 10);
  assert.equal(events(lines, "deposit").length, 2);
  assert.deepEqual(events(lines, "deposit")[1].data, { lantern_id: "L2", amount: 3, deposited: 3 });
});

test("R4: ngoài interact_radius thì không nạp", () => {
  const scn = base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 2.5] }] });
  assert.equal(events(run(scn, [{ tick: 0, interact: true }], 3), "deposit").length, 0);
});

// ---- R5 ----
test("R5: Bóng Mực chạm thì mất lửa, rơi một nửa đom đóm, rồi bất tử invuln_s", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 100);
  const hits = events(lines, "player_hit");
  assert.deepEqual(hits[0].data, { by: "shade", flames: 2, dropped: 2 });
  assert.equal(hits[0].tick, 1);
  assert.equal(hits[1].tick, 1 + T.invuln_s * 60); // đúng hết bất tử mới bị chạm lại
  assert.equal(hits[1].data.flames, 1);
  assert.equal(snaps(lines)[1].player.carried, 3);
  assert.equal(snaps(lines)[1].motes_active, 2);
});

test("R5: hết lửa thì thua với reason no_flames", () => {
  const scn = base({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 50);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.equal(end(lines).state, "lost");
  assert.equal(end(lines).ticks, 1);
});

// ---- R6 ----
test("R6: pulse choáng Bóng Mực trong bán kính, đẩy lùi, tốn đom đóm", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [3, 1, 0] }, { id: "XA", pos: [20, 1, 0] }] });
  const lines = run(scn, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], 5);
  assert.deepEqual(events(lines, "pulse")[0].data, { stunned_ids: ["S1"] });
  const s = snaps(lines)[1];
  assert.equal(s.player.carried, 3);
  assert.equal(s.shades[0].state, "stunned");
  near(s.shades[0].pos[0], 7);
  assert.equal(s.score, T.score.per_stun);
  assert.notEqual(s.shades[1].state, "stunned");
});

test("R6: Bóng Mực choáng không gây sát thương, hết choáng thì đuổi lại", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], 250);
  const s = snaps(lines);
  assert.equal(s[100].shades[0].state, "stunned");
  assert.equal(s[250].shades[0].state, "chase");
  assert.ok(events(lines, "player_hit").every((e) => e.tick >= 180));
});

test("R6: không đủ đom đóm thì không tỏa sáng", () => {
  const scn = base({ player: { carried: 1 }, shades: [{ pos: [3, 1, 0] }] });
  assert.equal(events(run(scn, [{ tick: 0, pulse: true }], 3), "pulse").length, 0);
});

test("R6: có thời gian hồi pulse_cooldown_s", () => {
  const scn = base({ player: { carried: 10 }, shades: [{ pos: [30, 1, 0] }] });
  const frames = [
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 60, pulse: true }, { tick: 61, pulse: false },
    { tick: 130, pulse: true },
  ];
  const ticks = events(run(scn, frames, 140), "pulse").map((e) => e.tick);
  assert.deepEqual(ticks, [1, 131]);
});

test("R6: pulse không trúng ai vẫn ghi event với stunned_ids rỗng và tốn đom đóm", () => {
  const scn = base({ player: { carried: 4 } });
  const lines = run(scn, [{ tick: 0, pulse: true }], 3);
  assert.deepEqual(events(lines, "pulse")[0].data, { stunned_ids: [] });
  assert.equal(last(lines).player.carried, 2);
});

// ---- R7 ----
test("R7: Bóng Mực không bao giờ vào trong safe_radius quanh đèn", () => {
  const scn = base({
    player: { pos: [20, 0, 0] },
    lanterns: [{ id: "L1", pos: [20, 0, 0] }],
    shades: [{ pos: [20, 1, 12] }],
  });
  const lines = run(scn, null, 1200);
  for (const s of snaps(lines)) {
    for (const sh of s.shades) {
      for (const l of s.lanterns) {
        assert.ok(Math.hypot(sh.pos[0] - l.pos[0], sh.pos[2] - l.pos[2]) >= T.safe_radius - 0.01);
      }
    }
  }
  assert.equal(last(lines).player.flames, 3); // đứng cạnh đèn là an toàn
});

// ---- R8 ----
test("R8: hết giờ thì thua với reason dawn", () => {
  const lines = run(base({ time_left_s: 1 }), null, 200);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "dawn" });
  assert.equal(end(lines).ticks, 60);
  assert.equal(end(lines).state, "lost");
  assert.equal(last(lines).time_left_s, 0);
});

// ---- R9 ----
test("R9: dựng scenario không phát event và không cộng điểm", () => {
  const scn = base({ player: { carried: 3 }, lanterns: [{ id: "L2", lit: true }] });
  const lines = run(scn, null, 0);
  assert.equal(lines.filter((l) => l.type === "event").length, 0);
  assert.equal(snaps(lines)[0].score, 0);
  assert.equal(snaps(lines)[0].lanterns[1].lit, true);
  assert.equal(snaps(lines)[0].lanterns[1].deposited, 5);
});

// ---- R10 ----
test("R10: random_shades:false thì không có shade_spawned; true thì có", () => {
  const off = run({ random_shades: false, random_motes: false }, null, 2000, { snapshotEvery: 500 });
  assert.equal(events(off, "shade_spawned").length, 0);
  assert.equal(last(off).shades.length, 0);
  // Không có Bóng Mực ban đầu để người chơi đứng yên không chết trước tick 900.
  const on = run({ random_motes: false, shades: [] }, null, 1000, { snapshotEvery: 500 });
  assert.equal(events(on, "shade_spawned")[0].tick, 900);
  assert.equal(events(on, "shade_spawned")[0].data.id, "S1");
  assert.equal(last(on).shades.length, 1);
});

test("R10: cùng seed, scenario, inputs cho output giống hệt; khác seed thì khác", () => {
  const frames = [{ tick: 0, move: [1, 0.5] }, { tick: 400, move: [-1, 1], pulse: true }, { tick: 401, pulse: false }];
  const a = JSON.stringify(run({}, frames, 3000, { seed: 42, snapshotEvery: 7 }));
  const b = JSON.stringify(run({}, frames, 3000, { seed: 42, snapshotEvery: 7 }));
  const c = JSON.stringify(run({}, frames, 3000, { seed: 43, snapshotEvery: 7 }));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("R10: tọa độ làm tròn 3 chữ số thập phân", () => {
  const lines = run({}, [{ tick: 0, move: [1, 0.37], cam_yaw_deg: 13 }], 200);
  for (const s of snaps(lines)) {
    for (const v of s.player.pos) assert.equal(v, Math.round(v * 1000) / 1000);
    for (const m of s.motes) for (const v of m.pos) assert.equal(v, Math.round(v * 1000) / 1000);
  }
});

test("R10: mặc định có đom đóm rải rác (20) và Bóng Mực hoạt động", () => {
  const s0 = snaps(run({}, null, 0))[0];
  assert.equal(s0.motes_active, 20);
  assert.equal(s0.shades.length, 1);
  assert.equal(s0.lanterns.length, 5);
  assert.deepEqual(s0.lanterns[0].pos, [0, 0, 25]);
});

// ---- R11 (mức hàm) ----
test("R11: inputs sai định dạng ném ContractError mã 2", () => {
  const bad = [
    { frames: [{ tick: 5 }, { tick: 5 }] },
    { frames: [{ tick: 5 }, { tick: 3 }] },
    { frames: [{ tick: 0, move: [2, 0] }] },
    { frames: [{ tick: 0, move: [0] }] },
    { frames: [{ tick: 0, jump: "yes" }] },
    { frames: "x" },
    [],
  ];
  for (const inputs of bad) {
    assert.throws(() => runHeadless({ seed: 1, ticks: 1, inputs }), (e) => e instanceof ContractError && e.exitCode === 2);
  }
});

test("R11: scenario sai định dạng ném ContractError mã 2", () => {
  const bad = [
    { player: { pos: [0, 0] } },
    { motes: [[0, 0]] },
    { shades: [{ id: "A", pos: [0, 0, 0] }, { id: "A", pos: [1, 0, 0] }] },
    { lanterns: [{ id: "L9" }] },
    { random_motes: "no" },
    { time_left_s: -1 },
    "scenario",
  ];
  for (const scenario of bad) {
    assert.throws(() => runHeadless({ seed: 1, ticks: 1, scenario }), (e) => e instanceof ContractError && e.exitCode === 2);
  }
});
