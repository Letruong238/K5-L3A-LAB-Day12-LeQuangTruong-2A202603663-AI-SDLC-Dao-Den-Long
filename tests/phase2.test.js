// Tính năng mới của Phase 2 (Ticket-02, Contract v1.1). Tiêu chí S1 đến S14: docs/notes/phase2-spec.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, DEFAULT_INPUT } from "../src/core/game.js";
import { base, run, snaps, events, end, last, at, near, horiz, press, lit } from "./helpers.js";

const step = (g, n, input = DEFAULT_INPUT()) => {
  for (let i = 0; i < n; i++) g.step(input);
};

// ---------- S1: chạy, nhảy ----------
test("S1: tăng tốc đạt 6 m/s trong 5 tick, dừng trong 5 tick", () => {
  const lines = run(base(), [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }], 40);
  near(at(lines, 1).player.vel[2], 1.2, 0.01);
  near(at(lines, 5).player.vel[2], 6, 0.01);
  near(at(lines, 30).player.vel[2], 6, 0.01);
  near(at(lines, 35).player.vel[2], 0, 0.01);
  assert.ok(at(lines, 33).player.vel[2] > 0);
});

test("S1: nhảy 7 m/s, trọng lực -20: đỉnh khoảng 1.17 m, chạm đất lại, chỉ nhảy khi đứng đất", () => {
  const lines = run(base(), [...press(0, "jump"), ...press(5, "jump")], 90);
  const ys = snaps(lines).map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 1.1 && Math.max(...ys) < 1.25, `max y=${Math.max(...ys)}`);
  assert.equal(at(lines, 1).player.grounded, false);
  assert.equal(ys.at(-1), 0);
  assert.equal(last(lines).player.grounded, true);
});

test("S1: điều khiển trên không đầy đủ (đổi hướng khi đang nhảy)", () => {
  const lines = run(base(), [{ tick: 0, jump: true, move: [1, 0] }, { tick: 1, jump: false }, { tick: 10, move: [-1, 0] }], 25);
  assert.ok(at(lines, 9).player.vel[0] > 5);
  assert.ok(at(lines, 20).player.vel[0] < -5);
  assert.equal(at(lines, 20).player.grounded, false);
});

// ---------- S2: lướt ----------
test("S2: lướt 14 m/s trong 12 tick theo hướng đang quay mặt, rồi dừng; có sự kiện dash", () => {
  const lines = run(base(), press(0, "dash"), 30);
  assert.deepEqual(events(lines, "dash").map((e) => e.tick), [1]);
  near(at(lines, 12).player.pos[2], (14 * 12) / 60, 0.01); // hướng ban đầu +Z
  near(at(lines, 12).player.vel[2], 14, 0.01);
  near(at(lines, 20).player.pos[2], 2.8, 0.01);
  assert.equal(at(lines, 20).player.invuln, 0); // không bất tử khi lướt
});

test("S2: lướt theo hướng đang di chuyển", () => {
  const lines = run(base(), [{ tick: 0, move: [1, 0], dash: true }, { tick: 1, dash: false }], 14);
  assert.ok(at(lines, 12).player.pos[0] > 2.5);
  near(at(lines, 12).player.pos[2], 0, 0.001);
});

test("S2: hồi chiêu 1.5 s tính từ lúc bắt đầu lướt (90 tick)", () => {
  // bấm ở tick 89 (còn 1 tick hồi) bị từ chối; bấm ở tick 90 được chấp nhận
  assert.deepEqual(events(run(base(), [...press(0, "dash"), ...press(60, "dash"), ...press(88, "dash")], 120), "dash").map((e) => e.tick), [1]);
  assert.deepEqual(events(run(base(), [...press(0, "dash"), ...press(90, "dash")], 120), "dash").map((e) => e.tick), [1, 91]);
  near(at(run(base(), press(0, "dash"), 10), 10).player.dash_cd_s, 81 / 60, 0.001); // bắt đầu ở tick 1, đã giảm 9 tick
});

test("S2: lướt trên không giữ nguyên độ cao", () => {
  const frames = [...press(0, "jump"), ...press(8, "dash")];
  const lines = run(base(), frames, 30);
  const y0 = at(lines, 10).player.pos[1];
  assert.ok(y0 > 0.5);
  for (let t = 10; t <= 20; t++) near(at(lines, t).player.pos[1], y0, 1e-6);
});

// ---------- S3: rơi khỏi đảo ----------
test("S3: rơi khỏi đảo: đúng 1 lần mất lửa và đom đóm, chờ 60 tick rồi hồi sinh bất tử 90 tick", () => {
  const scn = base({ player: { pos: [39.9, 0, 0], carried: 5, invuln_ticks: 1000 } });
  const lines = run(scn, [{ tick: 0, move: [1, 0] }], 300);
  const falls = events(lines, "player_hit").filter((e) => e.data.by === "fall");
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: "fall", flames: 2, dropped: 0, lost: 5 }); // bỏ qua bất tử
  const F = falls[0].tick;
  assert.ok(at(lines, F).player.pos[1] < -10);
  assert.ok(at(lines, F + 59).player.pos[1] < -10);
  const back = at(lines, F + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.deepEqual(back.player.vel, [0, 0, 0]);
  assert.equal(back.player.invuln, 90);
  assert.equal(back.player.carried, 0);
  assert.equal(back.player.flames, 2);
});

test("S3: đang chờ hồi sinh thì không nhặt đồ", () => {
  const scn = base({ player: { pos: [39.9, 0, 0] }, motes: [[41, -30, 0]] });
  assert.equal(events(run(scn, [{ tick: 0, move: [1, 0] }], 100), "mote_picked").length, 0);
});

test("S3: rơi khi hết lửa thì thua ngay, không hồi sinh", () => {
  const scn = base({ player: { pos: [39.9, 0, 0], flames: 1 } });
  const lines = run(scn, [{ tick: 0, move: [1, 0] }], 300);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.equal(end(lines).state, "lost");
  assert.ok(end(lines).ticks < 100);
});

// ---------- S4: Bóng Mực ----------
test("S4: phát hiện 12 m, bỏ đuổi 18 m", () => {
  const near12 = at(run(base({ shades: [{ pos: [11, 1, 0] }, { pos: [13, 1, 0] }] }), null, 0), 0);
  assert.deepEqual(near12.shades.map((s) => s.state), ["chase", "wander"]);
  const lines = run(base({ shades: [{ id: "A", pos: [19, 1, 0], state: "chase" }, { id: "B", pos: [17, 1, 0], state: "chase" }] }), null, 1);
  assert.deepEqual(at(lines, 1).shades.map((s) => s.state), ["wander", "chase"]);
});

test("S4: wander chuyển chase khi Mây lại gần (<= 12 m)", () => {
  const lines = run(base({ player: { flames: 100 }, shades: [{ pos: [22, 1, 0], state: "wander" }] }), [{ tick: 0, move: [1, 0] }], 300);
  const states = snaps(lines).map((s) => s.shades[0].state);
  assert.equal(states[0], "wander");
  assert.ok(states.includes("chase"));
});

test("S4: spawning không gây sát thương trong 30 tick rồi thành chase", () => {
  const scn = base({ player: { flames: 5 }, shades: [{ pos: [0.5, 1, 0], state: "spawning", state_ticks_left: 30 }] });
  const lines = run(scn, null, 40);
  assert.equal(at(lines, 29).shades[0].state, "spawning");
  assert.deepEqual(events(lines, "player_hit").map((e) => e.tick), [30]);
});

test("S4: chạm: recoil lùi 2 m trong 60 tick; đom đóm rơi ở vành 1.5-2.5 m, tồn tại 480 tick", () => {
  const scn = base({ player: { carried: 7 }, shades: [{ pos: [0.5, 1, 0] }] });
  const lines = run(scn, null, 62);
  const d1 = horiz(at(lines, 1).shades[0].pos, [0, 0, 0]);
  const d61 = horiz(at(lines, 61).shades[0].pos, [0, 0, 0]);
  near(d61 - d1, 2, 0.01);
  assert.equal(at(lines, 30).shades[0].state, "recoil");
  assert.equal(at(lines, 61).shades[0].state, "chase");
  const drops = at(lines, 1).motes;
  assert.equal(drops.length, 3); // floor(7/2)
  for (const m of drops) {
    assert.equal(m.kind, "dropped");
    assert.equal(m.ttl_s, 8);
    const r = horiz(m.pos, [0, 0, 0]);
    assert.ok(r >= 1.49 && r <= 2.51, `r=${r}`);
  }
  assert.equal(at(lines, 1).player.carried, 4);
});

test("S4: tối đa 1 lần mất lửa mỗi tick, bóng chạm lúc bất tử không làm gì", () => {
  const two = run(base({ shades: [{ pos: [0.5, 1, 0] }, { pos: [-0.5, 1, 0] }] }), null, 3);
  assert.deepEqual(events(two, "player_hit").map((e) => e.tick), [1]);
  assert.equal(last(two).player.flames, 2);
  const inv = run(base({ player: { invuln_ticks: 100 }, shades: [{ pos: [0.5, 1, 0] }] }), null, 90);
  assert.equal(events(inv, "player_hit").length, 0);
  assert.equal(last(inv).shades[0].state, "chase"); // không recoil
});

test("S4: đom đóm rơi hết hạn sau 480 tick, nhặt lại được từ tick sau", () => {
  const g = new Game({ scenario: base() });
  g.dropMotes(2, 5, 5, false);
  step(g, 479);
  assert.equal(g.motes.length, 2);
  step(g, 1);
  assert.equal(g.motes.length, 0);
  const h = new Game({ scenario: base() });
  h.dropMotes(1, 0, 0, false);
  h.step(DEFAULT_INPUT());
  assert.equal(h.player.carried, 1); // đặt ở tick 0, nhặt được ở tick 1
});

// ---------- S5: tỏa sáng ----------
test("S5: trùng vị trí thì đẩy lùi theo +X", () => {
  const scn = base({ player: { carried: 3, invuln_ticks: 1000 }, shades: [{ pos: [0, 1, 0] }] });
  const lines = run(scn, press(0, "pulse"), 16);
  near(at(lines, 15).shades[0].pos[0], 4, 0.01);
  near(at(lines, 15).shades[0].pos[2], 0, 0.01);
});

test("S5: đẩy lùi dừng khi gặp vật cản (mép vùng an toàn của đèn sáng)", () => {
  const scn = base({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [12, 0, 0], lit: true }], shades: [{ pos: [3, 1, 0] }] });
  const lines = run(scn, press(0, "pulse"), 30);
  const x = at(lines, 30).shades[0].pos[0];
  assert.ok(x > 5.5 && x < 6.01, `x=${x}`);
});

test("S5: pulse lại làm mới choáng và đẩy lùi, mỗi con mỗi lần +5 điểm kể cả đang choáng", () => {
  const scn = base({ player: { carried: 6, invuln_ticks: 1000 }, shades: [{ pos: [2, 1, 0] }] });
  const lines = run(scn, [...press(0, "pulse"), ...press(180, "pulse")], 200);
  assert.equal(events(lines, "pulse").length, 2);
  assert.equal(last(lines).score, 10);
  assert.equal(at(lines, 182).shades[0].state_ticks_left, 120 - 1); // choáng mới 120 tick
});

// ---------- S6: vùng an toàn ----------
test("S6: Bóng Mực ở trong vùng lúc đèn vừa thắp bị đẩy ra mép, không gây sát thương", () => {
  const scn = base({ player: { carried: 10, flames: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }], shades: [{ pos: [0, 1, 0.5] }] });
  const lines = run(scn, press(0, "interact"), 60);
  assert.equal(events(lines, "player_hit").length, 0);
  assert.ok(horiz(at(lines, 5).shades[0].pos, [0, 0, 1]) < horiz(at(lines, 20).shades[0].pos, [0, 0, 1]));
  assert.ok(horiz(at(lines, 60).shades[0].pos, [0, 0, 1]) >= 5.99);
});

test("S6: điểm sinh Bóng Mực trong vùng đèn sáng hoặc cách Mây dưới 15 m bị loại", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const scn = base({ random_shades: true, player: { pos: [37, 0, 0], flames: 100 }, lanterns: [{ id: "L1", pos: [35.7, 0, 9.6], lit: true }] });
    const lines = run(scn, null, 300, { seed, snapshotEvery: 300 });
    const sh = last(lines).shades;
    assert.equal(sh.length, 2, `seed ${seed}`);
    for (const s of sh) {
      assert.ok(horiz(s.pos, [37, 0, 0]) >= 15 - 0.01, `seed ${seed}: cách Mây ${horiz(s.pos, [37, 0, 0])}`);
      assert.ok(horiz(s.pos, [35.7, 0, 9.6]) >= 6 - 0.01);
    }
  }
});

// ---------- S8: lịch sinh ----------
test("S8: đom đóm: 20 ban đầu, +1 mỗi 240 tick tại điểm trống; hết điểm trống thì bỏ lượt", () => {
  // Đêm 1 chỉ có 24 điểm sinh nên tối đa 24 con dù trần là 30 (ticket: hết điểm trống thì bỏ lượt)
  const lines = run({ random_shades: false, player: { flames: 100 } }, null, 3000, { snapshotEvery: 10 });
  assert.equal(at(lines, 0).motes_active, 20);
  assert.equal(at(lines, 230).motes_active, 20);
  assert.equal(at(lines, 240).motes_active, 21);
  assert.equal(at(lines, 480).motes_active, 22);
  assert.equal(Math.max(...snaps(lines).map((s) => s.motes_active)), 24);
  const pts = last(lines).motes.filter((m) => m.kind === "random").map((m) => m.pos.join());
  assert.equal(new Set(pts).size, pts.length);
});

test("S8: trần 30 đom đóm (Đêm 3 có đúng 30 điểm sinh)", () => {
  const lines = run({ random_shades: false, wind_enabled: false, player: { flames: 100 } }, null, 3000, { night: 3, snapshotEvery: 10 });
  assert.equal(at(lines, 2390).motes_active, 29);
  assert.equal(at(lines, 2400).motes_active, 30);
  assert.equal(Math.max(...snaps(lines).map((s) => s.motes_active)), 30);
});

test("S8: Bóng Mực tối đa 6 ở Đêm 1 và không sinh lại sau khi đủ", () => {
  const lines = run(base({ random_shades: true, player: { flames: 100 } }), null, 3000, { snapshotEvery: 100 });
  assert.deepEqual(events(lines, "shade_spawned").map((e) => e.tick), [300, 300, 780, 1260, 1740, 2220]);
  assert.equal(last(lines).shades.length, 6);
});

test("S8: Đêm 2 sinh Bóng Mực mỗi 420 tick, Đêm 3 mỗi 360 tick", () => {
  const n2 = run(base({ random_shades: true, player: { flames: 100 } }), null, 1200, { night: 2, snapshotEvery: 100 });
  assert.deepEqual(events(n2, "shade_spawned").map((e) => e.tick), [300, 300, 720, 1140]);
  const n3 = run(base({ random_shades: true, player: { flames: 100 } }), null, 1100, { night: 3, snapshotEvery: 100 });
  assert.deepEqual(events(n3, "shade_spawned").map((e) => e.tick), [300, 300, 660, 1020]);
});

test("S8: Gió Lạc sinh tại tick 1200, 2400 (tối đa 2), chỉ ở Đêm 2 và 3", () => {
  const n2 = run(base({ random_drifters: true, player: { flames: 100 } }), null, 3700, { night: 2, snapshotEvery: 1 });
  assert.equal(at(n2, 1199).drifters.length, 0);
  assert.deepEqual(at(n2, 1200).drifters.map((d) => d.id), ["D1"]);
  assert.deepEqual(at(n2, 2400).drifters.map((d) => d.id).sort(), ["D1", "D2"]);
  assert.equal(at(n2, 3600).drifters.length, 2);
  const n1 = run(base({ player: { flames: 100 } }), null, 2500, { night: 1, snapshotEvery: 500 });
  assert.equal(last(n1).drifters.length, 0);
});

// ---------- S9: bản đồ Đêm 2 và Đêm 3 ----------
test("S9: Đêm 2: đi qua cầu tre sang đảo B không rơi; bước ra ngoài cầu thì rơi", () => {
  const cross = run(base(), [{ tick: 0, move: [1, 0] }], 700, { night: 2, snapshotEvery: 100 });
  assert.equal(events(cross, "player_hit").length, 0);
  assert.ok(last(cross).player.pos[0] > 60);
  const off = run(base({ player: { pos: [35, 0, 0] } }), [{ tick: 0, move: [0, 1] }], 200, { night: 2 });
  assert.equal(events(off, "player_hit")[0].data.by, "fall");
  // khoảng giữa hai đảo ngoài cầu là hư không
  assert.equal(events(run(base({ player: { pos: [35, 0, 3] } }), null, 120, { night: 2 }), "player_hit").length, 1);
});

test("S9: Đêm 2: bục nhảy bắn Mây sang đảo kia, phím di chuyển không ghi đè khi đang bay", () => {
  for (const mv of [[0, 0], [-1, 0], [0, 1]]) {
    const lines = run(base({ player: { pos: [20, 0, 18] } }), [{ tick: 0, move: mv }], 110, { night: 2 });
    assert.equal(events(lines, "player_hit").length, 0, `move ${mv}`);
    near(at(lines, 40).player.vel[0], 22.581, 0.01); // 24 m/s hướng tâm đảo B, bất kể phím
    near(at(lines, 40).player.vel[2], -8.129, 0.01);
    const p = at(lines, 84).player; // tick chạm đất
    assert.equal(p.grounded, true);
    near(p.pos[0], 51.237, 0.05);
    near(p.pos[2], 6.755, 0.05);
  }
  const back = at(run(base({ player: { pos: [50, 0, -18] } }), null, 110, { night: 2 }), 84).player;
  near(back.pos[0], 18.763, 0.05);
  near(back.pos[2], -6.755, 0.05);
  assert.equal(back.grounded, true);
});

test("S9: Đêm 3: vách đứng chặn, không đi lên tầng 2 hay tầng 1 từ phía dưới", () => {
  const t2 = last(run(base({ player: { pos: [0, 0, -9] } }), [{ tick: 0, move: [0, 1] }], 120, { night: 3 })).player;
  assert.ok(Math.hypot(t2.pos[0], t2.pos[2]) >= 7.9 && t2.pos[1] === 0, `${t2.pos}`);
  const t1 = last(run(base({ player: { pos: [0, 0, 10] } }), [{ tick: 0, move: [0, 1] }], 120, { night: 3 })).player;
  assert.ok(t1.pos[2] < 12.01 && t1.pos[1] === 0, `${t1.pos}`);
});

test("S9: Đêm 3: đi dốc lên tầng 1 (Y=3)", () => {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const lines = run(base({ player: { pos: [31 * c, 0, 31 * s] } }), [{ tick: 0, move: [-c, -s] }], 150, { night: 3, snapshotEvery: 10 });
  const ys = snaps(lines).map((x) => x.player.pos[1]);
  assert.ok(ys.some((y) => y > 1 && y < 3)); // đang trên dốc
  assert.equal(last(lines).player.pos[1], 3);
  assert.equal(last(lines).player.grounded, true);
});

test("S9: Đêm 3: bục nhảy đáp lên tầng 2; tháp chuông chặn", () => {
  const lines = run(base({ player: { pos: [0, 3, 13] } }), null, 90, { night: 3 });
  const p = last(lines).player;
  assert.equal(p.pos[1], 6);
  assert.equal(p.grounded, true);
  assert.ok(p.pos[2] > 5.5 && p.pos[2] < 7 && Math.abs(p.pos[0]) < 0.01, `${p.pos}`);
  const tower = last(run(base({ player: { pos: [0, 6, 5] } }), [{ tick: 0, move: [0, -1] }], 120, { night: 3 })).player;
  assert.ok(tower.pos[2] >= 1.99 && tower.pos[1] === 6, `${tower.pos}`);
});

test("S9: Đêm 3 xuất phát ở (0,0,-30), 7 đèn, 30 điểm đom đóm; Đêm 2 có 6 đèn và 1 bùa", () => {
  const n3 = snaps(run({}, null, 0, { night: 3 }))[0];
  assert.deepEqual(n3.player.pos, [0, 0, -30]);
  assert.equal(n3.lanterns.length, 7);
  assert.equal(n3.charms.length, 2);
  const n2 = snaps(run({}, null, 0, { night: 2 }))[0];
  assert.equal(n2.lanterns.length, 6);
  assert.equal(n2.charms.length, 1);
  assert.equal(n2.time_left_s, 330);
  assert.equal(n3.time_left_s, 360);
});

// ---------- S10: Gió Lạc ----------
test("S10: idle -> chase khi mang >= 5 và cách <= 15 m; chạm cướp min(3, mang) rồi flee 240 tick rồi biến mất", () => {
  const scn = base({ player: { carried: 6 }, drifters: [{ pos: [10, 1.5, 0] }] });
  const lines = run(scn, null, 330, { night: 2 });
  assert.equal(at(lines, 1).drifters[0].state, "chase");
  const steal = events(lines, "drifter_steal");
  assert.equal(steal.length, 1);
  assert.deepEqual(steal[0].data, { drifter_id: "D1", amount: 3, carried: 3 });
  assert.equal(at(lines, steal[0].tick).drifters[0].state, "flee");
  assert.equal(at(lines, steal[0].tick).drifters[0].stolen, 3);
  assert.equal(at(lines, steal[0].tick + 239).drifters.length, 1);
  assert.equal(at(lines, steal[0].tick + 240).drifters.length, 0);
  assert.equal(events(lines, "player_hit").length, 0); // không làm mất lửa
});

test("S10: mang dưới 5 hoặc cách xa hơn 15 m thì vẫn idle", () => {
  for (const [carried, x] of [[4, 5], [6, 20]]) {
    const lines = run(base({ player: { carried }, drifters: [{ pos: [x, 1.5, 0] }] }), null, 60, { night: 2 });
    assert.equal(last(lines).drifters[0].state, "idle", `carried ${carried}, x ${x}`);
  }
});

test("S10: tỏa sáng trúng Gió Lạc đang chase thì nó flee không cướp", () => {
  const scn = base({ player: { carried: 6 }, drifters: [{ pos: [4, 1.5, 0], state: "chase" }] });
  const lines = run(scn, press(0, "pulse"), 40, { night: 2 });
  assert.equal(events(lines, "drifter_steal").length, 0);
  assert.equal(at(lines, 1).drifters[0].state, "flee");
  assert.equal(at(lines, 1).drifters[0].stolen, 0);
  assert.equal(last(lines).player.carried, 3);
});

test("S10: tỏa sáng trúng Gió Lạc đang flee có mang đồ thì thả lại toàn bộ và biến mất sau 120 tick", () => {
  const scn = base({ player: { carried: 3 }, drifters: [{ pos: [3, 1.5, 0], state: "flee", stolen: 3 }] });
  const lines = run(scn, press(0, "pulse"), 130, { night: 2 });
  assert.deepEqual(events(lines, "drifter_drop")[0].data, { drifter_id: "D1", amount: 3 });
  assert.equal(at(lines, 1).motes.filter((m) => m.kind === "dropped").length, 3);
  assert.equal(at(lines, 1).drifters[0].stolen, 0);
  assert.equal(at(lines, 120).drifters.length, 1);
  assert.equal(at(lines, 121).drifters.length, 0);
});

test("S10: vùng an toàn của đèn không chặn Gió Lạc", () => {
  const scn = base({ player: { carried: 6, pos: [0, 0, 0] }, lanterns: [{ id: "L1", pos: [4, 0, 0], lit: true }], drifters: [{ pos: [10, 1.5, 0] }] });
  assert.equal(events(run(scn, null, 120, { night: 2 }), "drifter_steal").length, 1);
});

// ---------- S11: Bùa Gió ----------
test("S11: nhặt bùa: 600 tick, chạy 7.2 m/s, sự kiện, hồi lại sau 2700 tick", () => {
  const scn = base({ charms: [{ id: "C1", pos: [0, 0, 0.5] }] });
  const lines = run(scn, [{ tick: 0, move: [0, -1] }, { tick: 30, move: [0, 0] }, { tick: 590, move: [1, 0] }, { tick: 640, move: [0, 0] }], 2710, { snapshotEvery: 1 });
  assert.deepEqual(events(lines, "charm_picked")[0].data, { charm_id: "C1", charm_ticks: 600 });
  assert.equal(events(lines, "charm_picked")[0].tick, 1);
  assert.equal(at(lines, 1).player.charm_s, 10);
  assert.equal(at(lines, 1).charms[0].available, false);
  assert.equal(at(lines, 1).charms[0].respawn_s, 45);
  near(at(lines, 20).player.vel[2], -7.2, 0.01);
  assert.equal(at(lines, 601).player.charm_s, 0);
  near(at(lines, 620).player.vel[0], 6, 0.01); // hết bùa thì về 6 m/s
  assert.equal(at(lines, 2700).charms[0].available, false);
  assert.equal(at(lines, 2701).charms[0].available, true);
});

test("S11: có bùa thì lướt không hồi chiêu, nhưng nhấn khi đang lướt bị bỏ qua và vẫn 14 m/s", () => {
  const frames = [...press(0, "dash"), ...press(5, "dash"), ...press(14, "dash")];
  const lines = run(base({ player: { charm_ticks: 600 } }), frames, 30);
  assert.deepEqual(events(lines, "dash").map((e) => e.tick), [1, 15]);
  near(at(lines, 6).player.vel[2], 14, 0.01);
  assert.equal(at(lines, 10).player.dash_cd_s, 0);
});

test("S11: nhặt bùa lần nữa thì làm mới 600 tick", () => {
  const scn = base({ player: { charm_ticks: 100 }, charms: [{ id: "C1", pos: [0, 0, 0.5] }] });
  assert.equal(at(run(scn, null, 1), 1).player.charm_s, 10);
});

// ---------- S12: gió mạnh ----------
test("S12: Đêm 3: gió 5 s mỗi 30 s đẩy 2 m/s theo dir_deg; báo trước không đẩy", () => {
  const lines = run(base({ wind_enabled: true }), null, 2200, { night: 3, snapshotEvery: 1 });
  assert.equal(at(lines, 1799).wind.active, false);
  assert.deepEqual(at(lines, 1799).player.pos, [0, 0, -30]);
  const w = at(lines, 1800).wind;
  assert.equal(w.active, true);
  assert.ok(Number.isInteger(w.dir_deg) && w.dir_deg >= 0 && w.dir_deg < 360);
  assert.equal(at(lines, 2099).wind.active, true);
  assert.equal(at(lines, 2100).wind.active, false);
  assert.equal(at(lines, 2100).wind.dir_deg, 0);
  const p = at(lines, 2100).player.pos;
  const dx = p[0];
  const dz = p[2] + 30;
  near(Math.hypot(dx, dz), 10, 0.05); // 2 m/s x 5 s
  const ang = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
  const diff = Math.abs(((ang - w.dir_deg + 540) % 360) - 180);
  assert.ok(diff < 1, `hướng ${ang} khác dir_deg ${w.dir_deg}`);
});

test("S12: gió chỉ có ở Đêm 3 theo mặc định, và tắt được bằng wind_enabled:false", () => {
  assert.equal(last(run(base(), null, 1900, { night: 2, snapshotEvery: 1900 })).wind.active, false);
  assert.equal(last(run(base({ wind_enabled: false }), null, 1850, { night: 3, snapshotEvery: 1850 })).wind.active, false);
  const dflt = base();
  delete dflt.wind_enabled;
  assert.equal(last(run(dflt, null, 1850, { night: 3, snapshotEvery: 1850 })).wind.active, true);
});

// ---------- S13: tạm dừng ----------
test("S13: tạm dừng: tick tăng, sim_tick/thời gian/vị trí đứng yên, snapshot state paused", () => {
  const frames = [{ tick: 0, move: [0, 1] }, ...press(10, "pause"), ...press(50, "pause")];
  const lines = run(base(), frames, 70);
  assert.deepEqual(events(lines, "paused").map((e) => e.tick), [11]);
  assert.deepEqual(events(lines, "resumed").map((e) => e.tick), [51]);
  assert.equal(at(lines, 10).state, "playing");
  for (let t = 11; t <= 50; t++) {
    const s = at(lines, t);
    assert.equal(s.state, "paused");
    assert.equal(s.sim_tick, 10);
    assert.equal(s.time_left_s, at(lines, 10).time_left_s);
    assert.deepEqual(s.player.pos, at(lines, 10).player.pos);
  }
  assert.equal(at(lines, 51).state, "playing");
  assert.equal(at(lines, 51).sim_tick, 11);
  assert.equal(end(lines).ticks, 70);
});

test("S13: tạm dừng làm đứng yên lịch sinh, hồi chiêu và TTL", () => {
  const frames = [...press(100, "pause"), ...press(140, "pause")];
  const spawned = events(run(base({ random_shades: true, player: { flames: 100 } }), frames, 400), "shade_spawned");
  assert.equal(spawned[0].tick, 340); // 300 tick mô phỏng + 40 tick dừng
  const cd = run(base({ player: { pulse_cd_ticks: 100 } }), [...press(10, "pause"), ...press(60, "pause")], 80);
  assert.equal(at(cd, 10).player.pulse_cd_s, at(cd, 40).player.pulse_cd_s);
});

test("S13: nhấn nút khác khi đang dừng bị bỏ qua và không tạo cạnh lên khi tiếp tục", () => {
  const scn = base({ player: { carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] });
  const frames = [{ tick: 0, pause: true }, { tick: 1, pause: false, interact: true }, { tick: 5, pause: true }, { tick: 6, pause: false }];
  assert.equal(events(run(scn, frames, 20), "deposit").length, 0);
});

// ---------- S14: định dạng v1.1 ----------
test("S14: snapshot có đủ trường bắt buộc của Contract v1.1", () => {
  const s = snaps(run({}, null, 0, { night: 2 }))[0];
  for (const k of ["type", "tick", "sim_tick", "state", "night", "time_left_s", "score", "wind", "player", "lanterns", "shades", "drifters", "charms", "motes_active", "motes"]) {
    assert.ok(k in s, `thiếu ${k}`);
  }
  assert.deepEqual(Object.keys(s.wind), ["active", "dir_deg"]);
  for (const k of ["pos", "vel", "flames", "carried", "grounded", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s"]) assert.ok(k in s.player, `player thiếu ${k}`);
  assert.equal(s.night, 2);
  assert.ok(s.motes.every((m) => m.id && m.pos.length === 3 && ["random", "dropped"].includes(m.kind) && "ttl_s" in m));
  assert.ok(s.charms.every((c) => c.id && typeof c.available === "boolean" && "respawn_s" in c));
});

test("S14: trạng thái Bóng Mực dùng đúng tên v1.1", () => {
  const names = new Set();
  const lines = run(base({ random_shades: true, player: { flames: 100, carried: 10 } }), [{ tick: 0, move: [0.2, 0.1] }, ...press(400, "pulse")], 1500, { snapshotEvery: 5 });
  for (const s of snaps(lines)) for (const sh of s.shades) names.add(sh.state);
  for (const n of names) assert.ok(["spawning", "wander", "chase", "recoil", "stunned"].includes(n), n);
  assert.ok(names.has("spawning"));
});

test("S14: chạy một Đêm đầy đủ (21600 tick) mỗi đêm xong trong <= 30 giây", () => {
  for (const night of [1, 2, 3]) {
    const t0 = Date.now();
    const lines = run({ player: { flames: 1000 } }, [{ tick: 0, move: [0.4, 1] }], 21600, { night, seed: 3, snapshotEvery: 10 });
    const ms = Date.now() - t0;
    assert.ok(ms <= 30000, `đêm ${night}: ${ms} ms`);
    assert.ok(end(lines).ticks <= 21600);
  }
});
