// Luật mới của Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2). Quyết định thiết kế: docs/notes/ADR-001.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, DEFAULT_INPUT } from "../src/core/game.js";
import { runHeadless } from "../src/core/run.js";
import { ContractError } from "../src/core/validate.js";
import { base, run, snaps, events, end, last, at, near, horiz, press, lit } from "./helpers.js";

const lantern = (id, pos, fuel) => ({ id, pos, lit: true, ...(fuel === undefined ? {} : { fuel }) });

// ---------- F1: nhiên liệu đèn ----------
test("F1: thắp bằng scenario lit:true không có fuel thì fuel = 100; đèn tắt có fuel 0", () => {
  const s = snaps(run(base({ lanterns: lit("L1") }), null, 0))[0];
  assert.equal(s.lanterns[0].fuel, 100);
  assert.equal(s.lanterns[0].lit, true);
  assert.equal(s.lanterns[0].ever_lit, true);
  assert.equal(s.lanterns[1].fuel, 0);
  assert.equal(s.lanterns[1].ever_lit, false);
  assert.equal(s.lanterns[1].relit_count, 0);
});

test("F1: đèn đang sáng hao 1 fuel mỗi giây (1/60 mỗi tick), tính theo đơn vị nguyên", () => {
  const lines = run(base({ lanterns: lit("L1") }), null, 600);
  assert.equal(at(lines, 60).lanterns[0].fuel, 99);
  assert.equal(at(lines, 600).lanterns[0].fuel, 90);
  assert.equal(at(lines, 600).lanterns[1].fuel, 0); // đèn chưa sáng không hao
});

test("F1: hết dầu thì lantern_out, đèn tắt, deposited = 0, nhớ ever_lit", () => {
  const scn = base({ lanterns: [lantern("L1", [20, 0, 20], 0.5)] });
  const lines = run(scn, null, 40);
  assert.deepEqual(events(lines, "lantern_out").map((e) => [e.tick, e.data]), [[30, { lantern_id: "L1" }]]);
  const l = at(lines, 30).lanterns[0];
  assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
  assert.equal(at(lines, 29).lanterns[0].lit, true);
});

test("F1: ánh sáng của đèn tắt giảm: đèn tắt không còn nằm trong số đèn sáng ở bình minh", () => {
  const scn = base({ time_left_s: 2, lanterns: [lantern("L1", [20, 0, 20], 1), ...lit("L2", "L3")] });
  const lines = run(scn, null, 200);
  assert.equal(events(lines, "lantern_out").length, 1);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "dawn" }); // còn 2/5 < 3
});

// ---------- F2: châm dầu, thắp lại ----------
test("F2: châm dầu: used = min(mang, ceil((100 - fuel) / 10)), +10 fuel mỗi đom đóm, +5 điểm mỗi đom đóm", () => {
  // fuel 40 hao thêm 1 tick trước khi tương tác: 39.98 -> cần ceil(6.0017) = 7 đom đóm để đầy
  const full = run(base({ player: { carried: 10 }, lanterns: [lantern("L1", [0, 0, 1], 40)] }), press(0, "interact"), 3);
  assert.deepEqual(events(full, "refuel")[0].data, { lantern_id: "L1", amount: 7, fuel: 100 });
  assert.equal(at(full, 1).player.carried, 3);
  assert.equal(at(full, 1).score, 35);
  // không đủ đom đóm: chỉ châm theo số đang mang
  const part = run(base({ player: { carried: 2 }, lanterns: [lantern("L1", [0, 0, 1], 40)] }), press(0, "interact"), 3);
  assert.deepEqual(events(part, "refuel")[0].data, { lantern_id: "L1", amount: 2, fuel: 60 });
  assert.equal(at(part, 1).player.carried, 0);
});

test("F2: đèn đầy dầu (used = 0) không được chọn, không phát sự kiện, không cộng điểm; đèn kế bên nhận", () => {
  const g = new Game({ scenario: base({ player: { carried: 3 }, lanterns: [lantern("L1", [0, 0, 1]), { id: "L2", pos: [0, 0, 1.5] }] }) });
  g.lanterns[0].fuelU = 6001; // sau khi hao 1 đơn vị ở bước 2 thì đúng đầy (100)
  g.step({ ...DEFAULT_INPUT(), interact: true });
  assert.deepEqual(g.events.map((e) => e.name), ["deposit"]);
  assert.equal(g.events[0].data.lantern_id, "L2");
});

test("F2: thắp lại đèn đã từng sáng chỉ cần 5 đom đóm, +40 điểm, lantern_lit relight:true, relit_count tăng", () => {
  const scn = base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: false, ever_lit: true }] });
  const lines = run(scn, press(0, "interact"), 3);
  assert.deepEqual(events(lines, "deposit")[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
  assert.deepEqual(events(lines, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
  const s = at(lines, 1);
  assert.equal(s.score, 5 * 5 + 40);
  assert.equal(s.lanterns[0].fuel, 100);
  assert.equal(s.lanterns[0].relit_count, 1);
});

test("F2: đèn chưa từng sáng vẫn cần 10 đom đóm (5 chưa đủ)", () => {
  const lines = run(base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] }), press(0, "interact"), 3);
  assert.equal(events(lines, "lantern_lit").length, 0);
  assert.equal(last(lines).lanterns[0].deposited, 5);
});

test("F2: vòng đời đèn: thắp, hết dầu, thắp lại bằng 5 đom đóm", () => {
  const scn = base({ player: { carried: 15 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] });
  const frames = [...press(0, "interact"), ...press(1900, "interact")];
  const lines = run(scn, frames, 1910);
  // 15 mang: thắp (10), còn 5. Đèn hao 1/s nên tại tick 1901 vẫn còn dầu (100 - 31.7) và bấm lại sẽ châm dầu
  assert.equal(events(lines, "lantern_lit")[0].data.relight, false);
  assert.ok(events(lines, "refuel").length >= 1);
  const out = run(base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1], fuel: 0.5 }] }), press(60, "interact"), 70);
  assert.equal(events(out, "lantern_out").length, 1);
  assert.deepEqual(events(out, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
});

// ---------- F3: Bóng Mực hút dầu ----------
test("F3: đèn fuel < 30 mất vùng an toàn, đúng 30 vẫn còn", () => {
  const keep = new Game({ scenario: base({ lanterns: [lantern("L1", [0, 0, 20], 30 + 1 / 60)] }) });
  keep.step(DEFAULT_INPUT()); // sau hao: đúng 30.0
  assert.equal(keep.zoneLanterns().length, 1);
  const lose = new Game({ scenario: base({ lanterns: [lantern("L1", [0, 0, 20], 30)] }) });
  lose.step(DEFAULT_INPUT()); // sau hao: 29.98
  assert.equal(lose.zoneLanterns().length, 0);
});

test("F3: Bóng Mực wander đi tới đèn yếu, tới <= 2 m thì chuyển drain, đứng yên và hút", () => {
  const scn = base({ lanterns: [lantern("L1", [20, 0, 0], 20)], shades: [{ pos: [26, 1, 0], state: "wander" }] });
  const lines = run(scn, null, 400);
  const drainTick = snaps(lines).find((s) => s.shades[0].state === "drain").tick;
  assert.ok(drainTick > 100 && drainTick < 140, `drain bắt đầu ở tick ${drainTick}`);
  assert.equal(at(lines, drainTick).shades[0].target_lantern_id, "L1");
  const p1 = at(lines, drainTick + 10).shades[0].pos;
  const p2 = at(lines, drainTick + 50).shades[0].pos;
  assert.deepEqual(p1, p2); // đứng yên khi hút
  assert.ok(horiz(p1, [20, 0, 0]) <= 2.001);
  // hút 5 + hao 1 = 6 fuel/giây
  const f = (t) => at(lines, t).lanterns[0].fuel;
  near(f(drainTick + 60) - f(drainTick + 120), 6, 0.15);
  // fuel_drain ghi mỗi 60 tick khi đang hút
  const fd = events(lines, "fuel_drain");
  assert.ok(fd.length >= 2);
  assert.equal(fd[1].tick - fd[0].tick, 60);
  assert.deepEqual([fd[0].data.lantern_id, fd[0].data.shade_id], ["L1", "S1"]);
  // hết dầu thì đèn tắt và Bóng Mực rời drain về wander
  assert.equal(events(lines, "lantern_out").length, 1);
  assert.notEqual(last(lines).shades[0].state, "drain");
});

test("F3: nhiều Bóng Mực cùng hút thì cộng dồn", () => {
  const scn = base({ lanterns: [lantern("L1", [20, 0, 0], 28)], shades: [{ pos: [21.5, 1, 0], state: "drain" }, { pos: [18.5, 1, 0], state: "drain" }] });
  const lines = run(scn, null, 120);
  near(at(lines, 0).lanterns[0].fuel - at(lines, 60).lanterns[0].fuel, 11, 0.15); // 2 x 5 + 1 mỗi giây
});

test("F3: wander không có đèn yếu thì đi về đèn tắt gần nhất như trước", () => {
  // 4 đèn còn lại sáng đầy dầu nên L1 là đèn tắt duy nhất (mặc định cả 5 đèn đều tắt, L2 sẽ gần hơn)
  const scn = base({ lanterns: [{ id: "L1", pos: [20, 0, 0] }, ...lit("L2", "L3", "L4", "L5")], shades: [{ pos: [30, 1, 0], state: "wander" }] });
  const lines = run(scn, null, 120);
  assert.ok(at(lines, 120).shades[0].pos[0] < at(lines, 0).shades[0].pos[0] - 3); // L1 gần nhất trong các đèn tắt
});

test("F3: chọn đèn yếu gần nhất; target_lantern_id của scenario được giữ nếu còn hợp lệ", () => {
  const lanterns = [lantern("L1", [10, 0, 0], 20), lantern("L2", [30, 0, 0], 20)];
  const free = run(base({ lanterns, shades: [{ pos: [20, 1, 0], state: "wander" }] }), null, 60);
  const forced = run(base({ lanterns, shades: [{ pos: [20, 1, 0], state: "wander", target_lantern_id: "L2" }] }), null, 60);
  assert.ok(last(free).shades[0].pos[0] < 20); // gần nhất: L1 (hòa khoảng cách thì id nhỏ)
  assert.ok(last(forced).shades[0].pos[0] > 20);
  assert.equal(last(forced).shades[0].target_lantern_id, "L2");
});

test("F3: Bóng Mực đã chase không đổi mục tiêu sang đèn yếu", () => {
  const scn = base({ lanterns: [lantern("L1", [20, 0, 0], 20)], shades: [{ pos: [3, 1, 0] }] });
  assert.equal(at(run(scn, null, 5), 5).shades[0].state, "chase");
});

test("F3: drain -> chase khi Mây vào trong 6 m", () => {
  const scn = base({ lanterns: [lantern("L1", [10, 0, 0], 20)], shades: [{ pos: [10.5, 1, 0], state: "drain" }] });
  const lines = run(scn, [{ tick: 0, move: [1, 0] }], 150);
  const st = snaps(lines).map((s) => s.shades[0].state);
  assert.equal(st[0], "drain");
  assert.ok(st.includes("chase"));
  assert.ok(st.indexOf("chase") > 20); // Mây đi mất vài giây mới vào 6 m
});

test("F3: drain -> wander khi cách đèn > 2 m; trúng tỏa sáng -> stunned và +15 điểm (5 + 10)", () => {
  const far = run(base({ lanterns: [lantern("L1", [10, 0, 0], 20)], shades: [{ pos: [20, 1, 0], state: "drain", target_lantern_id: "L1" }] }), null, 2);
  assert.equal(at(far, 1).shades[0].state, "wander");
  const drain = run(base({ player: { carried: 3 }, lanterns: [lantern("L1", [4, 0, 0], 20)], shades: [{ pos: [4, 1, 0], state: "drain" }] }), press(0, "pulse"), 3);
  assert.equal(at(drain, 1).shades[0].state, "stunned");
  assert.equal(at(drain, 1).score, 15);
  const normal = run(base({ player: { carried: 3 }, shades: [{ pos: [4, 1, 0] }] }), press(0, "pulse"), 3);
  assert.equal(at(normal, 1).score, 5);
});

test("F3: châm dầu lên >= 30 lúc Bóng Mực trong 6 m: bị đẩy ra mép, không gây sát thương, về wander", () => {
  const scn = base({ player: { pos: [9, 0, 0], carried: 4 }, lanterns: [lantern("L1", [10, 0, 0], 20)], shades: [{ pos: [10.5, 1, 0], state: "drain" }] });
  const lines = run(scn, press(0, "interact"), 60);
  assert.equal(events(lines, "refuel")[0].tick, 1);
  assert.equal(events(lines, "player_hit").length, 0);
  assert.ok(horiz(at(lines, 60).shades[0].pos, [10, 0, 0]) >= 5.99);
  assert.ok(at(lines, 1).lanterns[0].fuel >= 30);
});

test("F3: hết choáng thì về wander", () => {
  const scn = base({ player: { carried: 3 }, shades: [{ pos: [4, 1, 0] }] });
  assert.equal(at(run(scn, press(0, "pulse"), 125), 121).shades[0].state, "wander");
});

// ---------- F4: luật thắng mới ----------
test("F4: không thắng sớm: đủ đèn vẫn chơi tới bình minh, thắng với điểm bình minh", () => {
  const scn = base({ time_left_s: 5, lanterns: lit("L1", "L2", "L3", "L4", "L5") });
  const lines = run(scn, null, 1000);
  assert.equal(at(lines, 299).state, "playing");
  assert.deepEqual(events(lines, "game_over")[0], { type: "event", tick: 300, name: "game_over", data: { result: "won", reason: "dawn_survived" } });
  assert.equal(end(lines).ticks, 300);
  // fuel mỗi đèn còn 95: 5 x (50 + 95) + 3 lửa x 50 = 875; không còn thưởng thời gian
  assert.equal(end(lines).score, 875);
});

test("F4: ngưỡng thắng ceil(0.6 x tổng): 3/5, 4/6, 5/7", () => {
  const cases = [[1, 2, "lost"], [1, 3, "won"], [2, 3, "lost"], [2, 4, "won"], [3, 4, "lost"], [3, 5, "won"]];
  for (const [night, n, expect] of cases) {
    const ids = Array.from({ length: n }, (_, i) => `L${i + 1}`);
    const lines = run(base({ time_left_s: 1, lanterns: lit(...ids) }), null, 100, { night });
    assert.equal(end(lines).state, expect, `đêm ${night} với ${n} đèn`);
    assert.equal(events(lines, "game_over")[0].data.reason, expect === "won" ? "dawn_survived" : "dawn");
  }
});

test("F4: đèn tắt đúng tick cuối thì không tính; còn sáng ở tick cuối thì tính", () => {
  const mk = (fuel3) => base({ time_left_s: 1, lanterns: [...lit("L1", "L2"), lantern("L3", [20, 0, 20], fuel3)] });
  assert.equal(end(run(mk(1), null, 100)).state, "lost"); // fuel 1.0 hao hết đúng tick 60, tắt ở bước 2 trước khi xét thắng
  assert.equal(end(run(mk(1 + 1 / 60), null, 100)).state, "won");
});

test("F4: hết Ngọn Lửa luôn thua no_flames, kể cả ở tick bình minh dù đủ đèn", () => {
  const scn = base({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lit("L1", "L2", "L3", "L4", "L5"), shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 5);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
});

test("F4: điểm bình minh: mỗi đèn sáng +50 + floor(fuel), mỗi lửa +50; thua thì không có", () => {
  const scn = base({ time_left_s: 1, lanterns: [lantern("L1", [20, 0, 20], 70), lantern("L2", [-20, 0, 20], 40.5), ...lit("L3")] });
  const w = run(scn, null, 100);
  // sau 60 tick hao 1: 69, 39.5, 99 -> (50+69) + (50+39) + (50+99) + 3 x 50
  assert.equal(end(w).score, 119 + 89 + 149 + 150);
  assert.equal(end(run(base({ time_left_s: 1 }), null, 100)).score, 0);
});

// ---------- F5: sức chứa ----------
test("F5: sức chứa = 10 + 2 x successful_lights, tối đa 20; đèn đặt sẵn bằng scenario không tính", () => {
  assert.equal(snaps(run(base({ lanterns: lit("L1", "L2") }), null, 0))[0].player.capacity, 10);
  assert.equal(snaps(run(base({ player: { successful_lights: 3 } }), null, 0))[0].player.capacity, 16);
  assert.equal(snaps(run(base({ player: { successful_lights: 9 } }), null, 0))[0].player.capacity, 20);
});

test("F5: mỗi lần thắp thành công (cả thắp lại) tăng sức chứa 2; châm dầu không tăng", () => {
  const scn = base({ player: { carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }, { id: "L2", pos: [0, 0, 3.5], ever_lit: true }] });
  const lines = run(scn, press(0, "interact"), 3);
  assert.equal(at(lines, 1).player.capacity, 12);
  const refuel = run(base({ player: { carried: 3 }, lanterns: [lantern("L1", [0, 0, 1], 20)] }), press(0, "interact"), 3);
  assert.equal(at(refuel, 1).player.capacity, 10);
});

test("F5: nhặt đom đóm theo sức chứa mới", () => {
  const scn = base({ player: { carried: 15, successful_lights: 3 }, motes: [[0, 0, 0.5], [0, 0, 0.6]] });
  const lines = run(scn, null, 3);
  assert.equal(last(lines).player.carried, 16); // sức chứa 16: nhặt 1 con rồi đầy
  assert.equal(last(lines).motes_active, 1);
});

// ---------- F6: định dạng v1.2 ----------
test("F6: snapshot có fuel (1 chữ số thập phân), ever_lit, relit_count, capacity; trạng thái drain hợp lệ", () => {
  const lines = run(base({ lanterns: [lantern("L1", [20, 0, 20], 50.123)] }), null, 7);
  for (const s of snaps(lines)) for (const l of s.lanterns) assert.equal(l.fuel, Math.round(l.fuel * 10) / 10);
  const s = snaps(runHeadless({ seed: 1, ticks: 0, scenario: base({ shades: [{ pos: [20, 1, 0], state: "drain" }] }) }))[0];
  assert.equal(s.shades[0].state, "drain");
});

test("F6: scenario sai định dạng v1.2 ném ContractError mã 2", () => {
  const bad = [
    { lanterns: [{ id: "L1", fuel: 101 }] },
    { lanterns: [{ id: "L1", fuel: -1 }] },
    { lanterns: [{ id: "L1", ever_lit: "x" }] },
    { player: { successful_lights: -1 } },
    { shades: [{ pos: [0, 0, 0], target_lantern_id: "L9" }] },
  ];
  for (const scenario of bad) {
    assert.throws(() => runHeadless({ seed: 1, ticks: 1, scenario }), (e) => e instanceof ContractError && e.exitCode === 2);
  }
});

test("F6: không còn sinh game_over all_lit trong bất kỳ ván nào (cả 3 đêm, seed khác nhau)", () => {
  for (const night of [1, 2, 3]) {
    for (const seed of [1, 2, 3]) {
      const lines = run({ player: { flames: 1000 } }, [{ tick: 0, move: [0.3, 1] }], 3000, { night, seed, snapshotEvery: 500 });
      assert.ok(events(lines, "game_over").every((e) => e.data.reason !== "all_lit"));
    }
  }
});
