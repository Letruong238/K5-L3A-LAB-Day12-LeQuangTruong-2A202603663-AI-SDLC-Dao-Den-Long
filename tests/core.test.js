// Hồi quy Phase 1 (R1 đến R11), cập nhật theo số liệu chuẩn của Ticket-02. Lý do đổi: docs/notes/phase2-spec.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runHeadless } from "../src/core/run.js";
import { ContractError } from "../src/core/validate.js";
import { TUNING as T } from "../src/core/tuning.js";
import { base, run, snaps, events, end, last, at, near, press, lit } from "./helpers.js";

// ---- R1 ----
test("R1: --ticks N chạy đúng N bước, có snapshot tick 0, night_start và dòng end", () => {
  const lines = run(base(), null, 100, { snapshotEvery: 10 });
  assert.equal(snaps(lines)[0].tick, 0);
  assert.equal(end(lines).type, "end");
  assert.equal(end(lines).ticks, 100);
  assert.equal(end(lines).state, "playing");
  assert.equal(snaps(lines).length, 11); // 0,10,...,100
  near(last(lines).time_left_s, 240 - 100 / 60); // Ticket-03: Đêm 1 còn 240 s
  assert.deepEqual(events(lines, "night_start")[0].data, { night: 1 });
});

test("R1: snapshot tick 0 có trước input (người chơi chưa di chuyển)", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }], 5);
  assert.deepEqual(snaps(lines)[0].player.pos, [0, 0, 0]);
  assert.ok(snaps(lines)[1].player.pos[2] > 0);
});

// ---- R2 (đổi: có gia tốc 5 tick nên 60 tick đi 5.8 m thay vì 6 m) ----
test("R2: move [0,1] trong 60 tick đi 5.8 m theo +Z (gia tốc 5 tick)", () => {
  const p = last(run(base(), [{ tick: 0, move: [0, 1] }], 60)).player.pos;
  near(p[2], 5.8, 0.01);
  assert.equal(p[0], 0);
});

test("R2: vector chéo [1,1] được chuẩn hóa, tốc độ vẫn 6 m/s", () => {
  const s = last(run(base(), [{ tick: 0, move: [1, 1] }], 60));
  near(Math.hypot(s.player.pos[0], s.player.pos[2]), 5.8, 0.01);
  near(s.player.pos[0], s.player.pos[2]);
  near(Math.hypot(s.player.vel[0], s.player.vel[2]), 6, 0.01);
});

test("R2: cam_yaw_deg 90 đổi hướng (move [0,1] đi theo +X)", () => {
  const p = last(run(base(), [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], 60)).player.pos;
  near(p[0], 5.8, 0.01);
  near(p[2], 0, 0.01);
});

test("R2: frame chỉ đổi trường có mặt, trường vắng giữ giá trị cũ", () => {
  const p = last(run(base(), [{ tick: 0, move: [0, 1] }, { tick: 30, cam_yaw_deg: 90 }], 60)).player.pos;
  // sau khi đổi hướng, vận tốc xoay dần trong 5 tick nên z đi thêm một chút (≈3.1)
  assert.ok(p[2] > 2.7 && p[2] < 3.3, `z=${p[2]}`);
  assert.ok(p[0] > 2.6 && p[0] < 3.3, `x=${p[0]}`);
});

// ---- R3 (đổi: nhặt không còn cộng điểm, điểm tính khi nạp) ----
test("R3: đứng trong pickup_radius thì nhặt, carried tăng, chưa có điểm", () => {
  const lines = run(base({ motes: [[0, 0, 0.5]] }), null, 3);
  const ev = events(lines, "mote_picked");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(last(lines).score, 0);
  assert.equal(last(lines).motes_active, 0);
});

test("R3: đúng bằng pickup_radius vẫn nhặt (<=), xa hơn thì không", () => {
  assert.equal(events(run(base({ motes: [[0, 0, 1]] }), null, 2), "mote_picked").length, 1);
  assert.equal(events(run(base({ motes: [[0, 0, 1.01]] }), null, 2), "mote_picked").length, 0);
});

test("R3: chênh cao giữa chân Mây và đom đóm phải <= 1.5 m", () => {
  assert.equal(events(run(base({ motes: [[0, 1.4, 0.5]] }), null, 2), "mote_picked").length, 1);
  assert.equal(events(run(base({ motes: [[0, 1.6, 0.5]] }), null, 2), "mote_picked").length, 0);
});

test("R3: đầy carry_capacity thì không nhặt thêm", () => {
  const lines = run(base({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }), null, 5);
  assert.equal(events(lines, "mote_picked").length, 0);
  assert.equal(last(lines).motes_active, 1);
});

// ---- R4 ----
const lit4 = lit("L2", "L3", "L4", "L5");

test("R4: nạp đủ 10 thì deposit, lantern_lit (relight:false), đèn đầy dầu; KHÔNG kết thúc đêm (Ticket-03 bỏ thắng sớm)", () => {
  const scn = base({ player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4] });
  const lines = run(scn, press(0, "interact"), 10);
  assert.deepEqual(events(lines, "deposit")[0].data, { lantern_id: "L1", amount: 10, deposited: 10 });
  assert.deepEqual(events(lines, "lantern_lit")[0].data, { lantern_id: "L1", relight: false });
  assert.equal(events(lines, "game_over").length, 0); // đủ đèn không còn kết thúc đêm
  assert.equal(end(lines).state, "playing");
  assert.equal(last(lines).score, 10 * 5 + 100); // 10 đom đóm x 5 + thắp lần đầu +100 (Ticket-03)
  assert.equal(at(lines, 1).lanterns[0].fuel, 100);
});

test("R4: nạp một phần thì đèn chưa sáng, được 5 điểm mỗi đom đóm nạp (Ticket-03: trước là 10)", () => {
  const scn = base({ player: { carried: 4 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] });
  const lines = run(scn, press(0, "interact"), 5);
  assert.deepEqual(events(lines, "deposit")[0].data, { lantern_id: "L1", amount: 4, deposited: 4 });
  assert.equal(events(lines, "lantern_lit").length, 0);
  assert.equal(last(lines).lanterns[0].deposited, 4);
  assert.equal(last(lines).score, 20);
  assert.equal(last(lines).player.carried, 0);
});

test("R4: giữ interact liên tục chỉ nạp một lần (cạnh lên)", () => {
  const scn = base({ player: { carried: 8 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] });
  assert.equal(events(run(scn, [{ tick: 0, interact: true }], 30), "deposit").length, 1);
});

test("R4: nhấn lại: đèn vừa thắp hao dầu mỗi tick nên luôn là đèn nhận được gần nhất, được châm dầu trước (Ticket-03)", () => {
  // Trước Ticket-03: lần hai nạp vào L2 vì L1 đã sáng. Nay L1 luôn hao 1 đơn vị trước bước tương tác nên chưa đầy,
  // mỗi lần bấm châm thêm 1 đom đóm (ceil(0.03 / 10) = 1) vào L1 vì L1 gần hơn L2.
  const scn = base({ player: { carried: 14 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, { id: "L2", pos: [0, 0, 1.5] }] });
  const lines = run(scn, [...press(0, "interact"), ...press(2, "interact"), ...press(4, "interact")], 10);
  assert.deepEqual(events(lines, "deposit").map((e) => e.data), [{ lantern_id: "L1", amount: 10, deposited: 10 }]);
  assert.deepEqual(events(lines, "refuel").map((e) => e.data), [
    { lantern_id: "L1", amount: 1, fuel: 100 },
    { lantern_id: "L1", amount: 1, fuel: 100 },
  ]);
  assert.equal(last(lines).player.carried, 2);
});

test("R4: đèn gần nhất nhận trước; bằng nhau thì id nhỏ hơn; đèn sáng chưa đầy dầu cũng được xét", () => {
  const tie = base({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, { id: "L2", pos: [0, 0, -1] }] });
  assert.equal(events(run(tie, press(0, "interact"), 3), "deposit")[0].data.lantern_id, "L1");
  // L1 sáng nhưng fuel 50 (chưa đầy) và gần hơn: nhận châm dầu. Ticket-02 trước đây bỏ qua đèn đã sáng.
  const lit1 = base({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: true, fuel: 50 }, { id: "L2", pos: [0, 0, 1.9] }] });
  const lines = run(lit1, press(0, "interact"), 3);
  assert.equal(events(lines, "refuel")[0].data.lantern_id, "L1");
  assert.equal(events(lines, "deposit").length, 0);
});

test("R4: ngoài interact_radius (2.0) thì không nạp", () => {
  const scn = base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 2.5] }] });
  assert.equal(events(run(scn, press(0, "interact"), 3), "deposit").length, 0);
});

// ---- R5 ----
test("R5: Bóng Mực chạm: mất lửa, rơi floor(carried/2), bất tử 90 tick rồi bị chạm lại", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 100);
  const hits = events(lines, "player_hit");
  assert.deepEqual(hits[0].data, { by: "shade", flames: 2, dropped: 2 });
  assert.equal(hits[0].tick, 1);
  assert.equal(hits[1].tick, 91);
  assert.equal(hits[1].data.flames, 1);
  assert.equal(at(lines, 1).player.carried, 3);
  assert.equal(at(lines, 1).motes_active, 2);
  assert.equal(at(lines, 1).player.invuln, 90);
});

test("R5: hết lửa thì thua no_flames", () => {
  const scn = base({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 50);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.equal(end(lines).state, "lost");
  assert.equal(end(lines).ticks, 1);
});

// ---- R6 (đổi: 3 đom đóm, 5 m, choáng 120 tick, +5 điểm, hồi 180 tick) ----
test("R6: tỏa sáng choáng Bóng Mực trong 5 m, đẩy 4 m trong 15 tick, tốn 3 đom đóm", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [3, 1, 0] }, { id: "XA", pos: [25, 1, 0] }] });
  const lines = run(scn, press(0, "pulse"), 130);
  assert.deepEqual(events(lines, "pulse")[0].data, { stunned_ids: ["S1"] });
  assert.equal(events(lines, "pulse")[0].tick, 1);
  assert.equal(at(lines, 1).player.carried, 2);
  assert.equal(at(lines, 1).score, T.score.per_stun);
  assert.equal(at(lines, 1).shades[0].state, "stunned");
  near(at(lines, 14).shades[0].pos[0], 3 + (4 * 14) / 15, 0.01);
  near(at(lines, 15).shades[0].pos[0], 7, 0.01);
  near(at(lines, 100).shades[0].pos[0], 7, 0.01); // hết đẩy thì đứng yên
  assert.notEqual(at(lines, 1).shades[1].state, "stunned");
  assert.equal(at(lines, 120).shades[0].state, "stunned"); // choáng đúng 120 tick
  // Ticket-03 thay luật: hết choáng thì về wander (trước đây là chase nếu cách <= 18 m), rồi mới chase lại
  assert.equal(at(lines, 121).shades[0].state, "wander");
  assert.equal(at(lines, 122).shades[0].state, "chase");
});

test("R6: khoảng cách tới tâm tỏa sáng là 3D (chân Mây + 0.8 m), bán kính 5 m", () => {
  const scn = base({ player: { carried: 3, invuln_ticks: 1000 }, shades: [{ id: "A", pos: [4, 1, 0] }, { id: "B", pos: [0, 6, 0] }, { id: "C", pos: [0, 5.5, 0] }] });
  assert.deepEqual(events(run(scn, press(0, "pulse"), 2), "pulse")[0].data.stunned_ids, ["A", "C"]);
});

test("R6: Bóng Mực choáng không gây sát thương", () => {
  const scn = base({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, press(0, "pulse"), 200);
  assert.ok(events(lines, "player_hit").every((e) => e.tick >= 121));
});

test("R6: không đủ 3 đom đóm thì không tỏa sáng", () => {
  const scn = base({ player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] });
  assert.equal(events(run(scn, press(0, "pulse"), 3), "pulse").length, 0);
});

test("R6: hồi chiêu 3 s (180 tick)", () => {
  const scn = base({ player: { carried: 9 }, shades: [{ pos: [40, 1, 0] }] });
  const frames = [...press(0, "pulse"), ...press(100, "pulse"), ...press(180, "pulse")];
  assert.deepEqual(events(run(scn, frames, 200), "pulse").map((e) => e.tick), [1, 181]);
});

test("R6: pulse không trúng ai vẫn ghi event stunned_ids rỗng và tốn đom đóm", () => {
  const lines = run(base({ player: { carried: 4 } }), press(0, "pulse"), 3);
  assert.deepEqual(events(lines, "pulse")[0].data, { stunned_ids: [] });
  assert.equal(last(lines).player.carried, 1);
});

// ---- R7 (đổi: chỉ đèn ĐÃ SÁNG có vùng an toàn, 6 m) ----
test("R7: Bóng Mực không bao giờ vào trong 6 m quanh đèn đã sáng", () => {
  const scn = base({ player: { pos: [20, 0, 0] }, lanterns: [{ id: "L1", pos: [20, 0, 0], lit: true }], shades: [{ pos: [20, 1, 12] }] });
  const lines = run(scn, null, 1200);
  for (const s of snaps(lines)) {
    for (const sh of s.shades) {
      for (const l of s.lanterns.filter((x) => x.lit)) {
        assert.ok(Math.hypot(sh.pos[0] - l.pos[0], sh.pos[2] - l.pos[2]) >= T.safe_radius - 0.01);
      }
    }
  }
  assert.equal(last(lines).player.flames, 3);
});

test("R7: đèn chưa sáng KHÔNG có vùng an toàn (luật Phase 1 đã bị thay)", () => {
  const scn = base({ player: { pos: [20, 0, 0] }, lanterns: [{ id: "L1", pos: [20, 0, 0] }], shades: [{ pos: [20, 1, 12] }] });
  assert.ok(events(run(scn, null, 400), "player_hit").length >= 1);
});

// ---- R8 ----
test("R8: hết giờ thì thua dawn", () => {
  const lines = run(base({ time_left_s: 1 }), null, 200);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "dawn" });
  assert.equal(end(lines).ticks, 60);
  assert.equal(last(lines).time_left_s, 0);
});

test("R8: thắp đủ đèn không còn kết thúc đêm; thắng chỉ khi bình minh (Ticket-03 thay luật thắng sớm)", () => {
  const scn = base({ time_left_s: 2, player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4] });
  const lines = run(scn, press(0, "interact"), 200);
  assert.equal(at(lines, 60).state, "playing"); // đủ 5/5 đèn mà vẫn chưa kết thúc
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "won", reason: "dawn_survived" });
  assert.equal(end(lines).ticks, 120);
});

test("R8: hết lửa luôn thua no_flames, kể cả khi đủ đèn sáng", () => {
  const scn = base({ player: { flames: 0 }, lanterns: lit("L1", "L2", "L3", "L4", "L5") });
  const lines = run(scn, null, 5);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.equal(end(lines).state, "lost");
  assert.equal(end(lines).score, 0); // thua thì không có điểm thưởng
});

test("R8: Bóng Mực đứng cạnh Mây lúc thắp đèn bị đẩy ra và không gây sát thương", () => {
  const scn = base({ player: { carried: 10, flames: 1 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, ...lit4], shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, press(0, "interact"), 5);
  assert.equal(events(lines, "player_hit").length, 0);
  assert.equal(end(lines).state, "playing"); // Ticket-03: không còn thắng sớm
});

// ---- R9 ----
test("R9: dựng scenario không phát event (trừ night_start) và không cộng điểm", () => {
  const scn = base({ player: { carried: 3 }, lanterns: [{ id: "L2", lit: true }] });
  const lines = run(scn, null, 0);
  assert.equal(events(lines).filter((e) => e.name !== "night_start").length, 0);
  assert.equal(snaps(lines)[0].score, 0);
  assert.equal(snaps(lines)[0].lanterns[1].lit, true);
  assert.equal(snaps(lines)[0].lanterns[1].deposited, 10);
});

// ---- R10 ----
test("R10: random_shades:false thì không có shade_spawned; true thì theo lịch 2 con ở tick 300, rồi mỗi 480 tick", () => {
  const off = run(base(), null, 1500, { snapshotEvery: 500 });
  assert.equal(events(off, "shade_spawned").length, 0);
  assert.equal(last(off).shades.length, 0);
  const on = run(base({ random_shades: true, player: { flames: 100 } }), null, 800, { snapshotEvery: 100 });
  const sp = events(on, "shade_spawned");
  assert.deepEqual(sp.map((e) => [e.tick, e.data.id]), [[300, "S1"], [300, "S2"], [780, "S3"]]);
});

test("R10: cùng seed, scenario, inputs cho output giống hệt; khác seed thì khác (cả 3 đêm)", () => {
  const frames = [{ tick: 0, move: [1, 0.5] }, { tick: 400, move: [-1, 1], pulse: true }, { tick: 401, pulse: false }];
  for (const night of [1, 2, 3]) {
    const a = JSON.stringify(run({}, frames, 3000, { seed: 42, night, snapshotEvery: 7 }));
    const b = JSON.stringify(run({}, frames, 3000, { seed: 42, night, snapshotEvery: 7 }));
    const c = JSON.stringify(run({}, frames, 3000, { seed: 43, night, snapshotEvery: 7 }));
    assert.equal(a, b, `đêm ${night}`);
    assert.notEqual(a, c, `đêm ${night}`);
  }
});

test("R10: tọa độ làm tròn 3 chữ số thập phân", () => {
  const lines = run({}, [{ tick: 0, move: [1, 0.37], cam_yaw_deg: 13 }], 200);
  const r = (v) => assert.equal(v, Math.round(v * 1000) / 1000);
  for (const s of snaps(lines)) {
    s.player.pos.forEach(r);
    s.player.vel.forEach(r);
    for (const m of s.motes) m.pos.forEach(r);
  }
});

test("R10: màn mặc định có 20 đom đóm ở 20 điểm khác nhau và 5 đèn đúng tọa độ chuẩn", () => {
  const s0 = snaps(run({}, null, 0))[0];
  assert.equal(s0.motes_active, 20);
  assert.equal(new Set(s0.motes.map((m) => m.pos.join())).size, 20);
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
});

// ---- R11 (mức hàm) ----
test("R11: inputs sai định dạng ném ContractError mã 2", () => {
  const bad = [
    { frames: [{ tick: 5 }, { tick: 5 }] },
    { frames: [{ tick: 5 }, { tick: 3 }] },
    { frames: [{ tick: 0, move: [2, 0] }] },
    { frames: [{ tick: 0, move: [0] }] },
    { frames: [{ tick: 0, jump: "yes" }] },
    { frames: [{ tick: 0, pause: 1 }] },
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
    { player: { dash_cd_ticks: -1 } },
    { motes: [[0, 0]] },
    { shades: [{ id: "A", pos: [0, 0, 0] }, { id: "A", pos: [1, 0, 0] }] },
    { shades: [{ pos: [0, 0, 0], state: "dead" }] },
    { drifters: [{ pos: [0, 0, 0], state: "x" }] },
    { charms: [{ id: "C1" }] },
    { lanterns: [{ id: "L9" }] },
    { random_drifters: "no" },
    { time_left_s: -1 },
    "scenario",
  ];
  for (const scenario of bad) {
    assert.throws(() => runHeadless({ seed: 1, ticks: 1, scenario }), (e) => e instanceof ContractError && e.exitCode === 2);
  }
});
